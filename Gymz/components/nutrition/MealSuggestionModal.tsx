import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    ActivityIndicator,
    Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { designSystem } from '../../theme/designSystem';
import { useAuth } from '../../hooks/useAuth';
import { mealSuggestionService, MealSuggestion, UserGoal } from '../../services/mealSuggestionService';
import { nutritionService } from '../../services/nutritionService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface MealSuggestionModalProps {
    visible: boolean;
    onClose: () => void;
    remainingMacros: {
        calories: number;
        protein: number;
        carbs: number;
        fats: number;
    };
    userId: string;
    onMealLogged?: () => void;
}

export const MealSuggestionModal: React.FC<MealSuggestionModalProps> = ({
    visible,
    onClose,
    remainingMacros,
    userId,
    onMealLogged,
}) => {
    const { theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const { user } = useAuth(); // Get user for goal context
    const [suggestions, setSuggestions] = useState<MealSuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [loggingId, setLoggingId] = useState<string | null>(null);
    const [mealType, setMealType] = useState<'Breakfast' | 'Lunch' | 'Dinner' | 'Snack'>('Breakfast');
    const [visibleCount, setVisibleCount] = useState(8);
    const [failedImageMealIds, setFailedImageMealIds] = useState<Record<string, boolean>>({});

    useEffect(() => {
        // Auto-select meal type based on current time
        const hour = new Date().getHours();
        if (hour < 11) setMealType('Breakfast');
        else if (hour < 16) setMealType('Lunch');
        else if (hour < 20) setMealType('Dinner');
        else setMealType('Snack');
    }, [visible]);

    useEffect(() => {
        if (visible) {
            setVisibleCount(8);
            loadSuggestions();
        }
    }, [visible, mealType, remainingMacros.calories, remainingMacros.protein, remainingMacros.carbs, remainingMacros.fats, user?.goal]);

    const MEAL_IMAGE_IDS = {
        grilledChickenPlate: 'O0KH4FOziVA',
        grilledChickenGreens: 'ij_WCukcyvg',
        oatmealBowl: 'fSrtZ0xu6cE',
        oatmealFruit: 'W9OKrxBqiZA',
        yogurtBerries: 'VOagvOf1dng',
        yogurtParfait: 'n_5shB7MSjU',
        fishVegPlate: '6hCfLFXDBwE',
        fishWhitePlate: '3ru16c1mSsU',
        salmonVegetables: '8iDNy37sp8E',
        wrapPlate: 'oPvhddPoS-E',
    } as const;

    const getMealImageId = (meal: MealSuggestion) => {
        const lower = meal.name.toLowerCase();

        if (lower.includes('yogurt') || lower.includes('verrine') || lower.includes('mabisi')) {
            return MEAL_IMAGE_IDS.yogurtBerries;
        }
        if (lower.includes('porridge') || lower.includes('oat') || lower.includes('muesli')) {
            return MEAL_IMAGE_IDS.oatmealBowl;
        }
        if (lower.includes('kapenta') || lower.includes('bream') || lower.includes('salmon') || lower.includes('fish') || lower.includes('tilapia') || lower.includes('prawn')) {
            return MEAL_IMAGE_IDS.fishVegPlate;
        }
        if (lower.includes('wrap')) {
            return MEAL_IMAGE_IDS.wrapPlate;
        }
        if (lower.includes('snack') || lower.includes('berries') || lower.includes('fruit')) {
            return MEAL_IMAGE_IDS.yogurtParfait;
        }
        if (lower.includes('nshima') || lower.includes('chicken') || lower.includes('beef') || lower.includes('goat') || lower.includes('turkey')) {
            return MEAL_IMAGE_IDS.grilledChickenPlate;
        }

        if (meal.mealType === 'breakfast') return MEAL_IMAGE_IDS.oatmealFruit;
        if (meal.mealType === 'snack') return MEAL_IMAGE_IDS.yogurtParfait;
        if (meal.mealType === 'dinner') return MEAL_IMAGE_IDS.salmonVegetables;
        return MEAL_IMAGE_IDS.grilledChickenGreens;
    };

    const getMealImageUri = (meal: MealSuggestion) =>
        `https://source.unsplash.com/${getMealImageId(meal)}/800x600`;

    const visibleSuggestions = suggestions.slice(0, visibleCount);
    const canLoadMore = visibleCount < suggestions.length;
    const modalMaxHeight = SCREEN_HEIGHT - Math.max(insets.top, 12) - 12;
    const modalBottomGap = Math.max(insets.bottom, 10);

    const normalizeGoal = (goalStr?: string | null): UserGoal => {
        if (!goalStr) return 'recomp';
        const lower = goalStr.toLowerCase();
        if (lower.includes('loss') || lower.includes('cut') || lower.includes('weight')) return 'lose_weight';
        if (lower.includes('gain') || lower.includes('muscle') || lower.includes('bulk')) return 'build_muscle';
        if (lower.includes('maintain') || lower.includes('recomp') || lower.includes('toning')) return 'recomp';
        return 'recomp';
    };

    const loadSuggestions = () => {
        setLoading(true);
        const userGoal = normalizeGoal(user?.goal);

        // Simulate a small delay for "AI thinking" feel
        setTimeout(() => {
            const results = mealSuggestionService.getSuggestions({
                remainingCalories: remainingMacros.calories,
                remainingProtein: remainingMacros.protein,
                remainingCarbs: remainingMacros.carbs,
                remainingFats: remainingMacros.fats,
                prioritizeProtein: true,
                mealType: mealType.toLowerCase() as any,
                userGoal: userGoal
            });
            setSuggestions(results);
            setLoading(false);
        }, 800);
    };

    const handleLogMeal = async (meal: MealSuggestion) => {
        setLoggingId(meal.id);
        try {
            await nutritionService.logMeal({
                userId: userId,
                foodName: meal.name,
                quantity: 1,
                calories: meal.calories,
                protein: meal.protein,
                carbs: meal.carbs,
                fats: meal.fats,
                mealType: mealType.toLowerCase() as any, // backend expects lowercase
                loggedAt: new Date().toISOString(),
            });

            if (onMealLogged) onMealLogged();
            onClose();
        } catch (error) {
            console.error('Error logging suggested meal:', error);
        } finally {
            setLoggingId(null);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <BlurView intensity={isDark ? 80 : 60} style={styles.blurContainer} tint={isDark ? "dark" : "light"}>
                <View
                    style={[
                        styles.modalContent,
                        {
                            backgroundColor: theme.background,
                            maxHeight: modalMaxHeight,
                            marginBottom: modalBottomGap,
                            paddingBottom: Math.max(insets.bottom, 14),
                        },
                    ]}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.backButtonStyle}>
                            <MaterialCommunityIcons name="chevron-left" size={28} color={theme.text} />
                        </TouchableOpacity>

                        <View style={styles.headerTitleArea}>
                            <Text style={[styles.title, { color: theme.text }]}>What Should I Eat?</Text>
                            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                                Plateau-breaker suggestions
                            </Text>
                        </View>

                        <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: 'rgba(0,0,0,0.05)' }]}>
                            <MaterialCommunityIcons name="close" size={20} color={theme.text} />
                        </TouchableOpacity>
                    </View>

                    {/* Meal Type Selector */}
                    <View style={styles.typeSelector}>
                        {(['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const).map((t) => (
                            <TouchableOpacity
                                key={t}
                                style={[
                                    styles.typeButton,
                                    mealType === t && { backgroundColor: theme.primary }
                                ]}
                                onPress={() => setMealType(t)}
                            >
                                <Text style={[
                                    styles.typeText,
                                    { color: mealType === t ? '#FFF' : theme.textMuted }
                                ]}>
                                    {t}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Remaining Macros Summary */}
                    <View style={[styles.macroStrip, { backgroundColor: theme.backgroundCard, borderColor: theme.border }]}>
                        <MacroItem label="Cals" value={remainingMacros.calories} unit="" color="#22D3EE" />
                        <View style={styles.separator} />
                        <MacroItem label="Protein" value={remainingMacros.protein} unit="g" color={theme.primary} />
                        <View style={styles.separator} />
                        <MacroItem label="Carbs" value={remainingMacros.carbs} unit="g" color="#F59E0B" />
                        <View style={styles.separator} />
                        <MacroItem label="Fat" value={remainingMacros.fats} unit="g" color="#10B981" />
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 20, 40) }]}
                    >
                        {loading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={theme.primary} />
                                <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                                    Analyzing your targets...
                                </Text>
                            </View>
                        ) : suggestions.length > 0 ? (
                            <>
                                {visibleSuggestions.map((meal) => (
                                    <TouchableOpacity
                                        key={meal.id}
                                        style={[styles.mealCard, { backgroundColor: theme.backgroundCard, borderColor: theme.border }]}
                                        activeOpacity={0.8}
                                    >
                                        <View style={styles.mealHeader}>
                                            {!failedImageMealIds[meal.id] ? (
                                                <Image
                                                    source={{ uri: getMealImageUri(meal) }}
                                                    style={styles.mealImage}
                                                    resizeMode="cover"
                                                    onError={() =>
                                                        setFailedImageMealIds((prev) => ({ ...prev, [meal.id]: true }))
                                                    }
                                                />
                                            ) : (
                                                <View style={styles.mealEmojiContainer}>
                                                    <Text style={styles.mealEmoji}>{meal.emoji}</Text>
                                                </View>
                                            )}
                                            <View style={styles.mealTitleContainer}>
                                                <Text style={[styles.mealName, { color: theme.text }]}>{meal.name}</Text>
                                                <Text style={[styles.mealDesc, { color: theme.textMuted }]} numberOfLines={1}>
                                                    {meal.description}
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={styles.mealMacros}>
                                            <MiniMacro value={meal.calories} unit="" label="Cals" />
                                            <MiniMacro value={meal.protein} unit="g" label="Pro" highlight color={theme.primary} />
                                            <MiniMacro value={meal.carbs} unit="g" label="Carb" />
                                            <MiniMacro value={meal.fats} unit="g" label="Fat" />
                                        </View>

                                        <TouchableOpacity
                                            style={[styles.logButton, { backgroundColor: theme.primary }]}
                                            onPress={() => handleLogMeal(meal)}
                                            disabled={loggingId === meal.id}
                                        >
                                            {loggingId === meal.id ? (
                                                <ActivityIndicator size="small" color="#FFF" />
                                            ) : (
                                                <>
                                                    <MaterialCommunityIcons name="plus" size={18} color="#FFF" />
                                                    <Text style={styles.logButtonText}>Log This Meal</Text>
                                                </>
                                            )}
                                        </TouchableOpacity>
                                    </TouchableOpacity>
                                ))}

                                {canLoadMore && (
                                    <TouchableOpacity
                                        style={[styles.loadMoreButton, { borderColor: theme.border, backgroundColor: theme.backgroundCard }]}
                                        onPress={() => setVisibleCount((count) => Math.min(count + 8, suggestions.length))}
                                    >
                                        <MaterialCommunityIcons name="chevron-down" size={18} color={theme.primary} />
                                        <Text style={[styles.loadMoreText, { color: theme.primary }]}>
                                            Scroll more suggestions
                                        </Text>
                                    </TouchableOpacity>
                                )}

                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={onClose}
                                >
                                    <Text style={[styles.cancelButtonText, { color: theme.textMuted }]}>
                                        Close Suggestions
                                    </Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <View style={styles.emptyContainer}>
                                <MaterialCommunityIcons name="food-off" size={48} color={theme.textMuted} />
                                <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                                    No suggestions match your current targets.
                                    Consider a small protein-rich snack.
                                </Text>
                                <TouchableOpacity
                                    style={[styles.cancelButton, { marginTop: 20 }]}
                                    onPress={onClose}
                                >
                                    <Text style={[styles.cancelButtonText, { color: theme.textMuted }]}>
                                        Go Back
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </BlurView>
        </Modal>
    );
};

