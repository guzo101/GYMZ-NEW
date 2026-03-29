/**
 * My Report Service — v2 (Accuracy Pass)
 *
 * Uses ONLY existing tables and field names confirmed from:
 *   - progressService.ts  (body_metrics, user_fitness_goals, user_streaks, daily_nutrition_logs)
 *   - nutritionService.ts (water_logs.amount, daily_nutrition_logs)
 *
 * No invented columns. No renamed tables.
 * All aggregation mirrors progressService.aggregateNutritionLogs exactly.
 */

import { supabase } from './supabase';
import { subDays, format, differenceInDays } from 'date-fns';
import { calculateBMI } from '../utils/healthMath';

// ── Types ──────────────────────────────────────────────────────────────────

export type ReportRange = 'MONTH' | 'THREE_MONTHS' | 'SIX_MONTHS' | 'YEAR';

export interface DailyNutrition {
    date: string;
    totalCalories: number;
    totalProtein: number;
    totalCarbs: number;
    totalFats: number;
    mealCount: number;
}

export interface DailyWater {
    date: string;
    totalWater: number; // ml
}

export interface DailyWeight {
    date: string;
    weight: number; // kg — field is `weight` in body_metrics (confirmed)
}

export interface DailyBMI {
    date: string;
    bmi: number;
}

export interface ConsistencyMetrics {
    goalHitRate: number;
    loggingRate: number;
    currentStreak: number;
    longestStreak: number;
    totalDaysInRange: number;
    daysLogged: number;
    daysGoalHit: number;
    insight: string;
}

export interface NutritionMetrics {
    avgProtein: number;
    avgCarbs: number;
    avgFats: number;
    avgCalories: number;
    calorieGoal: number;
    proteinGoal: number;
    carbsGoal: number;
    fatsGoal: number;
    macroStabilityScore: number;
    calorieAdherenceTrend: { date: string; hit: number; goal: number }[];
    proteinTrend: { date: string; hit: number; goal: number }[];
    carbsTrend: { date: string; hit: number; goal: number }[];
    fatsTrend: { date: string; hit: number; goal: number }[];
    insight: string;
}

export interface BodyMetrics {
    weightTrend: DailyWeight[];
    bmiTrend: DailyBMI[];
    startWeight: number | null;
    endWeight: number | null;
    startBMI: number | null;
    endBMI: number | null;
    weightChange: number | null;
    bmiChange: number | null;
    goalWeight: number | null;
    plateauDetected: boolean;
    plateauWeeks: number;
    insight: string;
}

export interface HydrationMetrics {
    waterGoalHitRate: number;
    waterConsistencyRate: number;
    currentStreak: number;
    longestStreak: number;
    weeklyAverageWater: number;
    dailyWater: DailyWater[];
    insight: string;
}

export interface ReportData {
    consistency: ConsistencyMetrics;
    nutrition: NutritionMetrics;
    body: BodyMetrics;
    hydration: HydrationMetrics;
    range: ReportRange;
    startDate: string;
    endDate: string;
    hasData: boolean;
}

// ── Cache — per user + range, 5 min TTL ───────────────────────────────────

