import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { designSystem } from '../../theme/designSystem';

export function GoalTipCard() {
    const { user } = useAuth();
    const goal = user?.goal?.toLowerCase() || 'weight loss';

    const getGoalAdvice = () => {
        if (goal.includes('loss')) {
            return {
                title: 'Weight Loss Tip',
                advice: 'Focus on high-fiber vegetables and lean protein. Try to add 20 minutes of brisk walking after dinner to boost metabolism.',
                icon: 'leaf',
                color: '#10B981'
            };
        } else if (goal.includes('gain') || goal.includes('muscle')) {
            return {
                title: 'Muscle Gain Tip',
                advice: 'Prioritize protein-dense meals. If you are struggling to eat enough, add a snack between lunch and dinner. Avoid excessive steady-state cardio.',
                icon: 'arm-flex',
                color: '#2A4B2A'
            };
        }
        return {
            title: 'Daily Fitness Tip',
            advice: 'Stay hydrated! Drink at least 3 liters of water today to keep your energy levels high during workouts.',
            icon: 'water',
            color: '#3B82F6'
        };
    };

    const tip = getGoalAdvice();

    return (
        <View style={[styles.card, { borderLeftColor: tip.color }]}>
            <View style={styles.header}>
                <MaterialCommunityIcons name={tip.icon as any} size={20} color={tip.color} />
                <Text style={[styles.title, { color: tip.color }]}>{tip.title}</Text>
            </View>
            <Text style={styles.advice}>{tip.advice}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        borderLeftWidth: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    title: {
        fontSize: 14,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    advice: {
        fontSize: 14,
        color: '#4B5563',
        lineHeight: 20,
    },
});
