import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

interface CalibrationBannerProps {
    onPress: () => void;
}

export const CalibrationBanner: React.FC<CalibrationBannerProps> = ({ onPress }) => {
    const { theme } = useTheme();

    return (
        <View style={styles.outerContainer}>
            <Pressable
                onPress={() => {
                    console.log("[CalibrationBanner] Navigating to HealthMetrics");
                    onPress();
                }}
                style={({ pressed }) => [
                    styles.container,
                    { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }
                ]}
            >
                <LinearGradient
                    colors={[theme.primary, theme.primaryLight]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradient}
                >
                    <View style={styles.iconContainer}>
                        <MaterialCommunityIcons name="molecule" size={24} color="#FFF" />
                    </View>
                    <View style={styles.textContainer}>
                        <Text style={styles.title}>Action Required: Profile Incomplete</Text>
                        <Text style={styles.subtitle}>Critical data missing. Calibrate your profile now for accurate results.</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={24} color="#FFF" />
                </LinearGradient>
            </Pressable>
        </View>
    );
};

const styles = StyleSheet.create({
    outerContainer: {
        zIndex: 9999,
        elevation: 10,
    },
    container: {
        marginHorizontal: 20,
        marginTop: 4,
        marginBottom: 4,
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
    },
    gradient: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    textContainer: {
        flex: 1,
    },
    title: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '900',
        marginBottom: 2,
    },
    subtitle: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 11,
        fontWeight: '600',
    },
});
