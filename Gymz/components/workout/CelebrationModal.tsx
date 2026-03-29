import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { designSystem } from '../../theme/designSystem';
import { useTheme } from '../../hooks/useTheme';

interface CelebrationModalProps {
    visible: boolean;
    onClose: () => void;
    xpEarned: number;
    userMemory?: any;
}

export const CelebrationModal: React.FC<CelebrationModalProps> = ({ visible, onClose, xpEarned, userMemory }) => {
    const { theme } = useTheme();

    const cheer = React.useMemo(() => {
        if (!userMemory) return "Great work on that session! Consitency is key.";
        const goal = userMemory.primary_goal || 'fitness';
        const personality = userMemory.personality_type || 'Athlete';

        const cheers = [
            `Solid effort, ${personality}! Your ${goal} journey is looking strong.`,
            `Consistency pays off! That's another step toward your ${goal} goal.`,
            `Powerhouse performance! You're truly embodying the ${personality} spirit.`,
        ];
        return cheers[Math.floor(Math.random() * cheers.length)];
    }, [userMemory]);

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.overlay}>
                <View style={[styles.card, { backgroundColor: theme.backgroundCard }]}>
                    <LinearGradient
                        colors={[theme.primary, theme.primaryLight || theme.primary]}
                        style={styles.header}
                    >
                        <MaterialCommunityIcons name="trophy" size={60} color="#FFF" />
                    </LinearGradient>

                    <View style={styles.content}>
                        <Text style={[styles.title, { color: theme.text }]}>SESSION COMPLETE!</Text>
                        <View style={[styles.xpBadge, { backgroundColor: theme.primary + '20' }]}>
                            <MaterialCommunityIcons name="lightning-bolt" size={16} color={theme.primary} />
                            <Text style={[styles.xpText, { color: theme.primary }]}>+{xpEarned} XP EARNED</Text>
                        </View>

                        <Text style={[styles.cheerText, { color: theme.textSecondary }]}>
                            {cheer}
                        </Text>

                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: theme.primary }]}
                            onPress={onClose}
                        >
                            <Text style={styles.buttonText}>LET'S GO!</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
    },
    card: {
        width: '100%',
        borderRadius: 32,
        overflow: 'hidden',
        alignItems: 'center',
    },
    header: {
        width: '100%',
        height: 140,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        padding: 24,
        alignItems: 'center',
        width: '100%',
    },
    title: {
        fontSize: 24,
        fontWeight: '900',
        marginBottom: 12,
        letterSpacing: -0.5,
    },
    xpBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
        marginBottom: 20,
        gap: 6,
    },
    xpText: {
        fontSize: 14,
        fontWeight: '800',
    },
    cheerText: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 30,
        paddingHorizontal: 10,
    },
    button: {
        width: '100%',
        height: 56,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        ...designSystem.shadows.brand,
    },
    buttonText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '800',
    }
});