const MacroItem = ({ label, value, unit, color }: any) => {
    const { theme } = useTheme();
    return (
        <View style={styles.macroItem}>
            <Text style={[styles.macroValue, { color }]}>{Math.max(0, Math.round(value))}</Text>
            <Text style={[styles.macroLabel, { color: theme.textMuted }]}>{unit} {label}</Text>
        </View>
    );
};

const MiniMacro = ({ value, unit, label, highlight, color }: any) => {
    const { theme } = useTheme();
    return (
        <View style={styles.miniMacro}>
            <Text style={[
                styles.miniMacroValue,
                { color: highlight ? color : theme.text },
                highlight && { fontWeight: '900' }
            ]}>
                {value}{unit}
            </Text>
            <Text style={styles.miniMacroLabel}>{label}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    blurContainer: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingTop: 16,
        paddingHorizontal: 16,
        ...designSystem.shadows.lg,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
        gap: 12,
    },
    backButtonStyle: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: -8,
    },
    headerTitleArea: {
        flex: 1,
    },
    title: {
        fontSize: 19,
        fontWeight: '800',
        letterSpacing: -0.2,
    },
    subtitle: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    macroStrip: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 10,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 12,
        justifyContent: 'space-around',
        gap: 8,
    },
    typeSelector: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    typeButton: {
        flex: 1,
        paddingVertical: 7,
        borderRadius: 10,
        backgroundColor: 'rgba(0,0,0,0.03)',
        alignItems: 'center',
    },
    typeText: {
        fontSize: 11,
        fontWeight: '700',
    },
    macroItem: {
        alignItems: 'center',
    },
    macroValue: {
        fontSize: 15,
        fontWeight: '900',
    },
    macroLabel: {
        fontSize: 9,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    separator: {
        width: 1,
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
    scrollContent: {
        paddingBottom: 40,
    },
    loadingContainer: {
        paddingVertical: 60,
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        fontWeight: '600',
    },
    mealCard: {
        padding: 14,
        borderRadius: 18,
        borderWidth: 1,
        marginBottom: 12,
    },
    mealHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    mealEmojiContainer: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: 'rgba(0,0,0,0.03)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    mealImage: {
        width: 48,
        height: 48,
        borderRadius: 12,
        marginRight: 10,
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
    mealEmoji: {
        fontSize: 24,
    },
    mealTitleContainer: {
        flex: 1,
    },
    mealName: {
        fontSize: 16,
        fontWeight: '800',
    },
    mealDesc: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 2,
    },
    mealMacros: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-around',
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.03)',
        marginBottom: 12,
        gap: 8,
    },
    miniMacro: {
        alignItems: 'center',
    },
    miniMacroValue: {
        fontSize: 13,
        fontWeight: '800',
    },
    miniMacroLabel: {
        fontSize: 9,
        fontWeight: '700',
        color: 'rgba(0,0,0,0.4)',
        textTransform: 'uppercase',
    },
    logButton: {
        flexDirection: 'row',
        height: 42,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    logButtonText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '800',
    },
    emptyContainer: {
        paddingVertical: 60,
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
        lineHeight: 20,
    },
    cancelButton: {
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    cancelButtonText: {
        fontSize: 14,
        fontWeight: '700',
        textDecorationLine: 'underline',
    },
    loadMoreButton: {
        height: 40,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 8,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
    },
    loadMoreText: {
        fontSize: 12,
        fontWeight: '800',
    },
});
