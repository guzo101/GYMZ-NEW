import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../hooks/useTheme';

interface MacroProgressProps {
    protein: { current: number; goal: number };
    carbs: { current: number; goal: number };
    fats: { current: number; goal: number };
}

export function MacroProgress({ protein, carbs, fats }: MacroProgressProps) {
    const { theme } = useTheme();

    const MacroBar = ({
        label,
        current,
        goal,
        color,
        gradientColors
    }: {
        label: string;
        current: number;
        goal: number;
        color: string;
        gradientColors: [string, string, ...string[]];
    }) => {
        const progress = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
        const isOver = current > goal;

        return (
            <View style={styles.macroItem}>
                <View style={styles.macroHeader}>
                    <Text style={[styles.macroLabel, { color: theme.textSecondary }]}>{label}</Text>
                    <Text style={[styles.macroValue, { color: theme.text }]}>
                        {Math.round(current)}g / {goal}g
                    </Text>
                </View>
                <View style={[styles.progressBarBg, { backgroundColor: theme.border }]}>
                    <LinearGradient
                        colors={gradientColors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[
                            styles.progressBarFill,
                            { width: `${progress}%` },
                            isOver && styles.progressBarOver
                        ]}
                    />
                </View>
                <Text style={[styles.percentageText, { color: isOver ? '#EF4444' : color }]}>
                    {Math.round(progress)}%
                </Text>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <MacroBar
                label="Protein"
                current={protein.current}
                goal={protein.goal}
                color="#F1C93B"
                gradientColors={['#F1C93B', '#EF4444']}
            />
            <MacroBar
                label="Carbs"
                current={carbs.current}
                goal={carbs.goal}
                color="#F59E0B"
                gradientColors={['#F59E0B', '#F97316']}
            />
            <MacroBar
                label="Fats"
                current={fats.current}
                goal={fats.goal}
                color="#10B981"
                gradientColors={['#10B981', '#06B6D4']}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: 16,
    },
    macroItem: {
        gap: 6,
    },
    macroHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    macroLabel: {
        fontSize: 13,
        fontWeight: '600',
    },
    macroValue: {
        fontSize: 13,
        fontWeight: '700',
    },
    progressBarBg: {
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
        opacity: 0.3,
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 4,
    },
    progressBarOver: {
        opacity: 0.8,
    },
    percentageText: {
        fontSize: 11,
        fontWeight: '600',
        textAlign: 'right',
    },
});
