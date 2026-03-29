import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { LinearGradient } from 'expo-linear-gradient';

interface SmartCoachCardProps {
    feedback: string | null;
    isLoading: boolean;
}

export function SmartCoachCard({ feedback, isLoading }: SmartCoachCardProps) {
    const { theme } = useTheme();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const [displayedText, setDisplayedText] = useState('');
    const typingIntervalRef = useRef<any>(null);

    useEffect(() => {
        if (!isLoading && feedback) {
            // Fade in animation
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
                easing: Easing.out(Easing.quad),
            }).start();

            // Typewriter effect
            let index = 0;
            if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);

            setDisplayedText('');
            typingIntervalRef.current = setInterval(() => {
                setDisplayedText((prev) => feedback.slice(0, index + 1));
                index++;
                if (index >= feedback.length) {
                    clearInterval(typingIntervalRef.current);
                }
            }, 30);
        } else {
            fadeAnim.setValue(0);
            setDisplayedText('');
        }

        return () => {
            if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
        };
    }, [feedback, isLoading]);

    if (isLoading) {
        return (
            <View style={[styles.card, { borderColor: theme.border }]}>
                <View style={styles.header}>
                    <View style={styles.avatarPlaceholder}>
                        <MaterialCommunityIcons name="robot-outline" size={24} color={theme.primary} />
                    </View>
                    <Text style={[styles.coachName, { color: 'rgba(27, 46, 27, 0.6)' }]}>Coach Gymz is thinking...</Text>
                </View>
                <View style={styles.skeletonContainer}>
                    <View style={[styles.skeletonLine, { backgroundColor: theme.border, width: '90%' }]} />
                    <View style={[styles.skeletonLine, { backgroundColor: theme.border, width: '75%' }]} />
                    <View style={[styles.skeletonLine, { backgroundColor: theme.border, width: '85%' }]} />
                </View>
            </View>
        );
    }

    if (!feedback) return null;

    return (
        <Animated.View style={[styles.card, { opacity: fadeAnim, borderColor: theme.border }]}>
            <LinearGradient
                colors={['rgba(42, 75, 42, 0.05)', 'rgba(241, 201, 59, 0.05)']}
                style={styles.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.header}>
                    <View style={[styles.avatarContainer, { backgroundColor: theme.primary }]}>
                        <MaterialCommunityIcons name="robot" size={20} color="#FFF" />
                    </View>
                    <Text style={[styles.coachName, { color: '#1B2E1B' }]}>Gymz Smart Coach</Text>
                    <MaterialCommunityIcons name="check-decagram" size={16} color="#4ADE80" style={styles.verifiedIcon} />
                </View>

                <View style={styles.content}>
                    <Text style={[styles.feedbackText, { color: '#1B2E1B' }]}>
                        {displayedText}
                    </Text>
                </View>

                <View style={styles.footer}>
                    <Text style={[styles.footerText, { color: 'rgba(27, 46, 27, 0.6)' }]}>
                        Based on today's logs & progress
                    </Text>
                </View>
            </LinearGradient>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFF',
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    gradient: {
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    avatarPlaceholder: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(0,0,0,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    avatarContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    coachName: {
        fontSize: 14,
        fontWeight: '700',
    },
    verifiedIcon: {
        marginLeft: 4,
    },
    content: {
        minHeight: 60,
        justifyContent: 'center',
    },
    feedbackText: {
        fontSize: 16,
        lineHeight: 24,
        fontWeight: '500',
        fontStyle: 'italic',
    },
    footer: {
        marginTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
        paddingTop: 8,
    },
    footerText: {
        fontSize: 11,
        fontWeight: '600',
    },
    skeletonContainer: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        gap: 8,
    },
    skeletonLine: {
        height: 12,
        borderRadius: 6,
    },
});
