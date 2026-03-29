import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../hooks/useTheme';
import { humanizeGoal, humanizePersonality } from '../../utils/humanizer';

interface ProteinNudgeCardProps {
    current: number;
    goal: number;
    userMemory?: any;
    onPress?: () => void;
}

export const ProteinNudgeCard: React.FC<ProteinNudgeCardProps> = ({ current, goal, userMemory, onPress }) => {
    const { theme } = useTheme();

    if (current >= goal * 0.8) return null; // Only nudge if significantly behind

    const personality = humanizePersonality(userMemory?.personality_type || 'Athlete');
    const primaryGoal = humanizeGoal(userMemory?.primary_goal || 'fitness');

    const foodSuggestions = primaryGoal.includes('muscle')
        ? ["Greek yogurt", "a protein shake", "hard-boiled eggs"]
        : ["grilled chicken", "tuna salad", "a handful of almonds"];

    const suggestedFood = foodSuggestions[Math.floor(Math.random() * foodSuggestions.length)];

    return (
        <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.container}>
            <LinearGradient
                colors={['rgba(245, 158, 11, 0.15)', 'rgba(245, 158, 11, 0.05)']}
                style={[styles.gradient, { borderColor: '#F59E0B' + '40' }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={[styles.iconContainer, { backgroundColor: '#F59E0B' + '20' }]}>
                    <MaterialCommunityIcons name="food-steak" size={20} color="#F59E0B" />
                </View>
                <View style={styles.content}>
                    <Text style={styles.title}>COACH'S NUDGE</Text>
                    <Text style={[styles.text, { color: theme.text }]}>
                        Hey {personality}, you're {Math.round(goal - current)}g away from your protein goal. How about {suggestedFood} to help with {primaryGoal}?
                    </Text>
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 20,
    },
    gradient: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 24,
        borderWidth: 1,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    content: {
        flex: 1,
    },
    title: {
        color: '#F59E0B',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1.2,
        marginBottom: 4,
    },
    text: {
        fontSize: 13,
        fontWeight: '600',
        lineHeight: 18,
    }
});
