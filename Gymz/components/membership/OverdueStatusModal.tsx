import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Dimensions,
    Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../hooks/useTheme';
import { designSystem } from '../../theme/designSystem';

const { width } = Dimensions.get('window');

interface OverdueStatusModalProps {
    visible: boolean;
    onLogout: () => void;
    onRenew: () => void;
    onDismiss?: () => void;
    memberName?: string;
    membershipStatus?: string;
    streak?: number;
    title?: string;
    subMessage?: string;
    ctaText?: string;
}

export const OverdueStatusModal: React.FC<OverdueStatusModalProps> = ({
    visible,
    onLogout,
    onRenew,
    onDismiss,
    memberName = 'Member',
    membershipStatus = 'Inactive',
    streak = 0,
    title: overrideTitle,
    subMessage: overrideSubMessage,
    ctaText: overrideCtaText,
}) => {
    const { theme, isDark } = useTheme();

    const isTrial = membershipStatus === 'Pending';

    // Extract only the first name and capitalize it properly
    const firstName = memberName.split(' ')[0];
    const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();

    // Personalized copy based on streak
    const hasStreak = streak > 2;
    const subMessage = isTrial
        ? "Experience our AI coaching and tracking tools in Limited Mode before you join."
        : hasStreak
            ? `You're on a ${streak} Day Streak! 🌟 Renew now to keep your streak alive and maintain your progress.`
            : "Don't let your momentum fade. Renew now to restore full access to your health dashboard and gym entry.";

    const ctaText = isTrial
        ? "BECOME A MEMBER"
        : hasStreak
            ? "RESTORE & KEEP STREAK"
            : "RESTORE FULL ACCESS";

    const finalTitle = overrideTitle || (isTrial ? "Welcome to Gymz!" : "Account Paused");

    const finalSubMessage = overrideSubMessage || (isTrial
        ? "Experience our AI coaching and tracking tools in Limited Mode before you join."
        : hasStreak
            ? `You're on a ${streak} Day Streak! 🌟 Renew now to keep your streak alive and maintain your progress.`
            : "Don't let your momentum fade. Renew now to restore full access to your health dashboard and gym entry.");

    const finalCtaText = overrideCtaText || (isTrial
        ? "BECOME A MEMBER"
        : hasStreak
            ? "RESTORE & KEEP STREAK"
            : "RESTORE FULL ACCESS");

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={() => { }} // Disable Android back button
        >
            <View style={styles.container}>
                {Platform.OS === 'ios' ? (
                    <BlurView intensity={100} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.95)' : 'rgba(255,255,255,0.95)' }]} />
                )}

                <View style={[styles.modalContent, { backgroundColor: theme.backgroundCard, borderColor: theme.border }]}>
                    <View style={styles.iconContainer}>
                        <View style={[styles.iconCircle, { backgroundColor: isTrial ? 'rgba(16, 185, 129, 0.1)' : theme.backgroundInput }]}>
                            <MaterialCommunityIcons
                                name={isTrial ? "rocket-launch-outline" : "lock-alert"}
                                size={48}
                                color={isTrial ? theme.primary : theme.error}
                            />
                        </View>
                    </View>

                    <View style={styles.body}>
                        <Text style={[styles.title, { color: theme.text }]}>
                            {finalTitle}
                        </Text>
                        <Text style={[styles.message, { color: theme.textSecondary }]}>
                            {isTrial
                                ? `Hi ${displayName}, start your fitness journey with a Test Ride!`
                                : `Hi ${displayName}, your membership has expired.`
                            }
                        </Text>
                        <Text style={[styles.subMessage, { color: theme.textMuted }]}>
                            {finalSubMessage}
                        </Text>

                        <View style={styles.actionContainer}>
                            <TouchableOpacity
                                style={[styles.primaryButton, { backgroundColor: theme.primary }]}
                                activeOpacity={0.7}
                                onPress={onRenew}
                            >
                                <Text style={styles.primaryButtonText}>
                                    {finalCtaText}
                                </Text>
                                <MaterialCommunityIcons name="arrow-right" size={20} color="#FFF" />
                            </TouchableOpacity>

                            {onDismiss && (
                                <TouchableOpacity
                                    style={[styles.secondaryButton, { borderColor: 'transparent', marginTop: 4 }]}
                                    onPress={onDismiss}
                                >
                                    <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>
                                        Continue with Limited Access
                                    </Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                style={[styles.secondaryButton, { borderColor: theme.border, marginTop: 8 }]}
                                onPress={onLogout}
                            >
                                <Text style={[styles.secondaryButtonText, { color: theme.textSecondary }]}>LOGOUT</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        maxWidth: 360,
        borderRadius: 24,
        borderWidth: 1,
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.2,
                shadowRadius: 20,
            },
            android: {
                elevation: 10,
            },
        }),
    },
    iconContainer: {
        alignItems: 'center',
        paddingTop: 40,
        paddingBottom: 10,
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    body: {
        padding: 24,
        alignItems: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 12,
        textAlign: 'center',
        marginTop: 8,
    },
    message: {
        fontSize: 15,
        textAlign: 'center',
        marginBottom: 8,
        lineHeight: 22,
    },
    subMessage: {
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 18,
        paddingHorizontal: 10,
    },
    actionContainer: {
        width: '100%',
        gap: 12,
    },
    primaryButton: {
        height: 52,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    primaryButtonText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '600',
        letterSpacing: 0.5,
        marginRight: 8,
    },
    secondaryButton: {
        height: 52,
        borderRadius: 14,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryButtonText: {
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
});
