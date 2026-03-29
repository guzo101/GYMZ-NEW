import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

interface RingData {
    progress: number; // 0-100
    color: string;
}

interface ConcentricRingsProps {
    rings: RingData[];
    size?: number;
    strokeWidth?: number;
    backgroundColor?: string;
    centerContent?: React.ReactNode;
}

export const ConcentricRings: React.FC<ConcentricRingsProps> = ({
    rings,
    size = 240,
    strokeWidth = 12,
    backgroundColor = '#F3F4F6',
    centerContent,
}) => {
    // Animation values for each ring
    const animations = useRef(rings.map(() => new Animated.Value(0))).current;

    useEffect(() => {
        const anims = rings.map((ring, index) => {
            return Animated.timing(animations[index], {
                toValue: ring.progress,
                duration: 1500,
                delay: index * 200,
                useNativeDriver: false,
            });
        });

        Animated.parallel(anims).start();
    }, [rings]);

    const center = size / 2;
    const gap = strokeWidth + 4; // Space between rings

    // Component to render a single animated circle
    const AnimatedCircle = ({ index, ring }: { index: number; ring: RingData }) => {
        const animatedValue = animations[index];
        // Calculate radius based on size and index (outer rings first)
        const radius = (size / 2) - (strokeWidth / 2) - (index * gap);
        const circumference = 2 * Math.PI * radius;

        const [offset, setOffset] = React.useState(circumference);

        useEffect(() => {
            const id = animatedValue.addListener((v) => {
                const strokeDashoffset = circumference - (v.value / 100) * circumference;
                setOffset(strokeDashoffset);
            });
            return () => animatedValue.removeListener(id);
        }, [animatedValue, circumference]);

        if (radius <= 0) return null; // Avoid rendering if size is too small

        return (
            <React.Fragment>
                {/* Background Ring */}
                <Circle
                    cx={center}
                    cy={center}
                    r={radius}
                    stroke={backgroundColor}
                    strokeWidth={strokeWidth}
                    fill="none"
                />
                {/* Progress Ring */}
                <Circle
                    cx={center}
                    cy={center}
                    r={radius}
                    stroke={ring.color}
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    rotation="-90"
                    origin={`${center}, ${center}`}
                />
            </React.Fragment>
        );
    };

    return (
        <View style={[styles.container, { width: size, height: size }]}>
            <Svg width={size} height={size}>
                {rings.map((ring, index) => (
                    <AnimatedCircle key={index} index={index} ring={ring} />
                ))}
            </Svg>
            {centerContent && (
                <View style={styles.centerContainer}>
                    {centerContent}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    centerContainer: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
