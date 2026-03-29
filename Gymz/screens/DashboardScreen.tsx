import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
  TouchableOpacity,
  Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth, mapProfile } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import { useTheme } from '../hooks/useTheme';
import { designSystem } from '../theme/designSystem';
import {
  getCurrentSession,
  calculateStreak,
  getWeeklyCount,
  checkOut,
  AttendanceSession,
  calculateNaturalRhythm
} from '../services/attendanceService';
import { healthService } from '../services/healthService';
import { nutritionService } from '../services/nutritionService';
import { useStepTracking } from '../hooks/useStepTracking';
import { differenceInMinutes, format, startOfDay, endOfDay, isSameDay } from 'date-fns';
import { tribeService } from '../services/tribeService';
import { useFocusEffect } from '@react-navigation/native';

// Import modular components
import { DynamicBackground } from '../components/dashboard/DynamicBackground';
import { DashboardLayoutHeader } from '../components/dashboard/DashboardLayoutHeader';
import { DashboardLayoutWeekRow } from '../components/dashboard/DashboardLayoutWeekRow';
import { ActiveSessionBanner } from '../components/dashboard/ActiveSessionBanner';
import { UpcomingClasses } from '../components/dashboard/UpcomingClasses';
import { LogWorkoutModal } from '../components/workout/LogWorkoutModal';
import { MyMealLogs } from '../components/dashboard/MyMealLogs';
import { DailyPulseCard } from '../components/dashboard/DailyPulseCard';
import { OverdueStatusModal } from '../components/membership/OverdueStatusModal';
import { WeekOverWeekCard } from '../components/dashboard/WeekOverWeekCard';
import { getUserMemory, storeMessage, getSessionIdentifiers } from '../services/aiChat';
import { shouldSendProactiveMessage, generateProactiveMessage } from '../services/profileCompletion';
import { progressService } from '../services/progressService';
import { nutritionNotificationService } from '../services/nutritionNotificationService';
import { progressReportService, ProgressReport } from '../services/progressReportService';
import { ProgressReportCard } from '../components/dashboard/ProgressReportCard';
import { calculateBMI, calculateCalorieBurn, calculateBMR, calculateTDEE, calculateMacroSplit } from '../utils/healthMath';
import { CalibrationBanner } from '../components/CalibrationBanner';
import { SponsorBanners } from '../components/dashboard/SponsorBanners';
import { UpcomingEvents } from '../components/dashboard/UpcomingEvents';
import { useCoachInsight } from '../contexts/CoachInsightContext';
import { useCoachCharacter } from '../contexts/CoachCharacterContext';
import { DataMapper } from '../utils/dataMapper';
import { DASHBOARD_LAYOUT } from '../components/dashboard/dashboardLayoutConstants';