const reportCache = new Map<string, { data: ReportData; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export function clearReportCache() {
    reportCache.clear();
}

// ── Range helpers ──────────────────────────────────────────────────────────

export function getRangeDays(range: ReportRange): number {
    switch (range) {
        case 'MONTH': return 30;
        case 'THREE_MONTHS': return 90;
        case 'SIX_MONTHS': return 180;
        case 'YEAR': return 365;
    }
}

function getStartDate(range: ReportRange): string {
    return subDays(new Date(), getRangeDays(range)).toISOString().split('T')[0];
}

// ── Stability score (0–100) ────────────────────────────────────────────────

function stabilityScore(values: number[], goal: number): number {
    if (values.length < 2 || goal <= 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    const cv = (Math.sqrt(variance) / goal) * 100;
    return Math.max(0, Math.min(100, Math.round(100 - cv)));
}

// ── Nutrition logs (mirrors progressService.aggregateNutritionLogs exactly) ─

async function fetchNutritionLogs(userId: string, startDate: string, endDate: string): Promise<DailyNutrition[]> {
    const { data: logs, error } = await (supabase as any)
        .from('daily_nutrition_logs')
        .select('logged_at, calories, protein, carbs, fats')
        .eq('user_id', userId)
        .gte('logged_at', `${startDate}T00:00:00Z`)
        .lte('logged_at', `${endDate}T23:59:59Z`);

    if (error) {
        console.error('[MyReport] nutrition logs error:', error.message);
        return [];
    }

    const dailyMap = new Map<string, DailyNutrition>();

    (logs || []).forEach((log: any) => {
        if (!log.logged_at) return;
        // Handle possible array or string from Supabase
        const raw = Array.isArray(log.logged_at) ? log.logged_at[0] : log.logged_at;
        const date = (raw as string).split('T')[0];

        if (!dailyMap.has(date)) {
            dailyMap.set(date, { date, totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFats: 0, mealCount: 0 });
        }
        const d = dailyMap.get(date)!;
        d.totalCalories += Number(log.calories) || 0;
        d.totalProtein += Number(log.protein) || 0;
        d.totalCarbs += Number(log.carbs) || 0;
        d.totalFats += Number(log.fats) || 0;
        d.mealCount += 1;
    });

    return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// ── Water logs (mirrors nutritionService.fetchWaterIntake exactly) ─────────

async function fetchWaterLogs(userId: string, startDate: string, endDate: string): Promise<DailyWater[]> {
    // Modern path: water_logs.amount (field confirmed in nutritionService)
    const [modernResult, legacyResult] = await Promise.allSettled([
        (supabase as any)
            .from('water_logs')
            .select('date, amount')
            .eq('user_id', userId)
            .gte('date', startDate)
            .lte('date', endDate),

        // Legacy path: nutrition log entry with food_name = 'Water Intake'
        (supabase as any)
            .from('daily_nutrition_logs')
            .select('logged_at, quantity')
            .eq('user_id', userId)
            .eq('food_name', 'Water Intake')
            .gte('logged_at', `${startDate}T00:00:00Z`)
            .lte('logged_at', `${endDate}T23:59:59Z`),
    ]);

    const dailyMap = new Map<string, number>();

    if (modernResult.status === 'fulfilled' && !modernResult.value.error) {
        (modernResult.value.data || []).forEach((row: any) => {
            if (!row.date) return;
            dailyMap.set(row.date, (dailyMap.get(row.date) || 0) + (Number(row.amount) || 0) * 250);
        });
    }

    if (legacyResult.status === 'fulfilled' && !legacyResult.value.error) {
        (legacyResult.value.data || []).forEach((row: any) => {
            if (!row.logged_at) return;
            const raw = Array.isArray(row.logged_at) ? row.logged_at[0] : row.logged_at;
            const date = (raw as string).split('T')[0];
            dailyMap.set(date, (dailyMap.get(date) || 0) + (Number(row.quantity) || 0) * 250);
        });
    }

    return Array.from(dailyMap.entries())
        .map(([date, totalWater]) => ({ date, totalWater }))
        .sort((a, b) => a.date.localeCompare(b.date));
}

// ── Body metrics (field: `weight` — confirmed in progressService.mapBodyMetric) ──

async function fetchWeightData(userId: string, startDate: string, endDate: string): Promise<{ trend: DailyWeight[], baseline: DailyWeight | null, absoluteStart: DailyWeight | null }> {
    // 1. Fetch range data
    const rangeReq = (supabase as any)
        .from('body_metrics')
        .select('date, weight')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

    // 2. Fetch baseline (latest weight BEFORE startDate)
    const baselineReq = (supabase as any)
        .from('body_metrics')
        .select('date, weight')
        .eq('user_id', userId)
        .lt('date', startDate)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();

    // 3. Fetch absolute start (first weight EVER)
    const absoluteStartReq = (supabase as any)
        .from('body_metrics')
        .select('date, weight')
        .eq('user_id', userId)
        .order('date', { ascending: true })
        .limit(1)
        .maybeSingle();

    const [rangeRes, baselineRes, absoluteStartRes] = await Promise.all([rangeReq, baselineReq, absoluteStartReq]);

    if (rangeRes.error) {
        console.error('[MyReport] body_metrics error:', rangeRes.error.message);
        return { trend: [], baseline: null, absoluteStart: null };
    }

    const trendMap = new Map<string, number>();
    (rangeRes.data || []).forEach((row: any) => {
        if (row.weight != null) trendMap.set(row.date, Number(row.weight));
    });

    const trend = Array.from(trendMap.entries())
        .map(([date, weight]) => ({ date, weight }))
        .sort((a, b) => a.date.localeCompare(b.date));

    let baseline: DailyWeight | null = null;
    if (baselineRes.data && baselineRes.data.weight != null) {
        baseline = { date: baselineRes.data.date, weight: Number(baselineRes.data.weight) };
    }

    let absoluteStart: DailyWeight | null = null;
    if (absoluteStartRes.data && absoluteStartRes.data.weight != null) {
        absoluteStart = { date: absoluteStartRes.data.date, weight: Number(absoluteStartRes.data.weight) };
    }

    return { trend, baseline, absoluteStart };
}

// ── Goals (confirmed field names from nutritionService + mapFitnessGoal) ───

async function fetchGoals(userId: string): Promise<{
    dailyCalorieGoal: number;
    dailyProteinGoal: number;
    dailyCarbsGoal: number;
    dailyFatsGoal: number;
    startingWeight: number | null;
    startingDate: string | null;
} | null> {
    const { data, error } = await (supabase as any)
        .from('user_fitness_goals')
        .select('daily_calorie_goal, daily_protein_goal, daily_carbs_goal, daily_fats_goal, starting_weight, starting_date')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error || !data) return null;

    return {
        dailyCalorieGoal: Number(data.daily_calorie_goal) || 2000,
        dailyProteinGoal: Number(data.daily_protein_goal) || 150,
        dailyCarbsGoal: Number(data.daily_carbs_goal) || 200,
        dailyFatsGoal: Number(data.daily_fats_goal) || 60,
        startingWeight: data.starting_weight ? Number(data.starting_weight) : null,
        startingDate: data.starting_date || null,
    };
}

// ── User metrics for BMI and fallback weight ────────────────────────────────

async function fetchProfileMetrics(userId: string): Promise<{ height: number; weight: number; targetWeight: number }> {
    const { data } = await (supabase as any)
        .from('users')
        .select('height, weight, target_weight')
        .eq('id', userId)
        .single();

    let h = Number(data?.height) || 0;
    let w = Number(data?.weight) || 0;
    let target = Number(data?.target_weight) || 0;
    // Guard: if stored in metres (<3) convert to cm
    if (h > 0 && h < 3) h = h * 100;
    return { height: h, weight: w, targetWeight: target };
}

// ── Streaks (mirrors progressService.getStreaks + mapUserStreak) ────────────

async function fetchStreaks(userId: string): Promise<{
    nutritionCurrent: number;
    nutritionLongest: number;
    waterCurrent: number;
    waterLongest: number;
}> {
    const { data, error } = await (supabase as any)
        .from('user_streaks')
        .select('streak_type, current_streak, longest_streak')
        .eq('user_id', userId);

    const result = { nutritionCurrent: 0, nutritionLongest: 0, waterCurrent: 0, waterLongest: 0 };
    if (error || !data) return result;

    data.forEach((row: any) => {
        if (row.streak_type === 'nutrition_log') {
            result.nutritionCurrent = Number(row.current_streak) || 0;
            result.nutritionLongest = Number(row.longest_streak) || 0;
        }
        if (row.streak_type === 'water_intake') {
            result.waterCurrent = Number(row.current_streak) || 0;
            result.waterLongest = Number(row.longest_streak) || 0;
        }
    });

    return result;
}

// ── Streak computation from raw daily data (fallback when DB streak is 0) ──

function computeStreakFromDates(sortedDates: string[]): { current: number; longest: number } {
    if (sortedDates.length === 0) return { current: 0, longest: 0 };

    const today = format(new Date(), 'yyyy-MM-dd');
    const dateSet = new Set(sortedDates);

    // Longest streak
    let longest = 0;
    let streak = 1;
    const allSorted = [...sortedDates].sort();
    for (let i = 1; i < allSorted.length; i++) {
        const prev = new Date(allSorted[i - 1]);
        const curr = new Date(allSorted[i]);
        const gap = differenceInDays(curr, prev);
        if (gap === 1) {
            streak++;
            longest = Math.max(longest, streak);
        } else if (gap > 1) {
            streak = 1;
        }
    }
    if (allSorted.length === 1) longest = 1;

    // Current streak (working backwards from today)
    let current = 0;
    for (let i = 0; i < 400; i++) {
        const checkDate = format(subDays(new Date(), i), 'yyyy-MM-dd');
        if (dateSet.has(checkDate)) {
            current++;
        } else if (i === 0) {
            // Today not logged yet — still possible to extend streak
            continue;
        } else {
            break;
        }
    }

    return { current, longest: Math.max(longest, current) };
}

// ── Metric computations ────────────────────────────────────────────────────

function computeConsistency(
    nutrition: DailyNutrition[],
    calorieGoal: number,
    totalDays: number,
    streaks: { nutritionCurrent: number; nutritionLongest: number }
): ConsistencyMetrics {
    const TOLERANCE = 0.1; // ±10% of goal (more forgiving than ±5%)
    const lower = calorieGoal * (1 - TOLERANCE);
    const upper = calorieGoal * (1 + TOLERANCE);

    const daysGoalHit = nutrition.filter(d => d.totalCalories >= lower && d.totalCalories <= upper).length;
    const daysLogged = nutrition.length;
    const goalHitRate = totalDays > 0 ? Math.round((daysGoalHit / totalDays) * 100) : 0;
    const loggingRate = totalDays > 0 ? Math.round((daysLogged / totalDays) * 100) : 0;

    // Prefer DB streaks; fall back to computed
    let { current, longest } = computeStreakFromDates(nutrition.map(d => d.date));
    const currentStreak = streaks.nutritionCurrent > 0 ? streaks.nutritionCurrent : current;
    const longestStreak = Math.max(streaks.nutritionLongest, longest);

    let insight = '';
    if (daysLogged === 0) {
        insight = 'No nutrition data logged in this period.';
    } else if (goalHitRate >= 80) {
        insight = `You hit your calorie goal ${daysGoalHit} out of ${totalDays} days — excellent consistency.`;
    } else if (goalHitRate >= 50) {
        insight = `${daysGoalHit} of ${totalDays} days on target. Tighten your logging habits to improve.`;
    } else {
        insight = `Logged ${daysLogged}/${totalDays} days, goal hit ${daysGoalHit} times. Every logged day counts.`;
    }

    return { goalHitRate, loggingRate, currentStreak, longestStreak, totalDaysInRange: totalDays, daysLogged, daysGoalHit, insight };
}

function computeNutrition(
    nutrition: DailyNutrition[],
    goals: { dailyCalorieGoal: number; dailyProteinGoal: number; dailyCarbsGoal: number; dailyFatsGoal: number },
    totalDays: number
): NutritionMetrics {
    const empty: NutritionMetrics = {
        avgProtein: 0, avgCarbs: 0, avgFats: 0, avgCalories: 0,
        calorieGoal: goals.dailyCalorieGoal,
        proteinGoal: goals.dailyProteinGoal,
        carbsGoal: goals.dailyCarbsGoal,
        fatsGoal: goals.dailyFatsGoal,
        macroStabilityScore: 0, calorieAdherenceTrend: [],
        proteinTrend: [], carbsTrend: [], fatsTrend: [],
        insight: 'No nutrition data available for this period.',
    };

    if (nutrition.length === 0) return empty;

    const n = nutrition.length;
    const loggingRate = totalDays > 0 ? n / totalDays : 0;

    const avgCalories = Math.round(nutrition.reduce((s, d) => s + d.totalCalories, 0) / n);
    const avgProtein = Math.round(nutrition.reduce((s, d) => s + d.totalProtein, 0) / n);
    const avgCarbs = Math.round(nutrition.reduce((s, d) => s + d.totalCarbs, 0) / n);
    const avgFats = Math.round(nutrition.reduce((s, d) => s + d.totalFats, 0) / n);

    const calorieStab = stabilityScore(nutrition.map(d => d.totalCalories), goals.dailyCalorieGoal);

    // Penalize stability score severely for unlogged days
    const macroStabilityScore = Math.round(calorieStab * loggingRate);

    const calorieAdherenceTrend = nutrition.map(d => ({
        date: d.date,
        hit: d.totalCalories,
        goal: goals.dailyCalorieGoal,
    }));
    const proteinTrend = nutrition.map(d => ({
        date: d.date,
        hit: d.totalProtein,
        goal: goals.dailyProteinGoal,
    }));
    const carbsTrend = nutrition.map(d => ({
        date: d.date,
        hit: d.totalCarbs,
        goal: goals.dailyCarbsGoal,
    }));
    const fatsTrend = nutrition.map(d => ({
        date: d.date,
        hit: d.totalFats,
        goal: goals.dailyFatsGoal,
    }));

    const diff = avgCalories - goals.dailyCalorieGoal;
    let insight = '';
    if (loggingRate < 0.25) {
        insight = `You've only logged ${n} days, averaging ${avgCalories} kcal. Log more days to see a true trend.`;
    } else if (macroStabilityScore >= 75) {
        insight = `Very consistent intake. Avg ${avgCalories} kcal daily — stability score ${macroStabilityScore}/100.`;
    } else if (avgProtein < goals.dailyProteinGoal * 0.8) {
        insight = `Avg protein ${avgProtein}g is below your ${goals.dailyProteinGoal}g target. Increase protein-rich foods.`;
    } else if (diff > 200) {
        insight = `Averaging ${avgCalories} kcal — ${Math.abs(diff)} kcal above your ${goals.dailyCalorieGoal} goal.`;
    } else if (diff < -200) {
        insight = `Averaging ${avgCalories} kcal — ${Math.abs(diff)} kcal below your ${goals.dailyCalorieGoal} goal.`;
    } else {
        insight = `Avg ${avgCalories} kcal — ${avgProtein}g protein, ${avgCarbs}g carbs, ${avgFats}g fats per day.`;
    }

    return {
        avgProtein, avgCarbs, avgFats, avgCalories,
        calorieGoal: goals.dailyCalorieGoal,
        proteinGoal: goals.dailyProteinGoal,
        carbsGoal: goals.dailyCarbsGoal,
        fatsGoal: goals.dailyFatsGoal,
        macroStabilityScore, calorieAdherenceTrend, proteinTrend, carbsTrend, fatsTrend, insight,
    };
}

function computeBodyMetrics(
    weightResult: { trend: DailyWeight[], baseline: DailyWeight | null, absoluteStart: DailyWeight | null },
    userHeight: number,
    baselineWeight: number,
    targetWeight: number,
    startingWeightFromGoal: number | null,
    startingDateFromGoal: string | null,
    nutritionDaysLogged: number,
    totalDays: number
): BodyMetrics {
    let weightData = [...weightResult.trend];

    // The "Start Weight" should be the official starting weight from the user's goal
    // if available. This provides a stable baseline even if no logs exist.
    const goalStart: DailyWeight | null = (startingWeightFromGoal && startingDateFromGoal)
        ? { date: startingDateFromGoal, weight: startingWeightFromGoal }
        : null;

    // Combined baseline logic: Prioritize Goal Start -> Baseline right before range -> First Log ever
    const startBaseline = goalStart || weightResult.baseline || weightResult.absoluteStart;

    // Prepend start point to trend if it's not already there and it's physically EARLIER
    if (startBaseline && (weightData.length === 0 || weightData[0].date > startBaseline.date)) {
        weightData.unshift(startBaseline);
    }

    // Ensure the CURRENT weight from the profile is represented in the trend 
    // This anchors the "Current" stat to the official profile weight.
    const today = format(new Date(), 'yyyy-MM-dd');
    if (baselineWeight > 0 && (weightData.length === 0 || weightData[weightData.length - 1].date < today)) {
        weightData.push({ date: today, weight: baselineWeight });
    }

    const bmiTrend: DailyBMI[] = [];
    if (userHeight > 0) {
        weightData.forEach(w => {
            const bmi = calculateBMI(w.weight, userHeight);
            if (bmi !== null) bmiTrend.push({ date: w.date, bmi });
        });
    }

    const startWeight = startBaseline ? startBaseline.weight : (weightData.length > 0 ? weightData[0].weight : (baselineWeight > 0 ? baselineWeight : null));
    
    // Priority: Profile Weight (baselineWeight) -> Latest Log
    const endWeight = baselineWeight > 0 ? baselineWeight : (weightResult.trend.length > 0 ? weightResult.trend[weightResult.trend.length - 1].weight : null);

    const startBMI = startWeight && userHeight > 0 ? Number(calculateBMI(startWeight, userHeight)) : null;
    const endBMI = endWeight && userHeight > 0 ? Number(calculateBMI(endWeight, userHeight)) : null;

    const weightChange = (startWeight !== null && endWeight !== null)
        ? Math.round((endWeight - startWeight) * 10) / 10 : null;
    const bmiChange = (startBMI !== null && endBMI !== null)
        ? Math.round((endBMI - startBMI) * 10) / 10 : null;

    // Plateau: 2+ consecutive weeks of <0.3kg movement
    let plateauDetected = false;
    let plateauWeeks = 0;

    if (weightData.length >= 4) {
        const weekMap: Record<number, number> = {};
        const first = new Date(weightData[0].date);
        weightData.forEach(w => {
            const wk = Math.floor(differenceInDays(new Date(w.date), first) / 7);
            weekMap[wk] = w.weight; // latest per week
        });

        const weeks = Object.keys(weekMap).map(Number).sort((a, b) => a - b);
        let flat = 0;
        for (let i = 1; i < weeks.length; i++) {
            const diff = Math.abs((weekMap[weeks[i]] || 0) - (weekMap[weeks[i - 1]] || 0));
            if (diff < 0.3) { flat++; } else { flat = 0; }
        }
        // Only call it a plateau if they were actively logging food
        if (flat >= 2 && nutritionDaysLogged >= totalDays * 0.4) {
            plateauDetected = true;
            plateauWeeks = flat;
        }
    }

    let insight = '';
    if (weightData.length === 0) {
        insight = baselineWeight > 0
            ? `Current weight is ${baselineWeight}kg. Log a new weight to see your trend line.`
            : 'No weight data recorded. Log your weight to see trends.';
    } else if (plateauDetected) {
        insight = `Weight has plateaued for ${plateauWeeks}+ weeks despite consistent nutrition logging.`;
    } else if (weightChange !== null && weightChange < -0.5) {
        insight = `You lost ${Math.abs(weightChange)}kg this period. Trajectory is trending down.`;
    } else if (weightChange !== null && weightChange > 0.5) {
        insight = `You gained ${weightChange}kg this period. Check if this aligns with your goal.`;
    } else if (weightChange !== null) {
        insight = `Weight changed by ${weightChange > 0 ? '+' : ''}${weightChange}kg — relatively stable.`;
    } else {
        insight = 'Need at least 2 weight entries to show a trend.';
    }

    return { weightTrend: weightData, bmiTrend, startWeight, endWeight, startBMI, endBMI, weightChange, bmiChange, goalWeight: targetWeight > 0 ? targetWeight : null, plateauDetected, plateauWeeks, insight };
}

function computeHydration(
    waterData: DailyWater[],
    totalDays: number,
    streaks: { waterCurrent: number; waterLongest: number }
): HydrationMetrics {
    const WATER_GOAL_ML = 2000;

    if (waterData.length === 0) {
        return {
            waterGoalHitRate: 0, waterConsistencyRate: 0,
            currentStreak: 0, longestStreak: 0, weeklyAverageWater: 0,
            dailyWater: [],
            insight: 'No water intake logged for this period.',
        };
    }

    const daysHit = waterData.filter(d => d.totalWater >= WATER_GOAL_ML).length;
    const waterGoalHitRate = totalDays > 0 ? Math.round((daysHit / totalDays) * 100) : 0;
    const waterConsistencyRate = totalDays > 0 ? Math.round((waterData.length / totalDays) * 100) : 0;

    const totalWater = waterData.reduce((s, d) => s + d.totalWater, 0);
    const weeks = Math.max(1, Math.ceil(totalDays / 7));
    const weeklyAverageWater = Math.round(totalWater / weeks);

    // Computed streaks fallback
    const { current, longest } = computeStreakFromDates(waterData.map(d => d.date));
    const currentStreak = streaks.waterCurrent > 0 ? streaks.waterCurrent : current;
    const longestStreak = Math.max(streaks.waterLongest, longest);

    const avgDaily = Math.round(totalWater / waterData.length);
    let insight = '';
    if (waterGoalHitRate >= 80) {
        insight = `You hit 2L on ${daysHit} out of ${totalDays} days. Great hydration discipline.`;
    } else if (waterConsistencyRate >= 50) {
        insight = `You logged water on ${waterData.length}/${totalDays} days, avg ${avgDaily}ml daily.`;
    } else {
        insight = `Water tracked ${waterData.length}/${totalDays} days. Log more consistently to reveal your pattern.`;
    }

    return { waterGoalHitRate, waterConsistencyRate, currentStreak, longestStreak, weeklyAverageWater, dailyWater: waterData, insight };
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function getReportData(userId: string, range: ReportRange): Promise<ReportData> {
    const cacheKey = `${userId}::${range}`;
    const cached = reportCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
        return cached.data;
    }

    const endDate = format(new Date(), 'yyyy-MM-dd');
    const startDate = getStartDate(range);
    const totalDays = getRangeDays(range);

    console.log(`[MyReport] Fetching range=${range} from ${startDate} to ${endDate}`);

    // All fetches in parallel
    const [nutrition, water, weight, goals, profileMetrics, streaks] = await Promise.all([
        fetchNutritionLogs(userId, startDate, endDate),
        fetchWaterLogs(userId, startDate, endDate),
        fetchWeightData(userId, startDate, endDate),
        fetchGoals(userId),
        fetchProfileMetrics(userId),
        fetchStreaks(userId),
    ]);

    console.log(`[MyReport] Results: nut=${nutrition.length} water=${water.length} weight=${weight.trend.length} goals=${JSON.stringify(goals)}`);

    const effectiveGoals = goals ?? {
        dailyCalorieGoal: 2000,
        dailyProteinGoal: 150,
        dailyCarbsGoal: 200,
        dailyFatsGoal: 60,
        startingWeight: null,
        startingDate: null,
    };

    const consistency = computeConsistency(nutrition, effectiveGoals.dailyCalorieGoal, totalDays, streaks);
    const nutritionMetrics = computeNutrition(nutrition, effectiveGoals, totalDays);
    const body = computeBodyMetrics(weight, profileMetrics.height, profileMetrics.weight, profileMetrics.targetWeight, effectiveGoals.startingWeight, effectiveGoals.startingDate, nutrition.length, totalDays);
    const hydration = computeHydration(water, totalDays, streaks);

    const hasData = nutrition.length > 0 || water.length > 0 || weight.trend.length > 0;

    const result: ReportData = {
        consistency, nutrition: nutritionMetrics, body, hydration,
        range, startDate, endDate, hasData,
    };

    reportCache.set(cacheKey, { data: result, ts: Date.now() });
    return result;
}
