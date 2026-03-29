import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, ScrollView, Dimensions } from 'react-native';
import {
    subMonths, addMonths,
    subWeeks, addWeeks,
    subDays, addDays
} from 'date-fns';
import { useCalendar } from '../../hooks/useCalendar';
import { CalendarHeader } from './CalendarHeader';
import { UnifiedMonthView } from './views/UnifiedMonthView';
import { UnifiedTimeGridView } from './views/UnifiedTimeGridView';
import { UnifiedScheduleView } from './views/UnifiedScheduleView';
import { DynamicBackground } from '../dashboard/DynamicBackground';
import { useTheme } from '../../hooks/useTheme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PersonalEventModal } from './PersonalEventModal';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { hapticService } from '../../services/hapticService';
import { CalendarService } from '../../services/calendarService';
import { CalendarItem, CalendarViewMode } from '../../types/calendar';

import { CalendarDrawer } from './CalendarDrawer';

export const CalendarContainer = () => {
    const {
        currentDate,
        navigate,
        items,
        isLoading,
        refresh,
        toggleItemSelection,
        viewMode,
        setViewMode
    } = useCalendar();

    const { theme } = useTheme();
    const { user } = useAuth();
    const [isPersonalModalVisible, setIsPersonalModalVisible] = useState(false);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [showGymCalendar, setShowGymCalendar] = useState(true);
    const [showPersonalCalendar, setShowPersonalCalendar] = useState(true);

    const handleSavePersonalEvent = async (eventData: any) => {
        if (!user || !user.gymId) {
            Alert.alert("Error", "You must be associated with a gym to create personal events.");
            return;
        }

        hapticService.success();
        try {
            // eventData.date is YYYY-MM-DD
            // eventData.startTime is HH:mm
            const startIso = `${eventData.date}T${eventData.startTime || '00:00'}:00Z`;

            const { data, error } = await supabase
                .from('events')
                .insert([{
                    title: eventData.title,
                    event_date: startIso,
                    gym_id: user.gymId,
                    created_by: user.id,
                    event_type: 'Personal',
                    color: theme.primary,
                    is_active: true
                }] as any)
                .select()
                .single();

            if (error) throw error;

            refresh();

            Alert.alert("Success", "Personal event added!");
            setIsPersonalModalVisible(false);
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to save event.");
        }
    };

    const handleSelectItem = (item: CalendarItem) => {
        hapticService.selection();
        toggleItemSelection(item);
    };

    const filteredItems: CalendarItem[] = useMemo(() => {
        return items.filter(item => {
            if (item.isPersonal) return showPersonalCalendar;
            return showGymCalendar;
        });
    }, [items, showGymCalendar, showPersonalCalendar]);

    const [pageWidth, setPageWidth] = useState(Dimensions.get('window').width);
    const scrollViewRef = React.useRef<ScrollView>(null);
    const isNavigating = React.useRef(false);

    // VIRTUALIZED DATE BUFFER [Prev, Current, Next]
    const virtualDates = useMemo(() => {
        let prev, next;
        switch (viewMode) {
            case 'month':
                prev = subMonths(currentDate, 1);
                next = addMonths(currentDate, 1);
                break;
            case 'week':
                prev = subWeeks(currentDate, 1);
                next = addWeeks(currentDate, 1);
                break;
            case '3day':
                prev = subDays(currentDate, 3);
                next = addDays(currentDate, 3);
                break;
            case 'day':
            case 'schedule':
                prev = subDays(currentDate, 1);
                next = addDays(currentDate, 1);
                break;
            default:
                prev = currentDate;
                next = currentDate;
        }
        console.log(`[virtualDates] Recalculated: Prev=${prev.toISOString().split('T')[0]}, Current=${currentDate.toISOString().split('T')[0]}, Next=${next.toISOString().split('T')[0]}`);
        return [prev, currentDate, next];
    }, [currentDate, viewMode]);

    // POST-NAVIGATION SNAP-BACK
    // We wait for the navigation to complete, THEN snap back
    React.useEffect(() => {
        console.log(`[useEffect] Fired. isNavigating=${isNavigating.current}, pageWidth=${pageWidth}, currentDate=${currentDate.toISOString().split('T')[0]}`);
        if (isNavigating.current && scrollViewRef.current && pageWidth > 0) {
            console.log('[useEffect] Snap-back conditions met, scheduling snap...');
            // Small delay to let the new month render
            requestAnimationFrame(() => {
                console.log('[useEffect] Executing snap-back to center');
                scrollViewRef.current?.scrollTo({ x: pageWidth, animated: false });
                isNavigating.current = false;
            });
        }
    }, [currentDate, viewMode, pageWidth]);

    const handleScrollEnd = (e: any) => {
        const offset = e.nativeEvent.contentOffset.x;
        const page = Math.round(offset / pageWidth);

        console.log(`[handleScrollEnd] Offset: ${offset.toFixed(0)}, Width: ${pageWidth.toFixed(0)}, Page: ${page}`);

        if (page === 1) {
            console.log('[handleScrollEnd] On center page, ignoring');
            return;
        }

        // Mark that we're about to navigate
        isNavigating.current = true;
        console.log('[handleScrollEnd] Set isNavigating=true');
        hapticService.selection();

        if (page === 0) {
            console.log('[handleScrollEnd] Calling navigate(PREV)');
            navigate('prev');
            console.log('[handleScrollEnd] navigate(PREV) completed');
        } else if (page === 2) {
            console.log('[handleScrollEnd] Calling navigate(NEXT)');
            navigate('next');
            console.log('[handleScrollEnd] navigate(NEXT) completed');
        }
    };

    const renderPageView = (date: Date) => {
        const commonProps = {
            items: filteredItems,
            onSelectItem: handleSelectItem,
        };

        switch (viewMode) {
            case 'month':
                return (
                    <UnifiedMonthView
                        currentDate={date}
                        {...commonProps}
                        onSelectDate={(d) => console.log("Selected", d)}
                    />
                );
            case 'schedule':
                return <UnifiedScheduleView {...commonProps} />;
            case 'day':
            case '3day':
            case 'week':
                return (
                    <UnifiedTimeGridView
                        currentDate={date}
                        mode={viewMode}
                        {...commonProps}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <DynamicBackground rotationType="fixed" fixedIndex={4} />

            <CalendarHeader
                currentDate={currentDate}
                onMenuPress={() => setIsDrawerOpen(true)}
                onTodayPress={() => {
                    navigate('today');
                    hapticService.medium();
                }}
                onPrevPress={() => navigate('prev')}
                onNextPress={() => navigate('next')}
            />

            <View
                style={styles.content}
                onLayout={(e) => setPageWidth(e.nativeEvent.layout.width)}
            >
                {isLoading && items.length === 0 ? (
                    <View style={styles.loading}>
                        <ActivityIndicator size="large" color={theme.primary} />
                    </View>
                ) : (
                    <ScrollView
                        ref={scrollViewRef}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onMomentumScrollEnd={handleScrollEnd}
                        onScrollEndDrag={handleScrollEnd}
                        style={{ flex: 1 }}
                        scrollEventThrottle={16}
                        decelerationRate="fast"
                    >
                        {virtualDates.map((date, i) => (
                            <View key={date.getTime()} style={{ width: pageWidth }}>
                                {renderPageView(date)}
                            </View>
                        ))}
                    </ScrollView>
                )}
            </View>

            <CalendarDrawer
                isVisible={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                currentView={viewMode as any}
                onSelectView={(v: any) => {
                    setViewMode(v);
                    setIsDrawerOpen(false);
                }}
                showGymCalendar={showGymCalendar}
                showPersonalCalendar={showPersonalCalendar}
                onToggleGym={() => setShowGymCalendar(!showGymCalendar)}
                onTogglePersonal={() => setShowPersonalCalendar(!showPersonalCalendar)}
            />

            <TouchableOpacity
                style={[styles.floatingButton, { backgroundColor: theme.primary }]}
                onPress={() => {
                    hapticService.medium();
                    setIsPersonalModalVisible(true);
                }}
            >
                <MaterialCommunityIcons name="plus" size={32} color="#FFF" />
            </TouchableOpacity>

            <PersonalEventModal
                isVisible={isPersonalModalVisible}
                onClose={() => setIsPersonalModalVisible(false)}
                onSave={handleSavePersonalEvent}
                initialDate={currentDate}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
    },
    loading: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.1)'
    },
    floatingButton: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.27,
        shadowRadius: 4.65,
    },
});
