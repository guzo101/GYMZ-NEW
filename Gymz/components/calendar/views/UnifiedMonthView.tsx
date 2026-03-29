import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
    startOfMonth, endOfMonth, startOfWeek, endOfWeek,
    eachDayOfInterval, format, isSameMonth, isSameDay,
    isToday, parseISO
} from 'date-fns';
import { CalendarItem } from '../../../types/calendar';
import { useTheme } from '../../../hooks/useTheme';

interface UnifiedMonthViewProps {
    currentDate: Date;
    items: CalendarItem[];
    onSelectItem: (item: CalendarItem) => void;
    onSelectDate: (date: Date) => void;
}

export const UnifiedMonthView: React.FC<UnifiedMonthViewProps> = ({
    currentDate,
    items,
    onSelectItem,
    onSelectDate
}) => {
    const { theme, isDark } = useTheme();
    const screenWidth = Dimensions.get('window').width;

    // Generate Grid Days
    const days = useMemo(() => {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
        const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

        return eachDayOfInterval({ start: startDate, end: endDate });
    }, [currentDate]);

    // Group Items by DateKey (YYYY-MM-DD)
    const itemsByDate = useMemo(() => {
        const map = new Map<string, CalendarItem[]>();
        items.forEach(item => {
            const key = item.dateKey;
            if (!map.has(key)) map.set(key, []);
            map.get(key)?.push(item);
        });
        return map;
    }, [items]);

    const renderDay = (day: Date) => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const dayItems = itemsByDate.get(dateKey) || [];
        const isCurrentMonth = isSameMonth(day, currentDate);
        const isDayToday = isToday(day);

        return (
            <TouchableOpacity
                key={dateKey}
                style={[
                    styles.dayCell,
                    {
                        borderColor: theme.border,
                        backgroundColor: isCurrentMonth
                            ? 'transparent'
                            : (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)')
                    }
                ]}
                onPress={() => onSelectDate(day)}
            >
                <View style={[
                    styles.dateNumberContainer,
                    isDayToday && { backgroundColor: theme.primary, borderRadius: 12 }
                ]}>
                    <Text style={[
                        styles.dateNumber,
                        { color: isDayToday ? '#FFF' : theme.text, opacity: isCurrentMonth ? 1 : 0.4 }
                    ]}>
                        {format(day, 'd')}
                    </Text>
                </View>

                <View style={styles.chipsContainer}>
                    {dayItems.slice(0, 3).map((item, i) => (
                        <TouchableOpacity
                            key={item.id}
                            style={[
                                styles.chip,
                                {
                                    backgroundColor: item.isPersonal
                                        ? theme.success
                                        : (item.color || theme.primary),
                                    opacity: item.isPersonal ? 1 : 0.7
                                },
                                {
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 2
                                }
                            ]}
                            onPress={() => onSelectItem(item)}
                        >
                            {item.isPersonal && (
                                <MaterialCommunityIcons name="check-circle" size={10} color="#FFF" />
                            )}
                            <Text
                                numberOfLines={1}
                                style={[
                                    styles.chipText,
                                    { color: '#FFF' }
                                ]}
                            >
                                {format(parseISO(item.startIso), 'HH:mm')} {item.title}
                            </Text>
                        </TouchableOpacity>
                    ))}
                    {dayItems.length > 3 && (
                        <Text style={[styles.moreText, { color: theme.textSecondary }]}>
                            +{dayItems.length - 3} more
                        </Text>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <ScrollView style={{ flex: 1 }}>
            <View style={styles.grid}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                    <View key={i} style={styles.headerCell}>
                        <Text style={[styles.headerText, { color: theme.textSecondary }]}>{d}</Text>
                    </View>
                ))}
                {days.map(day => renderDay(day))}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    headerCell: {
        width: '14.28%',
        height: 30,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    dayCell: {
        width: '14.28%',
        height: 110, // Increased height for chips
        borderRightWidth: 0.5,
        borderBottomWidth: 0.5,
        padding: 2,
    },
    dateNumberContainer: {
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 2,
        alignSelf: 'center',
    },
    dateNumber: {
        fontSize: 10,
        fontWeight: '600',
    },
    chipsContainer: {
        width: '100%',
        gap: 2,
        marginTop: 2,
    },
    chip: {
        width: '100%',
        borderRadius: 3,
        paddingHorizontal: 3,
        paddingVertical: 2,
        justifyContent: 'center',
    },
    chipText: {
        fontSize: 8,
        fontWeight: '500',
        includeFontPadding: false,
    },
    moreText: {
        fontSize: 8,
        textAlign: 'center',
        marginTop: 1,
    }
});
