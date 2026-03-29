import React, { useMemo } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity } from 'react-native';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../../hooks/useTheme';
import { CalendarItem } from '../../../types/calendar';

interface UnifiedScheduleViewProps {
    items: CalendarItem[];
    onSelectItem: (item: CalendarItem) => void;
}

export const UnifiedScheduleView: React.FC<UnifiedScheduleViewProps> = ({
    items,
    onSelectItem
}) => {
    const { theme } = useTheme();

    // Group items by date headers
    const sections = useMemo(() => {
        const groups: Record<string, CalendarItem[]> = {};

        // Sort items by time first
        const sortedItems = [...items].sort((a, b) => a.startIso.localeCompare(b.startIso));

        sortedItems.forEach(item => {
            if (!groups[item.dateKey]) {
                groups[item.dateKey] = [];
            }
            groups[item.dateKey].push(item);
        });

        return Object.keys(groups)
            .sort()
            .map(dateKey => ({
                title: dateKey,
                data: groups[dateKey]
            }));
    }, [items]);

    const formatSectionHeader = (dateStr: string) => {
        const date = parseISO(dateStr);
        if (isToday(date)) return 'Today';
        if (isTomorrow(date)) return 'Tomorrow';
        return format(date, 'EEEE, MMMM d');
    };

    const renderItem = ({ item }: { item: CalendarItem }) => {
        const color = item.isPersonal ? theme.success : (item.color || theme.primary);
        const startTime = format(parseISO(item.startIso), 'HH:mm');

        return (
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => onSelectItem(item)}
                style={styles.itemContainer}
            >
                <View style={styles.timeColumn}>
                    <Text style={[styles.timeText, { color: theme.text }]}>
                        {startTime} - {format(parseISO(item.endIso), 'HH:mm')}
                    </Text>
                    {item.metadata.durationMinutes && (
                        <Text style={[styles.durationText, { color: theme.textMuted }]}>
                            {item.metadata.durationMinutes}m
                        </Text>
                    )}
                </View>

                <View style={[
                    styles.card,
                    {
                        backgroundColor: item.isPersonal ? `${theme.success}15` : theme.backgroundCard,
                        borderLeftColor: color,
                        borderLeftWidth: 4,
                        borderWidth: item.isPersonal ? 1 : 0,
                        borderColor: item.isPersonal ? color : 'transparent'
                    }
                ]}>
                    <View style={styles.cardContent}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.itemTitle, { color: theme.text }]}>
                                {item.title}
                            </Text>
                            {item.subtitle && (
                                <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                                    {item.subtitle}
                                </Text>
                            )}
                        </View>
                        {item.isPersonal && (
                            <MaterialCommunityIcons name="check-circle" size={20} color={theme.success} />
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            renderSectionHeader={({ section: { title } }) => (
                <View style={[styles.headerContainer, { backgroundColor: theme.background }]}>
                    <Text style={[styles.headerText, { color: theme.text }]}>
                        {formatSectionHeader(title)}
                    </Text>
                </View>
            )}
            contentContainerStyle={styles.listContent}
            stickySectionHeadersEnabled={false}
        />
    );
};

const styles = StyleSheet.create({
    listContent: {
        paddingBottom: 40,
        paddingTop: 10,
    },
    headerContainer: {
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    headerText: {
        fontSize: 14,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        opacity: 0.8,
    },
    itemContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    timeColumn: {
        width: 60,
        paddingTop: 4,
    },
    timeText: {
        fontSize: 15,
        fontWeight: '600',
    },
    durationText: {
        fontSize: 11,
    },
    card: {
        flex: 1,
        padding: 12,
        borderRadius: 12,
        borderLeftWidth: 4,
    },
    cardContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    itemTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    subtitle: {
        fontSize: 13,
    }
});
