import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const formatKwacha = (amount: number | string | null | undefined) => {
    const parsed = typeof amount === 'number' ? amount : Number(amount ?? 0);
    if (!Number.isFinite(parsed)) return 'K0';
    return `K${new Intl.NumberFormat('en-ZM', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(parsed)}`;
};

const THEME = {
    gold: '#F1C93B',
    darkGreen: '#2A4B2A',
    primaryGreen: '#4CAF50',
    dark: '#0A120A',
};

interface EventPriceBadgeProps {
    isFree?: boolean;
    price?: number | null;
    variant?: 'bubble' | 'compact' | 'bubbleInline';
}

export function EventPriceBadge({ isFree = true, price, variant = 'bubble' }: EventPriceBadgeProps) {
    const showFree = isFree !== false;

    if (variant === 'compact') {
        return (
            <View style={[styles.compactBadge, showFree ? styles.compactFree : styles.compactPaid]}>
                <Text style={[styles.compactText, showFree ? styles.compactFreeText : styles.compactPaidText]}>
                    {showFree ? 'FREE' : formatKwacha(price)}
                </Text>
            </View>
        );
    }

    if (variant === 'bubbleInline') {
        return (
            <View style={styles.bubbleInline}>
                <Text style={styles.bubbleText}>
                    {showFree ? 'FREE' : formatKwacha(price)}
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.bubble}>
            <Text style={styles.bubbleText}>
                {showFree ? 'FREE' : formatKwacha(price)}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    bubble: {
        position: 'absolute',
        top: 0,
        right: 0,
        zIndex: 10,
        backgroundColor: THEME.gold,
        borderWidth: 2,
        borderColor: THEME.darkGreen,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        transform: [{ rotate: '8deg' }],
    },
    bubbleInline: {
        backgroundColor: THEME.gold,
        borderWidth: 2,
        borderColor: THEME.darkGreen,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    bubbleText: {
        color: THEME.dark,
        fontWeight: '800',
        fontSize: 13,
        letterSpacing: 1,
    },
    compactBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    compactFree: {
        backgroundColor: 'rgba(76,175,80,0.25)',
        borderWidth: 1,
        borderColor: 'rgba(42,75,42,0.6)',
    },
    compactPaid: {
        backgroundColor: 'rgba(241,201,59,0.2)',
        borderWidth: 1,
        borderColor: 'rgba(42,75,42,0.6)',
    },
    compactText: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    compactFreeText: {
        color: THEME.primaryGreen,
    },
    compactPaidText: {
        color: THEME.gold,
    },
});
