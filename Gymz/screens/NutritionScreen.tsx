import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Modal,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Alert,
    Image,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../services/supabase';
import { nutritionService, NutritionLog, MacroTargets } from '../services/nutritionService';
import { DataMapper } from '../utils/dataMapper';

// Components
import { PlanOverview } from '../components/nutrition/PlanOverview';
import { MealCard } from '../components/nutrition/MealCard';
import { DailySummary } from '../components/nutrition/DailySummary';
import { FoodScanner } from '../components/nutrition/FoodScanner';
import { GoalTipCard } from '../components/nutrition/GoalTipCard';
import { ScreenHeader } from '../components/ScreenHeader';
import { ManualLogModal } from '../components/nutrition/ManualLogModal';
import { FeatureLimitModal } from '../components/membership/FeatureLimitModal';
import { DynamicBackground } from '../components/dashboard/DynamicBackground';
import { ProteinNudgeCard } from '../components/nutrition/ProteinNudgeCard';
import { MealSuggestionModal } from '../components/nutrition/MealSuggestionModal';
import { SmartCoachCard } from '../components/nutrition/SmartCoachCard';
import { getUserMemory } from '../services/aiChat';
import { useCoachCharacter } from '../contexts/CoachCharacterContext';
import { nutritionAIService } from '../services/nutritionAIService';
import { designSystem } from '../theme/designSystem';
const TAB_BAR_CLEARANCE = 80; // Space for floating tab bar (root handles nav bar inset)

