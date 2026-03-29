import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { useTheme } from '../../hooks/useTheme';

interface WeeklyCalendarProps {
    selectedDate: Date;
    onDateSelect: (date: Date) => void;
}

export const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({ selectedDate, onDateSelect }) => {
    const { theme, isDark } = useTheme();

    // Get days of current week (starting Sunday)
    const startDate = startOfWeek(new Date());
    const days = Array.from({ length: 7 }).map((_, i) => addDays(startDate, i));

    return (
        <View style={styles.container}>
            <View style={styles.daysRow}>
                {days.map((day) => {
                    const isSelected = isSameDay(day, selectedDate);
                    const dayName = format(day, 'EEEEEE'); // S, M, T...
                    const dayDot = isSameDay(day, new Date());

                    return (
                        <TouchableOpacity
                            key={day.toISOString()}
                            style={styles.dayItem}
                            onPress={() => onDateSelect(day)}
                        >
                            <Text style={[styles.dayLabel, { color: theme.textSecondary }]}>{dayName}</Text>
                            <View style={[
                                styles.circle,
                                { borderColor: isSelected ? theme.primary : theme.border },
                                isSelected && { backgroundColor: isDark ? 'rgba(42, 75, 42, 0.2)' : 'rgba(42, 75, 42, 0.1)' }
                            ]}>
                                {dayDot && <View style={[styles.dot, { backgroundColor: theme.primary }]} />}
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingTop: 0,
        paddingBottom: 4,
        marginTop: 0,
        marginBottom: 8,
    },
    daysRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    dayItem: {
        alignItems: 'center',
        gap: 8,
    },
    dayLabel: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    circle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        borderStyle: 'dashed',
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        position: 'absolute',
        top: -10,
    }
});
