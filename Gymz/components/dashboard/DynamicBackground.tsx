import React from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface DynamicBackgroundProps {
    rotationType?: 'daily' | 'random' | 'fixed';
    fixedIndex?: number;
    pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
}

export function DynamicBackground({ rotationType = 'fixed', fixedIndex = 2, pointerEvents = 'none' }: DynamicBackgroundProps) {
    const { theme, gender, isDark } = useTheme();

    // Determine colors based on gender/theme
    const isFemale = gender === 'female';
    const primaryGlow = isFemale ? theme.primary : (isDark ? '#6366F1' : '#818CF8');
    const accentGlow = isFemale ? '#F1C93B' : '#06B6D4';

    // Background gradient colors
    const bgColors = isDark
        ? [theme.background, '#1E293B']
        : ['#F8FAFC', '#FFFFFF'];

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents={pointerEvents}>
            {/* Base Background Gradient */}
            <LinearGradient
                colors={bgColors as [string, string, ...string[]]}
                style={StyleSheet.absoluteFill}
            />

            {/* Mesh Glow Elements */}
            <View style={StyleSheet.absoluteFill}>
                {/* Primary Glow Area */}
                <View
                    style={[
                        styles.glow,
                        {
                            backgroundColor: primaryGlow,
                            top: -height * 0.1,
                            right: -width * 0.2,
                            width: width * 1.2,
                            height: width * 1.2,
                            opacity: isDark ? 0.15 : 0.08,
                        }
                    ]}
                />

                {/* Accent Glow Area */}
                <View
                    style={[
                        styles.glow,
                        {
                            backgroundColor: accentGlow,
                            bottom: height * 0.1,
                            left: -width * 0.3,
                            width: width * 1.1,
                            height: width * 1.1,
                            opacity: isDark ? 0.12 : 0.06,
                        }
                    ]}
                />

                {/* Subtle Top Left Glow */}
                <View
                    style={[
                        styles.glow,
                        {
                            backgroundColor: isDark ? theme.primary : theme.primaryLight,
                            top: height * 0.1,
                            left: -width * 0.1,
                            width: width * 0.6,
                            height: width * 0.6,
                            opacity: isDark ? 0.08 : 0.04,
                        }
                    ]}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    glow: {
        position: 'absolute',
        borderRadius: 999,
        // Using blur via shadow/opacity since real filter:blur() is limited in RN
        // without extra libraries, but large radius works well for backgrounds
    }
});