export default function NutritionScreen({ navigation }: any) {
    const { user, isEventMember } = useAuth();
    const { theme } = useTheme();
    const coachChar = useCoachCharacter();
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showManualLog, setShowManualLog] = useState(false);
    const [showLimitModal, setShowLimitModal] = useState(false);
    const [limitModalConfig, setLimitModalConfig] = useState<any>({});
    const [suggestedMealType, setSuggestedMealType] = useState<string | null>(null);
    const [userMemory, setUserMemory] = useState<any>(null);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [aiFeedback, setAiFeedback] = useState<string | null>(null);
    const [isAIThinking, setIsAIThinking] = useState(false);
    const initialMount = useRef(true);


    const [logs, setLogs] = useState<NutritionLog[]>([]);
    const [targets, setTargets] = useState<MacroTargets>({
        userId: user?.id || '',
        dailyCalorieGoal: 1800,
        dailyProteinGoal: 150,
        dailyCarbsGoal: 150,
        dailyFatsGoal: 50,
        dailyFiberGoal: 30,
        date: new Date().toISOString().split('T')[0],
    });

    const [waterLogs, setWaterLogs] = useState(0);

    // Ref to track active water log requests to prevent server state from overwriting optimistic state
    const pendingWaterRequests = React.useRef(0);

    const fetchData = async () => {
        if (!user?.id) {
            console.log('[NutritionScreen] No user ID, skipping fetch');
            return;
        }

        try {
            const today = new Date().toISOString().split('T')[0];
            console.log(`[NutritionScreen] Parallel Fetching for User: ${user.id}, Date: ${today}`);

            // Parallelize all network requests to improve startup speed
            const [logsResult, targetsResult, waterResult] = await Promise.allSettled([
                nutritionService.fetchDailyLogs(user.id, today),
                nutritionService.getMacroTargets(user.id, today),
                nutritionService.fetchWaterIntake(user.id, today)
            ]);

            // Handle Logs
            if (logsResult.status === 'fulfilled') {
                const logsData = logsResult.value;
                const realLogs = logsData.filter(l => l.foodName !== 'Water Intake');
                setLogs(realLogs);
            } else {
                console.error('[NutritionScreen] Logs fetch failed:', logsResult.reason);
            }

            // Handle Targets
            if (targetsResult.status === 'fulfilled') {
                if (targetsResult.value) {
                    setTargets(targetsResult.value);
                }
            } else {
                console.warn('[NutritionScreen] Targets fetch specific error:', targetsResult.reason);
            }

            // Handle Water
            if (waterResult.status === 'fulfilled') {
                if (pendingWaterRequests.current === 0) {
                    setWaterLogs(waterResult.value);
                }
            } else {
                console.error('[NutritionScreen] Water fetch failed:', waterResult.reason);
            }

            // Fetch Latest AI Feedback
            const feedback = await nutritionAIService.getTodayFeedback(user.id);
            setAiFeedback(feedback);

        } catch (error: any) {
            console.error('[NutritionScreen] Global fetch error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();

        // Check for navigation params (autoLog)
        const params = (navigation.getState()?.routes.find((r: any) => r.name === 'Nutrition')?.params);
        if (params?.autoLog) {
            const mealType = params.autoLog.toLowerCase();
            setSuggestedMealType(mealType);
            // Scan logic moved to dedicated screen, Navigate here?
            navigation.navigate('FoodScanner', { mealType });
            navigation.setParams({ autoLog: null }); // Clear for next time
        }

        if (params?.scannedFoodItem) {
            const item = params.scannedFoodItem;
            // Clear params
            navigation.setParams({ scannedFoodItem: null });

            // Open Manual Log with pre-filled data or directly log?
            // Let's open Manual Log Modal with pre-filled data for confirmation/editing
            setTimeout(() => {
                // We need to pass this data to ManualLogModal. 
                // Currently ManualLogModal doesn't seem to accept initialData explicitly in props visible here,
                // but we can add a state for it or handle it via a new specific modal or just log it if confident.

                // For better UX, let's auto-fill the manual log modal:
                // We need to modify ManualLogModal or use a new state 'initialLogData'

                // Let's use a simpler approach for now: Immediate Confirm Dialog or just log it?
                // The implementation plan said: "Handle the return params... to pre-fill the manual entry form or auto-log"

                Alert.alert(
                    'Scanned Item',
                    `Found: ${item.name}\n${item.calories} kcal, ${item.protein}g protein`,
                    [
                        { text: 'Cancel', style: 'cancel' },
                        {
                            text: 'Log It',
                            onPress: () => {
                                handleLogMeal({
                                    foodName: item.name,
                                    calories: item.calories,
                                    protein: item.protein,
                                    carbs: item.carbs,
                                    fats: item.fats || item.fat,
                                    mealType: suggestedMealType || 'snack',
                                    quantity: 1,
                                    loggedAt: new Date().toISOString(),
                                    imageUrl: item.imageUrl
                                });
                            }
                        }
                    ]
                );
            }, 500);
        }

        if (!user?.id) return;
        getUserMemory(user.id).then(setUserMemory);

        const channel = (supabase as any)
            .channel('nutrition_logs_realtime')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'daily_nutrition_logs',
                    filter: `user_id=eq.${user.id}`
                },
                () => {
                    // Only refetch if we aren't sending water updates
                    if (pendingWaterRequests.current === 0) {
                        fetchData();
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'water_logs',
                    filter: `user_id=eq.${user.id}`
                },
                () => {
                    console.log('[NutritionScreen] Real-time update from water_logs table!');
                    if (pendingWaterRequests.current === 0) {
                        fetchData();
                    }
                }
            )
            .subscribe();

        return () => {
            (supabase as any).removeChannel(channel);
        };
        if (initialMount.current) {
            initialMount.current = false;
        }
    }, [user?.id]);


    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const handleLogMeal = async (mealData: any) => {
        console.log('[NutritionScreen] handleLogMeal triggering for:', mealData.foodName);
        if (!user?.id) {
            console.error('[NutritionScreen] No user ID in handleLogMeal');
            Alert.alert('Error', 'Session lost. Please log in again.');
            return;
        }
        try {
            const result = await nutritionService.logMeal({
                ...mealData,
                userId: user.id,
            });
            console.log('[NutritionScreen] logMeal success:', result);

            // Trigger AI Feedback Loop (Background)
            setIsAIThinking(true);
            nutritionAIService.generateFeedback(user.id, mealData.foodName)
                .then(feedback => {
                    setAiFeedback(feedback);
                    setIsAIThinking(false);
                })
                .catch(() => setIsAIThinking(false));

            fetchData();
            Alert.alert('Success', 'Meal logged successfully!');
        } catch (error: any) {
            console.error('[NutritionScreen] logMeal failed:', error);
            Alert.alert('Error', `Failed to log meal: ${error.message || 'Unknown error'}`);
        }
    };

    const handleAddWater = async (count: number) => {
        if (!user?.id) {
            Alert.alert('Error', 'User session not found.');
            return;
        }

        // 1. Calculate diff
        const diff = count - waterLogs;
        console.log(`[NutritionScreen] Water Update: ${waterLogs} -> ${count} (Diff: ${diff})`);

        // 2. Optimistic Update
        setWaterLogs(count);

        if (Platform.OS !== 'web') {
            import('expo-haptics').then(Haptics => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            });
        }

        // 3. Send Request Immediately (No Debounce)
        pendingWaterRequests.current += 1;

        try {
            const todayDate = new Date().toISOString().split('T')[0];
            await nutritionService.logWaterIntake(user.id, diff, todayDate);
            console.log('[NutritionScreen] Water log saved.');
        } catch (error: any) {
            console.error('[NutritionScreen] Failed to save water:', error);
            // Rollback optimistic update
            setWaterLogs(prev => prev - diff);
            Alert.alert('Sync Error', 'Failed to save water intake.');
        } finally {
            pendingWaterRequests.current -= 1;
            // Reconciliation: Sync with server once all optimistic updates finish
            if (pendingWaterRequests.current === 0) {
                fetchData();
            }
        }
    };

    const handleCompleteDay = () => {
        const eatenCalories = logs.reduce((sum, log) => sum + (Number(log.calories) || 0), 0);
        const eatenProtein = logs.reduce((sum, log) => sum + (Number(log.protein) || 0), 0);

        // Simple logic for now: Check if within range
        const calorieDiff = Math.abs(targets.dailyCalorieGoal - eatenCalories);
        const proteinDiff = Math.abs(targets.dailyProteinGoal - eatenProtein);

        let title = "Day Complete!";
        let message = "Great job tracking your nutrition today.";

        if (calorieDiff < 200 && proteinDiff < 20) {
            title = "🎉 Perfect Day!";
            message = "You hit your calorie and protein goals perfectly! Great consistency.";
        } else if (eatenCalories < targets.dailyCalorieGoal * 0.5) {
            title = "Log Incomplete?";
            message = "You seem to be way under your calorie goal. Did you forget to log dinner?";
        }

        Alert.alert(title, message);
    };

    const eatenCalories = logs.reduce((sum, log) => sum + (Number(log.calories) || 0), 0);
    const eatenProtein = logs.reduce((sum, log) => sum + (Number(log.protein) || 0), 0);
    const eatenCarbs = logs.reduce((sum, log) => sum + (Number(log.carbs) || 0), 0);
    const eatenFat = logs.reduce((sum, log) => sum + (Number(log.fats) || 0), 0);
    const eatenFiber = logs.reduce((sum, log) => sum + (Number((log as any).fiber) || 0), 0);
    const fiberGoal = Number(targets.dailyFiberGoal) || 30;

    if (loading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading Nutrition...</Text>
            </View>
        );
    }



    const handleScanPress = async () => {
        if (!user?.id) return;

        // Wake the AI bubble as soon as the user taps the Scan button in the header
        coachChar?.fireMealScanStarted();

        // Directly navigate to dedicated FoodScanner screen
        navigation.navigate('FoodScanner', { mealType: suggestedMealType || 'lunch' });
    };



    return (
        <View style={styles.container}>
            <DynamicBackground rotationType="fixed" fixedIndex={5} pointerEvents="none" />
            <ScreenHeader
                title="Nutrition Guide"
            />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: TAB_BAR_CLEARANCE + 70 }]}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
            >
                {/* Plan Overview */}
                <PlanOverview
                    targets={{
                        calories: targets.dailyCalorieGoal,
                        protein: targets.dailyProteinGoal,
                        carbs: targets.dailyCarbsGoal,
                        fats: targets.dailyFatsGoal,
                        fiber: fiberGoal,
                    }}
                    eaten={{
                        protein: Number(eatenProtein) || 0,
                        carbs: Number(eatenCarbs) || 0,
                        fats: Number(eatenFat) || 0,
                        fiber: Number(eatenFiber) || 0,
                    }}
                />

                {/* Daily Summary */}
                <DailySummary
                    eaten={eatenCalories}
                    goal={targets.dailyCalorieGoal}
                    macros={{
                        protein: { eaten: eatenProtein, goal: targets.dailyProteinGoal || 0 },
                        carbs: { eaten: eatenCarbs, goal: targets.dailyCarbsGoal || 0 },
                        fats: { eaten: eatenFat, goal: targets.dailyFatsGoal || 0 }
                    }}
                    waterCups={waterLogs}
                    onAddWater={handleAddWater}
                    onCompleteDay={handleCompleteDay}
                    aiFeedback={aiFeedback}
                    isAIThinking={isAIThinking}
                />

                <ProteinNudgeCard
                    current={Number(eatenProtein) || 0}
                    goal={targets.dailyProteinGoal}
                    userMemory={userMemory}
                    onPress={() => setShowManualLog(true)}
                />

                <SmartCoachCard
                    feedback={aiFeedback}
                    isLoading={isAIThinking}
                />

                {/* Goal Advice */}
                <GoalTipCard />

                {/* Meals Feed */}
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Today's Logs</Text>
                    {logs.length === 0 && (
                        <Text style={styles.emptyText}>No meals logged today yet.</Text>
                    )}
                </View>

                {logs.map((log, index) => (
                    <MealCard
                        key={log.logId || index}
                        type={!log.mealType ? 'Afternoon Snack' : (log.mealType.toLowerCase() === 'snack' ? 'Afternoon Snack' : (log.mealType.charAt(0).toUpperCase() + log.mealType.slice(1))) as any}
                        time={new Date(log.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        name={log.foodName}
                        portion={`${log.quantity} unit`}
                        calories={log.calories}
                        macros={{
                            protein: log.protein,
                            carbs: log.carbs,
                            fat: log.fats
                        }}
                        imageUri={log.imageUrl || `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=200&h=100`} // Use a static high-performing Unsplash placeholder instead of a search URL

                        isLogged={true}
                    />
                ))}


            </ScrollView>

            <View style={styles.floatingActionBar}>
                <TouchableOpacity
                    style={styles.secondaryActionBtn}
                    onPress={() => setShowManualLog(true)}
                    activeOpacity={0.9}
                >
                    <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
                    <Text style={[styles.secondaryActionText, { color: theme.primary }]}>Log</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.primaryActionBtn}
                    onPress={handleScanPress}
                    activeOpacity={0.9}
                >
                    <LinearGradient
                        colors={['#2A4B2A', '#F1C93B']}
                        style={styles.primaryActionGradient}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                    >
                        <MaterialCommunityIcons name="camera" size={18} color="#FFF" />
                        <Text style={styles.primaryActionText}>Scan</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            {/* Manual Log Modal */}
            <ManualLogModal
                visible={showManualLog}
                onClose={() => {
                    setShowManualLog(false);
                    setSuggestedMealType(null);
                }}
                onLog={handleLogMeal}
                initialMealType={(suggestedMealType as any) || 'breakfast'}
            />



            <MealSuggestionModal
                visible={showSuggestions}
                onClose={() => setShowSuggestions(false)}
                userId={user?.id || ''}
                onMealLogged={fetchData}
                remainingMacros={{
                    calories: targets.dailyCalorieGoal - eatenCalories,
                    protein: targets.dailyProteinGoal - eatenProtein,
                    carbs: targets.dailyCarbsGoal - eatenCarbs,
                    fats: targets.dailyFatsGoal - eatenFat,
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    loadingText: {
        fontSize: 16,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    floatingActionBar: {
        position: 'absolute',
        right: 16,
        left: 16,
        bottom: 84,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
        padding: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        zIndex: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 14,
        elevation: 8,
    },
    secondaryActionBtn: {
        height: 44,
        minWidth: 110,
        borderRadius: 14,
        backgroundColor: 'rgba(42,75,42,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(42,75,42,0.2)',
        paddingHorizontal: 14,
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'center',
        alignItems: 'center',
    },
    secondaryActionText: {
        fontSize: 14,
        fontWeight: '700',
    },
    suggestionButton: {
        marginLeft: 8,
    },
    suggestionButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
    },
    suggestionButtonText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '700',
    },
    primaryActionBtn: {
        borderRadius: 14,
        overflow: 'hidden',
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryActionGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 44,
        minWidth: 130,
        paddingHorizontal: 16,
        justifyContent: 'center',
    },
    primaryActionText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 14,
    },
    prescriptiveCard: {
        marginTop: 16,
        borderRadius: 24,
        overflow: 'hidden',
        ...designSystem.shadows.lg,
    },
    prescriptiveGradient: {
        padding: 16,
    },
    prescriptiveContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    prescriptiveIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    prescriptiveTextContainer: {
        flex: 1,
    },
    prescriptiveTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '900',
    },
    prescriptiveSubtitle: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        fontWeight: '600',
        lineHeight: 16,
        marginTop: 4,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    gateContent: {
        paddingHorizontal: 30,
        paddingTop: 60,
        paddingBottom: 40,
        alignItems: 'center',
    },
    gateIconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        overflow: 'hidden',
        marginBottom: 30,
        ...designSystem.shadows.lg,
    },
    gateIconGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    gateTitle: {
        fontSize: 28,
        fontWeight: '900',
        color: '#FFF',
        textAlign: 'center',
        marginBottom: 16,
    },
    gateSubtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 40,
        paddingHorizontal: 10,
    },
    benefitList: {
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 24,
        padding: 24,
        marginBottom: 40,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    benefitItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    benefitText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '600',
    },
    gateButton: {
        width: '100%',
        height: 56,
        borderRadius: 28,
        overflow: 'hidden',
        ...designSystem.shadows.md,
        marginVertical: 10,
    },
    gateButtonGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    gateButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 1,
    },
    gateFooter: {
        marginTop: 20,
        color: 'rgba(255,255,255,0.3)',
        fontSize: 12,
        fontWeight: '600',
    },
    sectionHeader: {
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    emptyText: {
        color: '#6B7280',
        marginTop: 8,
        fontStyle: 'italic',
    },
});

