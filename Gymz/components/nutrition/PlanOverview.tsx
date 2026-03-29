import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { designSystem } from '../../theme/designSystem';

interface PlanOverviewProps {
    planName?: string;
    weeks?: string;
    level?: string;
    targets: {
        calories: number;
        protein: number;
        carbs: number;
        fats: number;
        fiber?: number;
    };
    eaten?: {
        protein: number;
        carbs: number;
        fats: number;
        fiber?: number;
    };
}

export function PlanOverview({
    planName = "High Protein Shred",
    weeks = "Week 1",
    level = "Hard",
    targets,
    eaten = { protein: 0, carbs: 0, fats: 0, fiber: 0 }
}: PlanOverviewProps) {
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useFocusEffect(
        useCallback(() => {
            // Small delay to ensure the screen transition is complete before pulsing
            const timer = setTimeout(() => {
                // Trigger haptic pulse
                if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setTimeout(() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }, 200);
                }

                // Start pulse animation
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.15,
                        duration: 400,
                        useNativeDriver: true,
                    }),
                    Animated.spring(pulseAnim, {
                        toValue: 1,
                        friction: 3,
                        tension: 40,
                        useNativeDriver: true,
                    }),
                ]).start();
            }, 300);

            return () => {
                clearTimeout(timer);
                pulseAnim.setValue(1);
            };
        }, [pulseAnim])
    );
    return (
        <View style={styles.card}>
            <View style={styles.goalSection}>
                <Animated.View style={[
                    styles.targetLabelBox,
                    {
                        backgroundColor: '#F0F9FF',
                        transform: [{ scale: pulseAnim }]
                    }
                ]}>
                    <MaterialCommunityIcons name="target" size={16} color="#0369A1" />
                    <Text style={styles.targetLabelText}>Daily Target Calories</Text>
                </Animated.View>
                <View style={styles.caloriesContainer}>
                    <Text style={styles.caloriesValue}>{targets.calories.toLocaleString()}</Text>
                    <Text style={styles.caloriesLabel}>kcal</Text>
                </View>
            </View>

            <View style={styles.macroBars}>
                <MacroBar
                    label="Protein"
                    eaten={eaten.protein}
                    goal={targets.protein}
                    color="#7A1E2C"
                />
                <MacroBar
                    label="Carbs"
                    eaten={eaten.carbs}
                    goal={targets.carbs}
                    color="#FACC15"
                />
                <MacroBar
                    label="Fat"
                    eaten={eaten.fats}
                    goal={targets.fats}
                    color="#F59E0B"
                />
                <MacroBar
                    label="Fiber"
                    eaten={eaten.fiber || 0}
                    goal={targets.fiber || 30}
                    color="#14B8A6"
                />
            </View>
        </View>
    );
}

function MacroBar({ label, eaten, goal, color }: { label: string, eaten: number, goal: number, color: string }) {
    const percentage = goal > 0 ? Math.round((eaten / goal) * 100) : 0;
    const progressWidthPct = goal > 0 ? Math.min(percentage, 100) : Math.min(100, Math.max(0, Math.round(eaten)));
    return (
        <View style={styles.macroItem}>
            <View style={styles.macroLabelRow}>
                <View style={styles.macroLabelMain}>
                    <Text style={styles.macroLabel}>{label}</Text>
                    <Text style={[styles.macroStatus, { color: percentage > 100 ? '#EF4444' : '#6B7280' }]}>
                        {percentage}%
                    </Text>
                </View>
                <View style={styles.macroGoalBox}>
                    <Text style={styles.macroGoalValue}>{eaten}g</Text>
                    <Text style={styles.macroGoalTarget}>/ {goal}g</Text>
                </View>
            </View>
            <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${progressWidthPct}%`, backgroundColor: color }]} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFF',
        borderRadius: 24,
        padding: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
    },
    badgeContainer: {
        backgroundColor: '#EDE9FE',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 100,
        alignSelf: 'flex-start',
        marginBottom: 12,
    },
    badgeText: {
        color: '#2A4B2A',
        fontSize: 14,
        fontWeight: '600',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: 8,
    },
    metaContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    metaText: {
        color: '#6B7280',
        fontSize: 14,
        fontWeight: '600',
    },
    goalSection: {
        marginBottom: 24,
    },
    targetLabelBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        alignSelf: 'flex-start',
        marginBottom: 8,
    },
    targetLabelText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0369A1',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    caloriesContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 8,
    },
    caloriesValue: {
        fontSize: 34,
        fontWeight: '900',
        color: '#111827',
        letterSpacing: -1,
    },
    caloriesLabel: {
        fontSize: 20,
        color: '#6B7280',
        fontWeight: '700',
    },
    macroBars: {
        gap: 16,
        marginBottom: 24,
    },
    macroItem: {
        gap: 8,
    },
    macroLabelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    macroLabelMain: {
        gap: 2,
    },
    macroLabel: {
        fontSize: 15,
        fontWeight: '800',
        color: '#111827',
    },
    macroStatus: {
        fontSize: 11,
        fontWeight: '700',
    },
    macroGoalBox: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 4,
    },
    macroGoalValue: {
        fontSize: 15,
        fontWeight: '800',
        color: '#111827',
    },
    macroGoalTarget: {
        fontSize: 12,
        fontWeight: '600',
        color: '#9CA3AF',
    },
    progressBg: {
        height: 8,
        backgroundColor: '#F3F4F6',
        borderRadius: 10,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 10,
    },

});