export default function DashboardScreen({ navigation }: any) {
  const { user, logout, isCalibrated } = useAuth();
  const { theme, gender } = useTheme();
  const { setPayload: setCoachInsightPayload } = useCoachInsight() || {};
  const coachChar = useCoachCharacter();
  const [loading, setLoading] = useState(false); // Default to false to show structure
  const [isInitialMount, setIsInitialMount] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasData, setHasData] = useState(false);
  const [isFreshData, setIsFreshData] = useState(false);
  const [showHeavyContent, setShowHeavyContent] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showLogWorkout, setShowLogWorkout] = useState(false);
  const [showOverdueModal, setShowOverdueModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isLimitedMode, setIsLimitedMode] = useState(false);
  // ══════════════════════════════════════════════════════════════════════════════
  // SECURITY GATE: Defense-in-depth — if user somehow bypassed navigator gates,
  // force them back to the correct onboarding step. This catches edge cases like
  // stale sessions, deep links, or any navigation bugs.
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!user) return;
    const hasGymMapping = Boolean(user.gymId && user.accessMode);
    if (!hasGymMapping) {
      console.warn('[DashboardScreen] SECURITY: User missing gym mapping, redirecting to GymSelection');
      navigation.reset({ index: 0, routes: [{ name: 'GymSelection' }] });
      return;
    }
    if (!user.uniqueId) {
      console.warn('[DashboardScreen] SECURITY: User missing member ID, redirecting to AccessGate');
      navigation.reset({ index: 0, routes: [{ name: 'AccessGate' }] });
      return;
    }
    if (!isCalibrated) {
      console.warn('[DashboardScreen] SECURITY: User not calibrated, redirecting to HealthMetrics');
      navigation.reset({ index: 0, routes: [{ name: 'HealthMetrics', params: { isHardGate: true } }] });
      return;
    }
  }, [user, isCalibrated, navigation]);


  const initialMount = useRef(true);




  // User data
  const [profile, setProfile] = useState<any>(null);
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [xpProgress, setXpProgress] = useState(0);
  const { currentSteps: liveSteps } = useStepTracking();
  /** Latest live steps for async fetch (avoid stale closure in fetchDashboardData). */
  const liveStepsRef = useRef(liveSteps);
  useEffect(() => {
    liveStepsRef.current = liveSteps;
  }, [liveSteps]);
  const [sleepMinutes, setSleepMinutes] = useState(0);

  // Stats
  const [dailyStats, setDailyStats] = useState({
    calories: 0,
    water: 0,
    steps: 0,
    activeMinutes: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
    bmi: 0,
    goals: {
      dailyCalorieGoal: 1800,
      dailyProteinGoal: 150,
      dailyCarbsGoal: 150,
      dailyFatsGoal: 50
    }
  });

  const [personalTimetable, setPersonalTimetable] = useState<any[]>([]);
  const [workoutCount, setWorkoutCount] = useState(0);

  // Attendance states
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [attendanceStats, setAttendanceStats] = useState({
    streak: 0,
    weeklyCount: 0
  });
  const [checkingOut, setCheckingOut] = useState(false);
  const [rank, setRank] = useState<number | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [recentNutrition, setRecentNutrition] = useState<any[]>([]);

  // Cache Keys
  const CACHE_KEY_DASHBOARD = `dashboard_data_v2`;

  async function loadCachedData() {
    if (!user?.id) return;
    try {
      const cached = await AsyncStorage.getItem(`${CACHE_KEY_DASHBOARD}_${user.id}`);
      if (cached) {
        const data = JSON.parse(cached);
        setXp(data.xp || 0);
        setLevel(data.level || 1);
        setXpProgress(data.xpProgress || 0);
        setWorkoutCount(data.workoutCount || 0);
        setPersonalTimetable(data.personalTimetable || []);
        setAttendanceStats(data.attendanceStats || { streak: 0, weeklyCount: 0 });
        if (data.activeSession) setActiveSession(data.activeSession);

        const cachedRow = data.profile || null;
        const cachedProfile = cachedRow ? mapProfile(cachedRow, user.email) : null;
        setProfile(cachedProfile);

        // Recalculate goals from cached profile using REAL data only and avoid fallbacks
        if (data.dailyStats) {
          const weight = Number(cachedProfile?.weight || (cachedProfile?.metadata as any)?.weight) || 0;
          const height = Number(cachedProfile?.height || (cachedProfile?.metadata as any)?.height) || 0;
          const age = Number(cachedProfile?.age || (cachedProfile?.metadata as any)?.age) || 0;
          const gender = cachedProfile?.gender || (cachedProfile?.metadata as any)?.gender;

          if (weight > 0 && height > 0 && age > 0 && gender) {
            const bmr = calculateBMR(weight, height, age, gender);
            let activityKey: any = 'MODERATELY_ACTIVE';
            const intensity = cachedProfile?.workoutIntensity || (cachedProfile?.metadata as any)?.workoutIntensity;
            if (intensity === 'low') activityKey = 'LIGHTLY_ACTIVE';
            if (intensity === 'high') activityKey = 'VERY_ACTIVE';
            if (intensity === 'extreme') activityKey = 'EXTREMELY_ACTIVE';

            const tdee = calculateTDEE(bmr, activityKey);
            const objective = cachedProfile?.goal || (cachedProfile?.metadata as any)?.fitnessGoal || 'recomp';
            let targetCalories = tdee;
            if (objective === 'lose_weight' || objective === 'weight_loss') targetCalories -= 500;
            if (objective === 'build_muscle' || objective === 'muscle_gain') targetCalories += 300;
            targetCalories = Math.max(1200, targetCalories);
            const macros = calculateMacroSplit(targetCalories, objective, weight);

            let cachedBmi = cachedProfile?.calculatedBmi || 0;
            if (cachedBmi === '--') cachedBmi = 0;
            if (!cachedBmi) {
              const heightM = height / 100;
              cachedBmi = (weight / (heightM * heightM)).toFixed(1);
            }

            setDailyStats(prev => ({
              ...prev,
              ...data.dailyStats,
              bmi: cachedBmi,
              goals: {
                ...prev.goals,
                ...data.dailyStats?.goals,
                dailyCalorieGoal: Math.round(targetCalories),
                dailyProteinGoal: Math.round(macros.protein),
                dailyCarbsGoal: Math.round(macros.carbs),
                dailyFatsGoal: Math.round(macros.fat),
              }
            }));
          } else {
            // No real biometric data, just use cached dailyStats but ensure fallback goals
            setDailyStats(prev => ({
              ...prev,
              ...data.dailyStats,
              goals: {
                ...prev.goals,
                ...data.dailyStats?.goals,
                calories: data.dailyStats?.goals?.calories || 1800,
                protein: data.dailyStats?.goals?.protein || 135,
                carbs: data.dailyStats?.goals?.carbs || 180,
                fat: data.dailyStats?.goals?.fat || 60,
              }
            }));
          }
        } else {
          // If no dailyStats, at least update cache
          setDailyStats(prev => ({ ...prev, ...data.dailyStats }));
        }

        // Unblock UI immediately so dashboard renders (no full-screen skeleton overlay)
        if (cachedProfile) {
          setHasData(true);
          setIsInitialMount(false);
          setShowHeavyContent(true);
          setIsFreshData(false); // Cache is NOT fresh
        }
      }
    } catch (e) {
      console.log('Failed to load cache', e);
    }
  }



  const [userMemory, setUserMemory] = useState<any>(null); // Memory State
  const [isInTribe, setIsInTribe] = useState(false); // Tribe State
  const [preferredTime, setPreferredTime] = useState<string | null>(null); // Timing State
  const [proactiveMessage, setProactiveMessage] = useState<string | null>(null); // Proactive AI State
  const [weekComparison, setWeekComparison] = useState<any>(null); // Week-Over-Week Comparison
  const [activeReport, setActiveReport] = useState<ProgressReport | null>(null); // Milestone Report State

  async function fetchDashboardData(isBackgroundRefresh = false) {
    if (!user?.id) return;
    if (!isBackgroundRefresh && hasData) setIsRefreshing(true);

    const isToday = isSameDay(selectedDate, new Date());
    const dateStr = isToday
      ? new Date().toISOString().split('T')[0]
      : format(selectedDate, 'yyyy-MM-dd');

    let fetchGotData = false;
    try {
      console.log('[DashboardScreen] Fetching Turbo consolidated data for:', user.id);

      // Parallelize the BIG RPC with the supplemental health/water checks
      // This saves another ~200-500ms of sequential waiting
      const [turboResult, healthLogResult, waterIntakeResult, activeGoalsResult, nutritionLogsResult] = await Promise.allSettled([
        (supabase as any).rpc('get_unified_app_data', { p_user_id: user.id, p_date: dateStr }),
        healthService.getDailyLog(user.id, dateStr),
        nutritionService.fetchWaterIntake(user.id, dateStr),
        nutritionService.getMacroTargets(user.id, dateStr),
        nutritionService.fetchDailyLogs(user.id, dateStr)
      ]);

      if (turboResult.status === 'rejected' || (turboResult.value as any).error) {
        console.error('[DashboardScreen] Turbo RPC Error/Auth Issue:',
          turboResult.status === 'rejected' ? turboResult.reason : (turboResult.value as any).error);

        if (turboResult.status === 'fulfilled' && (turboResult.value as any).error) {
          console.warn('[DashboardScreen] RPC Permission Denied? Check Database Grants.');
        }
        // Do NOT throw here. Let the engine fall back to local User data.
      }

      const turboDataRaw = (turboResult.status === 'fulfilled' && !(turboResult.value as any).error)
        ? (turboResult.value as any).data
        : null;

      const turboData = DataMapper.fromDb<any>(turboDataRaw);
      if (turboData) {
        setIsFreshData(true);
        fetchGotData = true;
      }

      const turboProfileRaw = turboData?.profile || null;
      const turboNutrition = turboData?.nutrition || { todayCalories: 0, todayWater: 0, logs: [] };
      const turboGamification = turboData?.gamification || { totalXp: 0, level: 1, rank: 0, totalPoints: 0 };
      const turboFitness = turboData?.fitness || { todayMinutes: 0, workoutCount: 0 };
      const turboCalendar = turboData?.calendar || [];

      // --- Sanitization Layer (Absolute Harmony) ---
      const turboProfile = turboProfileRaw ? mapProfile(turboProfileRaw, user.email) : null;
      // Logs are already mapped deep in DataMapper.fromDb(turboDataRaw) at line 265


      // --- Process Profile ---
      if (turboProfile) {
        setProfile(turboProfile);
        setXp(turboGamification.totalXp);
        setLevel(turboGamification.level);
        setTotalPoints(turboGamification.totalPoints);
        setRank(turboGamification.rank);
        const membershipStatus = turboProfile.membershipStatus?.toLowerCase() || '';
        const nonActiveStates = ['inactive', 'rejected', 'new', 'pending'];
        if (nonActiveStates.includes(membershipStatus)) {
          setShowOverdueModal(true);
        } else if (membershipStatus === 'active' || membershipStatus === 'approved') {
          setShowOverdueModal(false);
        } else if (nonActiveStates.includes(membershipStatus) && isFreshData) { // Double check freshness
          setShowOverdueModal(true);
        }
      }

      // --- Process Leaderboard & XP ---
      // This block now only handles XP progress calculation, as other gamification states are set above.
      if (turboGamification) {
        const totalPointsVal = turboGamification.totalXp || 0;
        const currentRank = turboGamification.level || 1;
        const currentRankPoints = (currentRank - 1) * 1000;
        const nextRankPoints = currentRank * 1000;
        const currentXp = totalPointsVal - currentRankPoints;
        const progress = Math.max(0, Math.min(1, currentXp / (nextRankPoints - currentRankPoints)));
        setXpProgress(progress);
      }

      // --- Process Workouts & Stats ---
      const todayMinutes = turboFitness.todayMinutes || 0;
      setWorkoutCount(turboFitness.workoutCount || 0);

      // --- Process Nutrition ---
      // ROBUST PARITY: Use direct logs fetch if RPC is empty or mismatched
      const directLogs = nutritionLogsResult.status === 'fulfilled' ? nutritionLogsResult.value : [];
      const nutritionLogs = directLogs.length > 0 ? directLogs : (turboNutrition.logs || []);
      setRecentNutrition(nutritionLogs);

      const todayCalories = turboNutrition.todayCalories || 0;

      // Use RPC value OR realWater value (realWater is more precise if sync happened)
      const todayWater = (waterIntakeResult.status === 'fulfilled' ? waterIntakeResult.value : 0) || turboNutrition.todayWater || 0;
      const healthLog =
        healthLogResult.status === 'fulfilled' && healthLogResult.value ? healthLogResult.value : null;
      const sleepMin = healthLog ? healthLog.sleepMinutes : 450;
      setSleepMinutes(sleepMin);

      // STRICT SSOT: Extract real metrics, checking both sources for each field
      const curWeight = Number(turboProfile?.weight ?? user?.weight) || 0;
      const curHeight = Number(turboProfile?.height ?? user?.height) || 0;
      const curAge = Number(turboProfile?.age ?? user?.age) || 0;
      const curGender = (turboProfile?.gender || user?.gender || '').toLowerCase();

      // Get Goals directly from the SSOT which matches NutritionScreen identically
      let goals: any = null;
      if (activeGoalsResult.status === 'fulfilled' && activeGoalsResult.value) {
        goals = activeGoalsResult.value;
        console.log('[Dashboard] Goals from nutritionService:', goals);
      } else if (turboFitness.activeGoal && Number(turboFitness.activeGoal.dailyCalorieGoal) > 0) {
        goals = turboFitness.activeGoal;
        console.log('[Dashboard] Goals from Turbo RPC:', goals);
      }

      // PROACTIVE SYNC: If no goals exist but user has bio-data, compute and persist them now
      if (!goals && curWeight > 0 && curHeight > 0 && curAge > 0 && curGender) {
        console.log('[Dashboard] Proactive sync triggering...');
        try {
          const synced = await nutritionService.syncNutritionTargets(user.id);
          if (synced) goals = synced;
        } catch (syncErr) {
          console.warn('[Dashboard] proactive sync failed:', syncErr);
        }
      }

      // REFINEMENT: Ensure BMI is calculated
      let frontendBmi = turboProfile?.calculatedBmi || 0;
      if (frontendBmi === '--') frontendBmi = 0;
      if (!frontendBmi && curWeight > 0 && curHeight > 0) {
        const heightM = curHeight / 100;
        frontendBmi = (curWeight / (heightM * heightM)).toFixed(1);
      }

      const fallbackCalories = 0;
      const fallbackProtein = 0;
      const fallbackCarbs = 0;
      const fallbackFat = 0;

      // Map goals with strict fallback chain
      const calorieGoal = Math.round(Number(goals?.dailyCalorieGoal) || dailyStats.goals.dailyCalorieGoal || fallbackCalories);
      const proteinGoal = Math.round(Number(goals?.dailyProteinGoal) || dailyStats.goals.dailyProteinGoal || fallbackProtein);
      const carbsGoal = Math.round(Number(goals?.dailyCarbsGoal) || dailyStats.goals.dailyCarbsGoal || fallbackCarbs);
      const fatGoal = Math.round(Number(goals?.dailyFatsGoal) || dailyStats.goals.dailyFatsGoal || fallbackFat);

      console.log('[Dashboard] RESOLVED GOALS:', { calorieGoal, proteinGoal, carbsGoal, fatGoal });

      // Steps: merge live pedometer + DB row + unified RPC health (when migration deployed).
      // Previously only `liveSteps` from an async closure was used — often 0 — so burn/stats lagged.
      const turboHealth = turboData?.health as { steps?: number } | undefined;
      const rpcHealthSteps = Number(turboHealth?.steps) || 0;
      const dbSteps = Number(healthLog?.steps) || 0;
      const liveSnapshot = isToday ? liveStepsRef.current : 0;
      const resolvedSteps = isToday
        ? Math.max(liveSnapshot, dbSteps, rpcHealthSteps)
        : Math.max(dbSteps, rpcHealthSteps);

      const dStats = {
        calories: nutritionLogs.reduce((sum: number, log: any) => sum + (Number(log.calories) || 0), 0),
        water: Number(todayWater) || 0,
        steps: resolvedSteps,
        activeMinutes: turboFitness.todayMinutes || 0,
        protein: nutritionLogs.reduce((sum: number, log: any) => sum + (Number(log.protein) || 0), 0),
        carbs: nutritionLogs.reduce((sum: number, log: any) => sum + (Number(log.carbs) || 0), 0),
        fats: nutritionLogs.reduce((sum: number, log: any) => sum + (Number(log.fats) || 0), 0),
        bmi: frontendBmi,
        goals: {
          dailyCalorieGoal: calorieGoal,
          dailyProteinGoal: proteinGoal,
          dailyCarbsGoal: carbsGoal,
          dailyFatsGoal: fatGoal,
        },
      };

      setDailyStats(prev => ({
        ...prev,
        ...dStats,
        bmi: Number(dStats.bmi) || 0,
        goals: {
          ...prev.goals,
          ...dStats.goals
        }
      }));

      // --- Process Classes ---
      const validUpcomingClasses = (turboCalendar || [])
        .filter((booking: any) => {
          const schedule = booking.gymClassSchedules;
          if (!schedule) return false;
          const scheduleDate = new Date(schedule.date + 'T' + schedule.startTime);
          return isSameDay(scheduleDate, selectedDate) || scheduleDate >= new Date();
        })
        .slice(0, 3);
      setPersonalTimetable(validUpcomingClasses);

      // --- Process Attendance ---
      const { streak = 0, weeklyCount = 0 } = turboFitness.attendance || {};
      setAttendanceStats({ streak, weeklyCount });

      // --- BACKGROUND SERVICES ---
      Promise.all([
        getUserMemory(user.id),
        tribeService.getUserTribe(user.id),
        progressService.getWeekOverWeekComparison(user.id),
        shouldSendProactiveMessage(user.id).then(async (shouldSend) => {
          if (shouldSend) return generateProactiveMessage(user.id);
          return null;
        })
      ]).then(([memory, myTribe, weekComp, pMessage]) => {
        setUserMemory(memory);
        setIsInTribe(!!myTribe);
        setWeekComparison(weekComp);
        setProactiveMessage(pMessage);
      }).catch(e => console.warn('[Dashboard] Background service issue', e));

      // --- CACHE ---
      const cacheData = {
        xp: turboGamification?.totalXp,
        level: turboGamification?.level,
        dailyStats: dStats,
        workoutCount: turboFitness?.workoutCount,
        personalTimetable: validUpcomingClasses,
        profile: turboProfileRaw
      };
      AsyncStorage.setItem(`${CACHE_KEY_DASHBOARD}_${user.id}`, JSON.stringify(cacheData)).catch(() => { });

    } catch (error) {
      console.error('[Dashboard] Error fetching dashboard data:', error);
    } finally {
      setIsRefreshing(false);
      setRefreshing(false);
      // Only exit skeleton when we actually got data from this fetch.
      // Otherwise we'd show a blank dashboard if fetch failed and there was no cache.
      if (fetchGotData) {
        setIsInitialMount(false);
        setHasData(true);
        setShowHeavyContent(true);
      }
    }
  }

  // Keep dailyStats.steps aligned with live pedometer for "today" (coach widget, cache, pulls).
  useEffect(() => {
    if (!isSameDay(selectedDate, new Date())) return;
    setDailyStats(prev => {
      const next = Math.max(prev.steps, liveSteps);
      return next === prev.steps ? prev : { ...prev, steps: next };
    });
  }, [liveSteps, selectedDate]);

  useEffect(() => {
    if (initialMount.current) {
      initialMount.current = false;
    }
    let mounted = true;

    if (user?.id) {
      // 1. Load from cache (FAST)
      loadCachedData();

      // 2. Load from network (Background refresh on first mount to prevent blink)
      fetchDashboardData(true);

      // 3. Init notifications
      nutritionNotificationService.initNotifications(user.id);


      // 3. Consolidate Real-time Listeners into a SINGLE channel
      // This massively reduces WebSocket overhead and reconnection spam
      const consolidatedChannel = (supabase as any)
        .channel(`dashboard_turbo_${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `id=eq.${user.id}` }, () => fetchDashboardData(true))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `user_id=eq.${user.id}` }, () => fetchDashboardData(true))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_nutrition_logs', filter: `user_id=eq.${user.id}` }, () => fetchDashboardData(true))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'workout_sessions', filter: `user_id=eq.${user.id}` }, () => fetchDashboardData(true))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'xp_transactions', filter: `user_id=eq.${user.id}` }, () => fetchDashboardData(true))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'water_logs', filter: `user_id=eq.${user.id}` }, () => fetchDashboardData(true))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_health_logs', filter: `user_id=eq.${user.id}` }, () => fetchDashboardData(true))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'gym_class_schedules' }, () => fetchDashboardData(true))
        .subscribe();

      return () => {
        mounted = false;
        supabase.removeChannel(consolidatedChannel);
      };
    }
    return () => { mounted = false; };
  }, [user?.id, selectedDate]);


  // Feed coach insight widget (shows as small popup 5s after dashboard has data, app-wide)
  useEffect(() => {
    if (!setCoachInsightPayload || !hasData) return;
    setCoachInsightPayload({
      userMemory,
      stats: { ...dailyStats, streak: attendanceStats.streak, goals: dailyStats.goals, protein: dailyStats.protein, calories: dailyStats.calories },
      isInTribe,
      preferredTime,
      hasGaps: !user?.isCalibrated,
      gender: gender as 'male' | 'female',
    });
  }, [hasData, userMemory, dailyStats, attendanceStats.streak, isInTribe, preferredTime, user?.isCalibrated, gender, setCoachInsightPayload]);

  // --- PERSISTENCE FIX: Re-show modal on focus if not in limited mode; dismiss when active ---
  useFocusEffect(
    useCallback(() => {
      if (profile && isFreshData) { // ONLY TRIGGER ON FRESH DATA
        const status = (profile.membershipStatus?.toLowerCase() || '') as string;
        const nonActiveStates = ['inactive', 'rejected', 'new', 'pending'];
        if (nonActiveStates.includes(status) && !isLimitedMode) {
          setShowOverdueModal(true);
        } else if (status === 'active' || status === 'approved') {
          setShowOverdueModal(false);
        }
      }
    }, [profile, isFreshData, isLimitedMode])
  );

  useEffect(() => {
    if (!activeSession) return;
    const interval = setInterval(() => {
      const duration = differenceInMinutes(new Date(), new Date((activeSession as any).checkInTime));
      setSessionDuration(duration);
    }, 10000);
    return () => clearInterval(interval);
  }, [activeSession]);

  const handleCheckOut = async () => {
    if (!activeSession) return;
    setCheckingOut(true);
    try {
      const result = await checkOut(activeSession.id);
      if (result.success) {
        setActiveSession(null);
        fetchDashboardData();
        Alert.alert('Success', result.message);
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to check out');
    } finally {
      setCheckingOut(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  // No full-screen overlay: always show dashboard. Cache or fetch fills data; no blocking skeleton.

  const memberName = profile?.name || user?.name || 'Member';
  const initials = memberName.split(' ').filter(Boolean).map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '??';

  /** Burned kcal from steps must follow live pedometer for "today", not only cached dailyStats.steps. */
  const isSelectedToday = isSameDay(selectedDate, new Date());
  const stepsForBurn = isSelectedToday ? Math.max(liveSteps, dailyStats.steps) : dailyStats.steps;

  // --- AI Copywriter Logic ---
  const getOverdueCopy = () => {
    const name = profile?.firstName || profile?.name?.split(' ')[0] || 'friend';
    const objective = profile?.goal?.toLowerCase() || '';
    const streak = attendanceStats.streak;
    const isDayPass = profile?.membershipType === 'Day Pass';
    const weightLost = profile?.weightLost;
    const totalWorkouts = workoutCount;
    const isFemale = gender === 'female';

    // --- DAY PASS BRANCH ---
    if (isDayPass) {
      if (isFemale) {
        return {
          title: "You prioritized you.",
          subMessage: `You took the first step, ${name}. Honor that effort and keep this feeling going. Upgrade to stay.`,
          ctaText: "JOIN THE TRIBE"
        };
      }
      return {
        title: "Keep Going.",
        subMessage: `Great start, ${name}. Upgrade now to keep your momentum.`,
        ctaText: "JOIN THE TRIBE"
      };
    }

    // --- IDENTITY / HIGH STREAK BRANCH ---
    if (streak > 5) {
      if (isFemale) {
        return {
          title: "You've built momentum.",
          subMessage: `${streak} days of showing up for yourself. You are strong and consistent, ${name}. Keep flowing.`,
          ctaText: "PROTECT MY PROGRESS"
        };
      }
      return {
        title: "You're on a Roll.",
        subMessage: `${streak} days straight! You're a regular now, ${name}. Keep the chain alive.`,
        ctaText: "PROTECT MY PROGRESS" // Keeping consistent with original intent or previous plan? Plan didn't specify CTA change, but stuck to "PROTECT MY PROGRESS" in logic usually. I'll check previous code.
        // Previous CTA was "PROTECT MY PROGRESS". Plan didn't explicitly change CTA text in the markdown, just message. I'll keep previous CTAs unless they seem wrong.
      };
    }

    // --- GOAL SPECIFIC BRANCHES ---
    if (objective.includes('weight') || objective.includes('fat')) {
      if (isFemale) {
        return {
          title: "Truly transforming.",
          subMessage: weightLost && weightLost > 0
            ? `${weightLost}kg lighter. You're doing this for you, ${name}. Keep nurturing your progress.`
            : `You're doing this for you, ${name}. Keep nurturing your progress.`,
          ctaText: "KEEP THE MOMENTUM"
        };
      }
      return {
        title: "Stay Consistent.",
        subMessage: weightLost && weightLost > 0
          ? `${weightLost}kg down! Don't let your progress slide now, ${name}. Keep pushing.`
          : `Every workout counts. Don't stop now, ${name}.`,
        ctaText: "KEEP THE MOMENTUM"
      };
    }

    if (objective.includes('muscle') || objective.includes('strength')) {
      if (isFemale) {
        return {
          title: "Stronger every day.",
          subMessage: `You've put in ${totalWorkouts} sessions. Feel that strength, ${name}. Don't let it go.`,
          ctaText: "BACK TO THE GRIND"
        };
      }
      return {
        title: "Protect Your Gains.",
        subMessage: `${totalWorkouts} sessions in. Don't stop now and lose your hard work, ${name}.`,
        ctaText: "BACK TO THE GRIND"
      };
    }

    if (objective.includes('mental') || objective.includes('stress')) {
      if (isFemale) {
        return {
          title: "Your peace matters.",
          subMessage: `You deserve this clarity, ${name}. Don't pause your self-care now.`,
          ctaText: "RECLAIM MY FOCUS"
        };
      }
      return {
        title: "Stay Focused.",
        subMessage: `Your mind needs this routine, ${name}. Finish the day strong.`,
        ctaText: "RECLAIM MY FOCUS"
      };
    }

    // --- STATUS SPECIFIC BRANCHES ---
    if (user?.membershipStatus === 'New') {
      return {
        title: "Welcome to Gymz!",
        subMessage: `Hi ${name}, we're excited to have you! Pick a plan to start your transformation.`,
        ctaText: "EXPLORE PLANS"
      };
    }

    if (user?.membershipStatus === 'Pending') {
      return {
        title: "Almost There!",
        subMessage: `Your payment is being verified, ${name}. You can explore the app in Limited Mode in the meantime.`,
        ctaText: "CHECK STATUS"
      };
    }

    if (user?.membershipStatus === 'Rejected') {
      return {
        title: "Action Required",
        subMessage: `We couldn't verify your payment, ${name}. Please check your details and try again.`,
        ctaText: "FIX PAYMENT"
      };
    }

    // --- DEFAULT PRO-COPY ---
    if (isFemale) {
      return {
        title: "Health & Activity",
        subMessage: `Your wellness journey matters, ${name}. Let's get you active again.`,
        ctaText: "RECLAIM FULL ACCESS"
      };
    }
    return {
      title: "Account Paused.",
      subMessage: `Consistency gets results. Let's get you back on track, ${name}.`,
      ctaText: "RECLAIM FULL ACCESS"
    };
  };

  const overdueCopy = getOverdueCopy();

  const sectionSpacing = DASHBOARD_LAYOUT.sectionSpacing;
  const daysToNext = DASHBOARD_LAYOUT.daysToNextBlockSpacing;
  const tightSpacing = DASHBOARD_LAYOUT.tightSpacing;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <DynamicBackground rotationType="fixed" fixedIndex={2} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: DASHBOARD_LAYOUT.contentPaddingHorizontal,
            paddingTop: DASHBOARD_LAYOUT.contentPaddingTop,
            // Add bottom padding for tab bar (root handles nav bar inset)
            paddingBottom: DASHBOARD_LAYOUT.contentPaddingBottom + 80, // 80 for tab bar height
          },
        ]}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        contentInset={{ top: 0, left: 0, right: 0, bottom: 0 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        <DashboardLayoutHeader
          memberName={memberName}
          initials={initials}
          gender={gender as any}
          avatarUrl={profile?.avatarUrl || user?.avatarUrl}
          onProfilePress={() => navigation.navigate('Profile')}
          safeAreaTop={0}
        />

        {isRefreshing && (
          <View style={{ position: 'absolute', top: 60, left: 0, right: 0, alignItems: 'center', zIndex: 100 }}>
            <View style={{ backgroundColor: theme.backgroundCard, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: theme.border }}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary }}>SYNCING...</Text>
            </View>
          </View>
        )}

        {!user?.isCalibrated && (
          <View style={{ marginBottom: tightSpacing }}>
            <CalibrationBanner onPress={() => navigation.navigate('HealthMetrics')} />
          </View>
        )}

        <View style={{ marginBottom: tightSpacing }}>
          <SponsorBanners />
        </View>

        <View style={{ marginBottom: daysToNext }}>
          <DashboardLayoutWeekRow
            selectedDate={selectedDate}
            onDateSelect={(date) => setSelectedDate(date)}
          />
        </View>


        <View style={{ marginBottom: sectionSpacing }}>
          <DailyPulseCard
            isLoading={isRefreshing && !hasData}
            calories={{
              eaten: dailyStats.calories,
              // ...
              // Goal matches the Daily Nutrition goal directly, without adding adaptive step/workout burn
              goal: dailyStats.goals.dailyCalorieGoal,
              burned: Math.round(stepsForBurn * 0.04) +
                calculateCalorieBurn(
                  (profile?.workoutIntensity?.toUpperCase() as any) || 'MODERATE',
                  profile?.weight || 0,
                  dailyStats.activeMinutes
                )
            }}
            macros={{
              protein: { eaten: dailyStats.protein, goal: dailyStats.goals.dailyProteinGoal },
              carbs: { eaten: dailyStats.carbs, goal: dailyStats.goals.dailyCarbsGoal },
              fats: { eaten: dailyStats.fats, goal: dailyStats.goals.dailyFatsGoal },
            }}
            waterIntake={dailyStats.water}
            level={level}
            xpProgress={xpProgress}
            steps={liveSteps}
            bmi={dailyStats.bmi}
            weight={Number(profile?.weight ?? user?.weight) || 0}
            height={Number(profile?.height ?? user?.height) || 0}
            lastWeightLogDate={profile?.updatedAt || profile?.created_at}
            sleepHours={`${Math.floor(sleepMinutes / 60)}h ${sleepMinutes % 60}m`}
            onSetGoals={() => {
              const hasGaps = !user?.height || !user?.weight || !user?.age || !user?.gender || !user?.goal;
              navigation.navigate(hasGaps ? 'HealthMetrics' : 'AIChat', {
                initialMessage: "I need to refine my fitness targets!"
              });
            }}
            onQuickAction={() => navigation.navigate('GymCheckInScanner')}
          />
        </View>

        {weekComparison && weekComparison.lastWeek.daysLogged > 0 && (
          <View style={{ marginBottom: sectionSpacing }}>
            <WeekOverWeekCard
              thisWeek={weekComparison.thisWeek}
              lastWeek={weekComparison.lastWeek}
              weightDelta={weekComparison.weightDelta}
              isImproving={weekComparison.isImproving}
              onPress={() => navigation.navigate('Progress')}
            />
          </View>
        )}

        {activeReport && (
          <View style={{ marginBottom: sectionSpacing }}>
            <ProgressReportCard
              report={activeReport}
              onClose={() => setActiveReport(null)}
              onViewFullProgress={() => navigation.navigate('Progress')}
            />
          </View>
        )}

        {showHeavyContent && (
          <View style={{ marginBottom: sectionSpacing }}>
            <MyMealLogs
              isLoading={isRefreshing && !hasData}
              logs={recentNutrition}
              onLogPress={(mealType) => {
                // User tapped the "Scan" CTA from dashboard → wake the AI bubble immediately.
                coachChar?.fireMealScanStarted();
                navigation.navigate('FoodScanner', { mealType });
              }}
              onViewAll={() => navigation.navigate('Nutrition')}
            />
          </View>
        )}

        {activeSession ? (
          <View style={{ marginBottom: sectionSpacing }}>
            <ActiveSessionBanner
              checkInTime={(activeSession as any).checkInTime}
              duration={sessionDuration}
              streak={attendanceStats.streak}
              isCheckingOut={checkingOut}
              onCheckOut={handleCheckOut}
              onPress={() => navigation.navigate('Attendance')}
            />
          </View>
        ) : null}

        {showHeavyContent && (
          <>
            <View style={{ marginBottom: sectionSpacing }}>
              <UpcomingClasses
                isLoading={isRefreshing && !hasData}
                classes={personalTimetable}
                onSeeAll={() => navigation.navigate('GymCalendar')}
                onBookClass={() => navigation.navigate('GymCalendar')}
              />
            </View>

            <View style={{ marginBottom: sectionSpacing }}>
              <UpcomingEvents navigation={navigation} />
            </View>
          </>
        )}

      </ScrollView>



      <LogWorkoutModal
        visible={showLogWorkout}
        onClose={() => setShowLogWorkout(false)}
        onLogComplete={() => fetchDashboardData(true)}
        userId={user?.id || ''}
      />

      <OverdueStatusModal
        visible={showOverdueModal}
        onLogout={() => {
          setShowOverdueModal(false);
          logout();
        }}
        onRenew={() => {
          setShowOverdueModal(false);
          navigation.navigate('SubscriptionPlans');
        }}
        onDismiss={async () => {
          // Track that they chose limited access
          try {
            await (supabase as any).from('limited_access_logs').insert({
              user_id: user?.id,
              membershipStatus: profile?.membershipStatus,
              action: 'continued_with_limited_access'
            });
          } catch (e) {
            console.log('Failed to log limited access:', e);
          }

          setShowOverdueModal(false);
          setIsLimitedMode(true);
        }}
        memberName={memberName}
        membershipStatus={profile?.membershipStatus || 'Inactive'}
        streak={attendanceStats.streak}
        title={overdueCopy.title}
        subMessage={overdueCopy.subMessage}
        ctaText={overdueCopy.ctaText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: designSystem.spacing.md },
  loadingText: { fontSize: designSystem.typography.sizes.bodySmall },
  scrollView: { flex: 1 },
  scrollContent: {},
});
