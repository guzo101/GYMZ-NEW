import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { designSystem } from '../theme/designSystem';

interface StatCardProps {
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    value: string | number;
    label: string;
    iconColor: string;
    iconBackground: string;
}

export const StatCard: React.FC<StatCardProps> = ({
    icon,
    value,
    label,
    iconColor,
    iconBackground,
}) => {
    const { theme } = useTheme();

    return (
        <View style={[
            styles.card,
            theme.background === '#0F1117' || theme.background === '#0F172A' || theme.background === '#120B1D' ? designSystem.glass.dark : designSystem.glass.light,
            { backgroundColor: 'transparent' }
        ]}>
            <View style={[styles.iconContainer, { backgroundColor: iconBackground }, designSystem.shadows.glow(iconColor)]}>
                <MaterialCommunityIcons name={icon} size={20} color={iconColor} />
            </View>
            <Text style={[styles.value, { color: theme.text }]}>{value}</Text>
            <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 20,
        padding: 16,
        alignItems: 'center',
        minWidth: 100,
        borderWidth: 1,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    value: {
        fontSize: 16,
        fontWeight: '800',
        marginBottom: 4,
    },
    label: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
});
