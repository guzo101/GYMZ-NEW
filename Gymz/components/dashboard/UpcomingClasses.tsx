import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { designSystem } from '../../theme/designSystem';
import { useTheme } from '../../hooks/useTheme';

interface UpcomingClassesProps {
    classes: any[];
    onSeeAll: () => void;
    onBookClass: () => void;
    isLoading?: boolean;
}

export const UpcomingClasses: React.FC<UpcomingClassesProps> = ({
    classes,
    onSeeAll,
    onBookClass,
    isLoading = false
}) => {
    const { theme } = useTheme();

    return (
        <View style={styles.container}>
            <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Today's Schedule</Text>
                <TouchableOpacity onPress={onSeeAll}>
                    <Text style={[styles.seeAllText, { color: theme.primary }]}>See All</Text>
                </TouchableOpacity>
            </View>

            {isLoading ? (
                <View>
                    {[1, 2].map(i => (
                        <View key={i} style={[styles.classCard, { backgroundColor: theme.backgroundCard, borderColor: theme.border, opacity: 0.6 }]}>
                            <View style={[styles.dateBox, { borderRightColor: theme.border }]}>
                                <View style={{ width: 30, height: 24, borderRadius: 4, backgroundColor: theme.border, marginBottom: 4 }} />
                                <View style={{ width: 40, height: 12, borderRadius: 4, backgroundColor: theme.border }} />
                            </View>
                            <View style={styles.classInfo}>
                                <View style={{ width: '70%', height: 18, borderRadius: 4, backgroundColor: theme.border, marginBottom: 8 }} />
                                <View style={{ width: '40%', height: 12, borderRadius: 4, backgroundColor: theme.border }} />
                            </View>
                        </View>
                    ))}
                </View>
            ) : classes.length > 0 ? (
                <View>
                    {classes.map((selection: any, index) => {
                        const schedule = selection.gym_class_schedules;
                        const gymClass = schedule?.gym_classes;
                        if (!schedule || !gymClass) return null;
                        const isToday = new Date(schedule.date).toDateString() === new Date().toDateString();

                        return (
                            <TouchableOpacity
                                key={selection.id || index}
                                style={[styles.classCard, { backgroundColor: theme.backgroundCard, borderColor: theme.border }]}
                                onPress={onSeeAll}
                            >
                                <View style={[styles.dateBox, { borderRightColor: theme.border }]}>
                                    <Text style={[styles.dateDay, { color: theme.text }]}>{new Date(schedule.date).getDate()}</Text>
                                    <Text style={[styles.dateMonth, { color: theme.textSecondary }]}>
                                        {new Date(schedule.date).toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}
                                    </Text>
                                </View>

                                <View style={styles.classInfo}>
                                    <Text style={[styles.className, { color: theme.text }]}>{gymClass.name}</Text>
                                    <View style={styles.classMetaRow}>
                                        <View style={styles.classMetaItem}>
                                            <MaterialCommunityIcons name="clock-outline" size={14} color={theme.textSecondary} />
                                            <Text style={[styles.classMetaText, { color: theme.textSecondary }]}>
                                                {schedule.start_time?.slice(0, 5)} ({gymClass.duration_minutes}m)
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.classMetaRow}>
                                        <View style={styles.classMetaItem}>
                                            <MaterialCommunityIcons name="account" size={14} color={theme.textSecondary} />
                                            <Text style={[styles.classMetaText, { color: theme.textSecondary }]}>{gymClass.trainer_name || 'Coach'}</Text>
                                        </View>
                                    </View>
                                </View>

                                <View style={isToday ? styles.statusBadgeToday : [styles.statusBadgeUpcoming, { backgroundColor: theme.backgroundInput }]}>
                                    <Text style={isToday ? styles.statusTextToday : [styles.statusTextUpcoming, { color: theme.textSecondary }]}>
                                        {isToday ? 'TODAY' : 'SOON'}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            ) : (
                <View style={[styles.emptyClasses, { backgroundColor: theme.backgroundCard, borderColor: theme.border }]}>
                    <MaterialCommunityIcons name="calendar-blank" size={40} color={theme.textMuted} />
                    <Text style={[styles.emptyClassesText, { color: theme.textSecondary }]}>No classes scheduled for today.</Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: designSystem.spacing.xl,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: designSystem.spacing.lg,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    seeAllText: {
        fontSize: 14,
        fontWeight: '600',
    },
    classCard: {
        flexDirection: 'row',
        borderRadius: 24,
        padding: 16,
        marginBottom: designSystem.spacing.lg,
        alignItems: 'center',
        borderWidth: 1,
    },
    dateBox: {
        width: 60,
        alignItems: 'center',
        borderRightWidth: 1,
        paddingRight: 16,
    },
    dateDay: {
        fontSize: 22,
        fontWeight: '800',
    },
    dateMonth: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    classInfo: {
        flex: 1,
        paddingLeft: 16,
    },
    className: {
        fontSize: 17,
        fontWeight: '800',
        marginBottom: 6,
    },
    classMetaRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 4,
    },
    classMetaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    classMetaText: {
        fontSize: 13,
        fontWeight: '500',
    },
    statusBadgeToday: {
        backgroundColor: 'rgba(42, 75, 42, 0.15)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
    },
    statusTextToday: {
        fontSize: 11,
        fontWeight: '800',
        color: '#2A4B2A',
    },
    statusBadgeUpcoming: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
    },
    statusTextUpcoming: {
        fontSize: 11,
        fontWeight: '800',
    },
    emptyClasses: {
        borderRadius: 32,
        padding: 32,
        alignItems: 'center',
        gap: 16,
        borderWidth: 1,
    },
    emptyClassesText: {
        fontSize: 15,
        fontWeight: '500',
    },
});
