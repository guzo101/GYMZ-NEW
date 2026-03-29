import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useRef } from 'react';
import { Animated } from 'react-native';

interface MealCardProps {
    type: 'Breakfast' | 'Lunch' | 'Afternoon Snack' | 'Dinner';
    time: string;
    name: string;
    portion: string;
    calories: number;
    macros: {
        protein: number;
        carbs: number;
        fat: number;
    };
    imageUri: string;
    isLogged?: boolean;
}

export function MealCard({ type, time, name, portion, calories, macros, imageUri, isLogged }: MealCardProps) {
    const [showComingSoon, setShowComingSoon] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const triggerComingSoon = () => {
        setShowComingSoon(true);
        Animated.sequence([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.delay(1500),
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
            }),
        ]).start(() => {
            setShowComingSoon(false);
        });
    };
    const getMealIconAndColor = () => {
        switch (type) {
            case 'Breakfast': return { icon: 'weather-sunny', color: '#F59E0B' };
            case 'Lunch': return { icon: 'weather-partly-cloudy', color: '#F97316' };
            case 'Afternoon Snack': return { icon: 'cup', color: '#F1C93B' };
            case 'Dinner': return { icon: 'weather-night', color: '#6366F1' };
            default: return { icon: 'food', color: '#2A4B2A' };
        }
    };

    const { icon, color } = getMealIconAndColor();

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <View style={styles.mealNameContainer}>
                    <View style={[styles.iconBox, { backgroundColor: `${color}15` }]}>
                        <MaterialCommunityIcons name={icon as any} size={20} color={color} />
                    </View>
                    <View style={styles.mealTypeRow}>
                        <Text style={styles.mealNameText}>{type}</Text>
                        {isLogged && (
                            <MaterialCommunityIcons name="check-decagram" size={16} color="#10B981" />
                        )}
                    </View>
                </View>
                <View style={styles.timeContainer}>
                    <MaterialCommunityIcons name="clock-outline" size={14} color="#6B7280" />
                    <Text style={styles.timeText}>{time}</Text>
                </View>
            </View>

            <View style={styles.contentRow}>
                <View>
                    <View style={styles.imageContainer}>
                        <Image
                            source={{ uri: imageUri }}
                            style={styles.foodThumb}
                            resizeMode="cover"
                        />
                    </View>
                </View>

                <View style={styles.mainInfo}>
                    <View style={styles.foodTitleRow}>
                        <Text style={styles.foodName}>{name}</Text>
                    </View>

                    <View style={styles.calorieRow}>
                        <Text style={styles.caloriesText}>{calories} kcal</Text>
                        <View style={styles.dot} />
                        <Text style={styles.portionText}>{portion}</Text>
                    </View>

                    <View style={styles.macroGrid}>
                        <View style={styles.macroItem}>
                            <Text style={styles.macroVal}>{macros.protein}g</Text>
                            <Text style={styles.macroLab}>Pro</Text>
                        </View>
                        <View style={styles.macroDivider} />
                        <View style={styles.macroItem}>
                            <Text style={styles.macroVal}>{macros.carbs}g</Text>
                            <Text style={styles.macroLab}>Carb</Text>
                        </View>
                        <View style={styles.macroDivider} />
                        <View style={styles.macroItem}>
                            <Text style={styles.macroVal}>{macros.fat}g</Text>
                            <Text style={styles.macroLab}>Fat</Text>
                        </View>
                    </View>
                </View>
            </View>

            <View style={styles.actions}>
                {!isLogged && (
                    <TouchableOpacity style={styles.primaryBtn}>
                        <LinearGradient
                            colors={['#2A4B2A', '#F1C93B']}
                            style={styles.primaryBtnGradient}
                            start={{ x: 0, y: 0.5 }}
                            end={{ x: 1, y: 0.5 }}
                        >
                            <Text style={styles.primaryBtnText}>Log Meal</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.recipeBtn} onPress={triggerComingSoon}>
                    <MaterialCommunityIcons name="book-open-outline" size={16} color="#4B5563" />
                    <Text style={styles.recipeBtnText}>Recipe</Text>
                </TouchableOpacity>

                {showComingSoon && (
                    <Animated.View style={[styles.comingSoonBadge, { opacity: fadeAnim }]}>
                        <Text style={styles.comingSoonText}>Coming Soon 🚀</Text>
                    </Animated.View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFF',
        borderRadius: 28,
        padding: 20,
        marginBottom: 16,
        shadowColor: 'rgba(0,0,0,0.05)',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 1,
        shadowRadius: 20,
        elevation: 3,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    mealNameContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    mealTypeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mealNameText: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111827',
        letterSpacing: -0.5,
    },
    timeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
    },
    timeText: {
        color: '#6B7280',
        fontWeight: '700',
        fontSize: 12,
    },
    contentRow: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 20,
    },
    imageContainer: {
        position: 'relative',
        width: 72,
        height: 72,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: '#F3F4F6',
    },
    foodThumb: {
        width: '100%',
        height: '100%',
        transform: [{ scale: 2.0 }],
    },
    mainInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    foodTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    foodName: {
        fontSize: 17,
        fontWeight: '800',
        color: '#1F2937',
    },
    calorieRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    caloriesText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#F97316',
    },
    dot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: '#D1D5DB',
        marginHorizontal: 8,
    },
    portionText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    macroGrid: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 12,
    },
    macroItem: {
        alignItems: 'center',
        flex: 1,
    },
    macroDivider: {
        width: 1,
        height: 16,
        backgroundColor: '#E5E7EB',
    },
    macroVal: {
        fontSize: 13,
        fontWeight: '800',
        color: '#111827',
    },
    macroLab: {
        fontSize: 10,
        fontWeight: '700',
        color: '#9CA3AF',
        textTransform: 'uppercase',
        marginTop: 1,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 10,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        paddingTop: 16,
    },
    primaryBtn: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    primaryBtnGradient: {
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    primaryBtnText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '700',
    },
    recipeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
    },
    recipeBtnText: {
        color: '#4B5563',
        fontSize: 13,
        fontWeight: '700',
    },
    comingSoonBadge: {
        position: 'absolute',
        top: -45,
        right: 0,
        backgroundColor: '#1F2937',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    comingSoonText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '700',
    },
});
