import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Text, Surface, useTheme as usePaperTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useStepTracking } from '../hooks/useStepTracking';
import { useTheme } from '../hooks/useTheme';

const { width } = Dimensions.get('window');

export default function StepCounterCard() {
    const { currentSteps, isAvailable, error } = useStepTracking();
    const { theme, isDark } = useTheme();

    // Calculate potential calorie burn (rough estimate: 0.04 kcal per step)
    const calories = Math.round(currentSteps * 0.04);
    // Calculate distance (rough estimate: 0.762 meters per step, converted to km)
    const distance = (currentSteps * 0.762 / 1000).toFixed(2);

    // Goal (hardcoded for now, could be dynamic)
    const goal = 10000;
    const progress = Math.min(currentSteps / goal, 1);

    return (
        <Surface style={[styles.container, { backgroundColor: theme.backgroundCard }]} elevation={2}>
            <LinearGradient
                colors={isDark ? ['#4facfe', '#00f2fe'] : ['#4facfe', '#00f2fe']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradient}
            >
                <View style={styles.content}>
                    <View style={styles.header}>
                        <View style={styles.iconContainer}>
                            <MaterialCommunityIcons name="shoe-print" size={24} color="#fff" />
                        </View>
                        <View>
                            <Text style={styles.label}>Steps Today</Text>
                            {/* Visual indicator of "Live" or error */}
                            {error ? (
                                <Text style={[styles.subLabel, { color: '#ffcccc' }]}>
                                    {error === 'Step counting not available on this device' ? 'Sensor Missing' : 'Unavailable'}
                                </Text>
                            ) : (
                                <Text style={styles.subLabel}>Live Tracking</Text>
                            )}
                        </View>
                    </View>

                    <View style={styles.statsRow}>
                        <Text style={styles.stepCount}>{currentSteps.toLocaleString()}</Text>
                        <View style={styles.metrics}>
                            <View style={styles.metricItem}>
                                <MaterialCommunityIcons name="fire" size={16} color="rgba(255,255,255,0.8)" />
                                <Text style={styles.metricText}>{calories} kcal</Text>
                            </View>
                            <View style={styles.metricItem}>
                                <MaterialCommunityIcons name="map-marker-distance" size={16} color="rgba(255,255,255,0.8)" />
                                <Text style={styles.metricText}>{distance} km</Text>
                            </View>
                        </View>
                    </View>

                    {/* Simple Progress Bar */}
                    <View style={styles.progressBg}>
                        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                    </View>
                    <Text style={styles.goalText}>Goal: {goal.toLocaleString()}</Text>
                </View>
            </LinearGradient>
        </Surface>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: 20,
        marginVertical: 10,
        overflow: 'hidden',
        elevation: 4,
    },
    gradient: {
        padding: 20,
        borderRadius: 20,
    },
    content: {
        flexDirection: 'column',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    iconContainer: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        padding: 10,
        borderRadius: 12,
        marginRight: 12,
    },
    label: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    subLabel: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: 15,
    },
    stepCount: {
        color: '#fff',
        fontSize: 36,
        fontWeight: 'bold',
    },
    metrics: {
        alignItems: 'flex-end',
    },
    metricItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    metricText: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 14,
        marginLeft: 4,
        fontWeight: '500',
    },
    progressBg: {
        height: 6,
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 3,
        marginBottom: 6,
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#fff',
        borderRadius: 3,
    },
    goalText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        alignSelf: 'flex-end',
    },
});
