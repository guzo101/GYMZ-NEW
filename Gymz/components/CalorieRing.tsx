import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { useTheme } from '../hooks/useTheme';

interface CalorieRingProps {
    current: number;
    goal: number;
    size?: number;
    strokeWidth?: number;
    showLabel?: boolean;
}

export function CalorieRing({
    current,
    goal,
    size = 160,
    strokeWidth = 16,
    showLabel = true
}: CalorieRingProps) {
    const { theme } = useTheme();

    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = goal > 0 ? Math.min(current / goal, 1) : 0;
    const strokeDashoffset = circumference * (1 - progress);

    const center = size / 2;

    // Determine color based on progress
    const getProgressColor = () => {
        if (progress < 0.5) return '#10B981'; // Green - under goal
        if (progress < 0.9) return '#F59E0B'; // Orange - approaching goal
        if (progress <= 1.0) return '#06B6D4'; // Cyan - at goal
        return '#EF4444'; // Red - over goal
    };

    const progressColor = getProgressColor();
    const percentage = Math.round(progress * 100);
    const remaining = Math.max(goal - current, 0);

    return (
        <View style={styles.container}>
            <Svg width={size} height={size}>
                <Defs>
                    <SvgGradient id="ringGradient" x1="0" y1="0" x2="1" y2="1">
                        <Stop offset="0" stopColor={progressColor} stopOpacity="1" />
                        <Stop offset="1" stopColor="#2A4B2A" stopOpacity="1" />
                    </SvgGradient>
                </Defs>

                {/* Background circle */}
                <Circle
                    cx={center}
                    cy={center}
                    r={radius}
                    stroke={theme.border}
                    strokeWidth={strokeWidth}
                    fill="none"
                    opacity={0.2}
                />

                {/* Progress circle */}
                <Circle
                    cx={center}
                    cy={center}
                    r={radius}
                    stroke="url(#ringGradient)"
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    rotation="-90"
                    origin={`${center}, ${center}`}
                />
            </Svg>

            {showLabel && (
                <View style={styles.labelContainer}>
                    <Text style={[styles.currentValue, { color: theme.text }]}>
                        {current.toLocaleString()}
                    </Text>
                    <Text style={[styles.goalText, { color: theme.textSecondary }]}>
                        of {goal.toLocaleString()}
                    </Text>
                    <Text style={[styles.unitText, { color: theme.textMuted }]}>
                        calories
                    </Text>
                    {remaining > 0 && (
                        <Text style={[styles.remainingText, { color: progressColor }]}>
                            {remaining} left
                        </Text>
                    )}
                    {current > goal && (
                        <Text style={[styles.overText, { color: '#EF4444' }]}>
                            +{(current - goal).toLocaleString()} over
                        </Text>
                    )}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    labelContainer: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    currentValue: {
        fontSize: 32,
        fontWeight: '800',
        marginBottom: 4,
    },
    goalText: {
        fontSize: 14,
        fontWeight: '600',
    },
    unitText: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 2,
    },
    remainingText: {
        fontSize: 13,
        fontWeight: '700',
        marginTop: 6,
    },
    overText: {
        fontSize: 13,
        fontWeight: '700',
        marginTop: 6,
    },
});
