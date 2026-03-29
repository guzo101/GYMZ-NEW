import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Circle, G, Text as SvgText } from 'react-native-svg';

interface ProgressRingProps {
    progress: number; // 0-100
    size?: number;
    strokeWidth?: number;
    color?: string;
    backgroundColor?: string;
    showLabel?: boolean;
    label?: string;
    animated?: boolean;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
    progress,
    size = 160,
    strokeWidth = 12,
    color = '#2A4B2A',
    backgroundColor = '#F3F4F6',
    showLabel = true,
    label,
    animated = true,
}) => {
    const progressAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (animated) {
            Animated.timing(progressAnim, {
                toValue: progress,
                duration: 1000,
                useNativeDriver: false,
            }).start();
        } else {
            progressAnim.setValue(progress);
        }
    }, [progress, animated]);

    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
        <View style={[styles.container, { width: size, height: size }]}>
            <Svg width={size} height={size}>
                <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
                    {/* Background Circle */}
                    <Circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke={backgroundColor}
                        strokeWidth={strokeWidth}
                        fill="none"
                        strokeLinecap="round"
                    />
                    {/* Progress Circle */}
                    <Circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke={color}
                        strokeWidth={strokeWidth}
                        fill="none"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                    />
                </G>
                {showLabel && (
                    <SvgText
                        x={size / 2}
                        y={size / 2}
                        textAnchor="middle"
                        dy=".3em"
                        fontSize={size / 5}
                        fontWeight="700"
                        fill={color}
                    >
                        {label || `${Math.round(progress)}%`}
                    </SvgText>
                )}
            </Svg>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
    },
});
