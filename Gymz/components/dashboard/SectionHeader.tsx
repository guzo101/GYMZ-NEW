import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { designSystem } from '../../theme/designSystem';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface SectionHeaderProps {
    title: string;
    subtitle?: string;
    actionLabel?: string;
    onAction?: () => void;
    icon?: keyof typeof MaterialCommunityIcons.glyphMap;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
    title,
    subtitle,
    actionLabel,
    onAction,
    icon
}) => {
    const { theme } = useTheme();

    return (
        <View style={styles.container}>
            <View style={styles.leftContent}>
                <View style={styles.titleRow}>
                    {icon && (
                        <MaterialCommunityIcons
                            name={icon}
                            size={20}
                            color={theme.primary}
                            style={styles.icon}
                        />
                    )}
                    <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
                </View>
                {subtitle && (
                    <Text style={[styles.subtitle, { color: theme.textMuted }]}>{subtitle}</Text>
                )}
            </View>

            {actionLabel && onAction && (
                <TouchableOpacity
                    onPress={onAction}
                    activeOpacity={0.7}
                    style={styles.actionButton}
                >
                    <Text style={[styles.actionText, { color: theme.primary }]}>{actionLabel}</Text>
                    <MaterialCommunityIcons name="chevron-right" size={16} color={theme.primary} />
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: designSystem.spacing.md,
        paddingHorizontal: 4,
    },
    leftContent: {
        flex: 1,
        gap: 4,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    icon: {
        marginTop: 2,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 13,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        paddingLeft: 8,
        gap: 2,
    },
    actionText: {
        fontSize: 13,
        fontWeight: '600',
    },
});
