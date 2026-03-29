import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

interface DailySummaryProps {
    eaten: number;
    goal: number;
    macros: {
        protein: { eaten: number; goal: number };
        carbs: { eaten: number; goal: number };
        fats: { eaten: number; goal: number };
    };
    waterCups: number;
    onAddWater: (count: number) => void;
    onCompleteDay?: () => void;
    aiFeedback: string | null;
    isAIThinking?: boolean;
}

export function DailySummary({
    eaten,
    goal,
    macros,
    waterCups,
    onAddWater,
    onCompleteDay,
    aiFeedback,
    isAIThinking = false
}: DailySummaryProps) {
    const safeValue = (num: any) => Number(num) || 0;
    const safeGoal = (num: any) => Math.max(Number(num) || 1, 1);

    const toggleCup = (index: number) => {
        if (Platform.OS !== 'web') {
            try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch (e) {
                console.warn('[DailySummary] Haptics failed', e);
            }
        }

        if (index < waterCups) {
            onAddWater(index);
        } else {
            onAddWater(index + 1);
        }
    };

    const { width } = useWindowDimensions();

    return (
        <View style={styles.card}>
            {/* Dedicated Water Tracker */}
            <View style={styles.waterSection}>
                <View style={styles.waterHeader}>
                    <View style={styles.waterTitleRow}>
                        <MaterialCommunityIcons name="cup-water" size={22} color="#06B6D4" />
                        <Text style={styles.waterTitle}>Drink 8 cups/day</Text>
                    </View>
                    <Text style={styles.waterCount}>{waterCups} / 8 cups</Text>
                </View>
                <Text style={styles.waterHint}>Tap cups to log water.</Text>
                <View style={styles.cupsContainer}>
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
                        <Pressable
                            key={index}
                            style={({ pressed }) => [
                                styles.cup,
                                index < waterCups && styles.cupFilled,
                                pressed && { opacity: 0.7 }
                            ]}
                            onPress={() => toggleCup(index)}
                        >
                            <MaterialCommunityIcons
                                name={index < waterCups ? "cup-water" : "cup-outline"}
                                size={22}
                                color={index < waterCups ? "#FFF" : "#06B6D4"}
                            />
                        </Pressable>
                    ))}
                </View>
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
        shadowColor: '#2A4B2A',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 5,
    },
    waterSection: {
        width: '100%',
        marginBottom: 20,
        backgroundColor: '#F0F9FF',
        padding: 16,
        borderRadius: 20,
    },
    waterHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    waterTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    waterTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#01579B',
    },
    waterCount: {
        fontSize: 14,
        fontWeight: '600',
        color: '#06B6D4',
    },
    waterHint: {
        fontSize: 12,
        fontWeight: '600',
        color: '#0891B2',
        marginTop: -8,
        marginBottom: 10,
    },
    cupsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        gap: 8,
    },
    cup: {
        width: '22.5%',
        aspectRatio: 1,
        backgroundColor: '#FFF',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#06B6D4',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    cupFilled: {
        backgroundColor: '#06B6D4',
    },
    buttonText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
