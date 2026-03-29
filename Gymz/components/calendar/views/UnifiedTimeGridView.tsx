import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity } from 'react-native';
import { format, addDays, startOfDay, differenceInMinutes, startOfWeek, isSameDay, parseISO } from 'date-fns';
import { useTheme } from '../../../hooks/useTheme';
import { CalendarItem } from '../../../types/calendar';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface UnifiedTimeGridViewProps {
    currentDate: Date;
    mode: 'day' | '3day' | 'week';
    items: CalendarItem[];
    onSelectItem: (item: CalendarItem) => void;
}

const HOUR_HEIGHT = 60;
const START_HOUR = 6; // 6 AM
const END_HOUR = 22; // 10 PM
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => i + START_HOUR);

export const UnifiedTimeGridView: React.FC<UnifiedTimeGridViewProps> = ({
    currentDate,
    mode,
    items,
    onSelectItem
}) => {
    const { theme } = useTheme();
    const { width } = Dimensions.get('window');

    // Calculate columns
    const { days, columnWidth } = useMemo(() => {
        let daysToShow = 1;
        let startDate = currentDate;

        if (mode === 'week') {
            daysToShow = 7;
            startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
        } else if (mode === '3day') {
            daysToShow = 3;
            startDate = currentDate;
        }

        const cols = Array.from({ length: daysToShow }, (_, i) => addDays(startDate, i));
        const colWidth = (width - 50) / daysToShow; // 50px for time axis
        return { days: cols, columnWidth: colWidth };
    }, [currentDate, mode, width]);

    // Group items by dateKey for easy column lookup
    const itemsByDate = useMemo(() => {
        const map = new Map<string, CalendarItem[]>();
        items.forEach(item => {
            const key = item.dateKey;
            if (!map.has(key)) map.set(key, []);
            map.get(key)?.push(item);
        });
        return map;
    }, [items]);

    const renderEventsInColumn = (day: Date) => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const dayItems = itemsByDate.get(dateKey) || [];

        return dayItems.map((item) => {
            const start = parseISO(item.startIso);
            const end = parseISO(item.endIso);

            const startHours = start.getHours();
            const startMinutes = start.getMinutes();
            const duration = differenceInMinutes(end, start);

            const topOffset = ((startHours - START_HOUR) * HOUR_HEIGHT) + (startMinutes * (HOUR_HEIGHT / 60));
            const height = (duration / 60) * HOUR_HEIGHT;

            if (topOffset < 0) return null; // Before start hour

            return (
                <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.8}
                    onPress={() => onSelectItem(item)}
                    style={[
                        styles.eventCard,
                        {
                            top: topOffset,
                            height: Math.max(height, 25),
                            backgroundColor: item.isPersonal ? theme.success : (item.color || theme.primary),
                            width: columnWidth - 4,
                            left: 2,
                        },
                        item.isPersonal && { borderWidth: 2, borderColor: '#FFF' }
                    ]}
                >
                    <View style={styles.cardHeader}>
                        {item.isPersonal && <MaterialCommunityIcons name="check-circle" size={10} color="#FFF" />}
                        <Text style={styles.eventText} numberOfLines={1}>
                            {item.title}
                        </Text>
                    </View>
                    {height > 30 && (
                        <Text style={styles.eventTimeText} numberOfLines={1}>
                            {format(start, 'HH:mm')} - {format(end, 'HH:mm')}
                        </Text>
                    )}
                </TouchableOpacity>
            );
        });
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.gridContainer}>
                {/* Time Axis */}
                <View style={[styles.timeColumn, { width: 50, borderRightColor: theme.border, borderRightWidth: 1 }]}>
                    <View style={{ height: 50, borderBottomWidth: 1, borderBottomColor: theme.border }} />
                    {HOURS.map(hour => (
                        <View key={hour} style={[styles.timeSlot, { height: HOUR_HEIGHT }]}>
                            <Text style={[styles.timeText, { color: theme.textMuted }]}>
                                {hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`}
                            </Text>
                        </View>
                    ))}
                </View>

                {/* Day Columns */}
                <ScrollView horizontal scrollEnabled={mode !== 'day'} style={{ flex: 1 }}>
                    {days.map((day, colIndex) => (
                        <View
                            key={colIndex}
                            style={[
                                styles.dayColumn,
                                {
                                    width: columnWidth,
                                    borderRightWidth: colIndex < days.length - 1 ? 0.5 : 0,
                                    borderRightColor: theme.border
                                }
                            ]}
                        >
                            <View style={[styles.dayHeader, { borderBottomColor: theme.border, borderBottomWidth: 1 }]}>
                                <Text style={[styles.dayName, { color: theme.textMuted }]}>{format(day, 'EEE')}</Text>
                                <View style={[
                                    styles.dayNumberCircle,
                                    isSameDay(day, new Date()) && { backgroundColor: theme.primary }
                                ]}>
                                    <Text style={[
                                        styles.dayNumber,
                                        { color: isSameDay(day, new Date()) ? '#FFF' : theme.text }
                                    ]}>
                                        {format(day, 'd')}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.dayEventsContainer}>
                                {HOURS.map(h => (
                                    <View key={`grid-${h}`} style={[styles.gridLine, { height: HOUR_HEIGHT, borderBottomColor: theme.border }]} />
                                ))}
                                {renderEventsInColumn(day)}
                            </View>
                        </View>
                    ))}
                </ScrollView>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    gridContainer: {
        flexDirection: 'row',
    },
    timeColumn: {
        backgroundColor: 'transparent'
    },
    timeSlot: {
        justifyContent: 'flex-start',
        alignItems: 'center',
        transform: [{ translateY: -8 }]
    },
    timeText: {
        fontSize: 10,
    },
    dayColumn: {
        flexDirection: 'column',
    },
    dayHeader: {
        height: 50,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 4,
    },
    dayName: {
        fontSize: 10,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    dayNumberCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dayNumber: {
        fontSize: 14,
        fontWeight: '500',
    },
    dayEventsContainer: {
        position: 'relative',
    },
    gridLine: {
        width: '100%',
        borderBottomWidth: 0.5,
        opacity: 0.2,
    },
    eventCard: {
        position: 'absolute',
        borderRadius: 4,
        padding: 4,
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    eventText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
    eventTimeText: {
        color: '#FFF',
        fontSize: 8,
        marginTop: 2,
    }
});
