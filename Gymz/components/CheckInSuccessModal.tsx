import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../hooks/useTheme';
import { format } from 'date-fns';

export interface CheckInSuccessData {
    type: 'gym' | 'event';
    message: string;
    membershipStatus?: string | null;
    renewalDueDate?: string | null;
    daysRemaining?: number | null;
}

interface CheckInSuccessModalProps {
    visible: boolean;
    onClose: () => void;
    data: CheckInSuccessData | null;
}

export const CheckInSuccessModal: React.FC<CheckInSuccessModalProps> = ({
    visible,
    onClose,
    data,
}) => {
    const { theme } = useTheme();

    if (!data) return null;

    const statusLabel = data.membershipStatus
        ? String(data.membershipStatus).charAt(0).toUpperCase() + String(data.membershipStatus).slice(1).toLowerCase()
        : 'Active';

    const daysText =
        data.daysRemaining != null
            ? data.daysRemaining === 0
                ? 'Renews today'
                : data.daysRemaining === 1
                    ? '1 day remaining'
                    : `${data.daysRemaining} days remaining`
            : null;

    const dueDateText =
        data.renewalDueDate
            ? format(new Date(data.renewalDueDate), 'MMM d, yyyy')
            : null;

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.overlay}>
                <View style={[styles.card, { backgroundColor: theme.backgroundCard }]}>
                    <LinearGradient
                        colors={['#2A4B2A', '#1B2E1B']}
                        style={styles.header}
                    >
                        <View style={styles.iconCircle}>
                            <MaterialCommunityIcons name="check-circle" size={56} color="#FFF" />
                        </View>
                        <Text style={styles.headerTitle}>
                            {data.type === 'gym' ? 'Gym Check-In' : 'Event Check-In'}
                        </Text>
                        <Text style={styles.headerSubtitle}>Success!</Text>
                    </LinearGradient>

                    <View style={styles.content}>
                        <Text style={[styles.message, { color: theme.text }]}>{data.message}</Text>

                        {(data.membershipStatus != null || data.daysRemaining != null || data.renewalDueDate) && (
                            <View style={[styles.statusCard, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '30' }]}>
                                <View style={styles.statusRow}>
                                    <MaterialCommunityIcons name="shield-check" size={20} color={theme.primary} />
                                    <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>Status</Text>
                                    <Text style={[styles.statusValue, { color: theme.text }]}>{statusLabel}</Text>
                                </View>
                                {daysText && (
                                    <View style={styles.statusRow}>
                                        <MaterialCommunityIcons name="calendar-clock" size={20} color={theme.primary} />
                                        <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>Access</Text>
                                        <Text style={[styles.statusValue, { color: theme.primary, fontWeight: '700' }]}>{daysText}</Text>
                                    </View>
                                )}
                                {dueDateText && (
                                    <View style={styles.statusRow}>
                                        <MaterialCommunityIcons name="calendar" size={20} color={theme.primary} />
                                        <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>Due date</Text>
                                        <Text style={[styles.statusValue, { color: theme.text }]}>{dueDateText}</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: theme.primary }]}
                            onPress={onClose}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.buttonText}>Done</Text>
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
        backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 28,
    },
    card: {
        width: '100%',
        maxWidth: 360,
        borderRadius: 28,
        overflow: 'hidden',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
        elevation: 12,
    },
    header: {
        width: '100%',
        paddingVertical: 32,
        paddingHorizontal: 28,
        alignItems: 'center',
    },
    iconCircle: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    headerSubtitle: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 15,
        marginTop: 6,
    },
    content: {
        padding: 28,
        width: '100%',
    },
    message: {
        fontSize: 17,
        textAlign: 'center',
        lineHeight: 26,
        marginBottom: 24,
    },
    statusCard: {
        borderRadius: 18,
        borderWidth: 1,
        padding: 20,
        marginBottom: 28,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 8,
    },
    statusLabel: {
        flex: 1,
        fontSize: 14,
    },
    statusValue: {
        fontSize: 14,
        fontWeight: '600',
    },
    button: {
        width: '100%',
        height: 56,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: '#FFF',
        fontSize: 17,
        fontWeight: '700',
    },
});
