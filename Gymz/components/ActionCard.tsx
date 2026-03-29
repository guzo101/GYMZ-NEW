import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { designSystem } from '../theme/designSystem';

const screenWidth = Dimensions.get('window').width;

interface ActionCardProps {
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    title: string;
    subtitle?: string;
    iconColor: string;
    backgroundColor: string;
    onPress: () => void;
}

export const ActionCard: React.FC<ActionCardProps> = ({
    icon,
    title,
    subtitle,
    iconColor,
    backgroundColor,
    onPress,
}) => {
    const { theme } = useTheme();

    return (
        <TouchableOpacity
            style={[
                styles.card,
                { backgroundColor: theme.backgroundCard, borderColor: theme.border }
            ]}
            onPress={onPress}
            activeOpacity={0.8}
        >
            <View style={styles.content}>
                <View style={[styles.iconBox, { backgroundColor }, designSystem.shadows.glow(iconColor)]}>
                    <MaterialCommunityIcons name={icon} size={28} color={iconColor} />
                </View>
                <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
                {subtitle && <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>}
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        width: '100%',
        borderRadius: 24,
        padding: designSystem.spacing.lg,
        height: 180,
        position: 'relative',
        borderWidth: 1,
        ...designSystem.shadows.md,
    },
    content: {
        flex: 1,
        justifyContent: 'flex-start',
        zIndex: 2,
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: designSystem.spacing.lg,
        ...designSystem.shadows.sm,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 12,
        fontWeight: '500',
    },
    bgIcon: {
        position: 'absolute',
        right: -15,
        bottom: -15,
        opacity: 0.08,
        transform: [{ rotate: '-15deg' }],
    },
});
