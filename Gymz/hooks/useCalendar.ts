import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    addMonths, subMonths, addWeeks, subWeeks,
    addDays, subDays, startOfMonth, endOfMonth,
    startOfWeek, endOfWeek, format, isSameMonth
} from 'date-fns';
import { CalendarItem, CalendarViewMode } from '../types/calendar';
import { CalendarService } from '../services/calendarService';
import { useAuth } from './useAuth';

export const useCalendar = () => {
    const { user } = useAuth();

    // -- State --
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
    const [items, setItems] = useState<CalendarItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [cache, setCache] = useState<Map<string, CalendarItem[]>>(new Map());

    // -- Navigation Logic --
    const navigate = useCallback((direction: 'prev' | 'next' | 'today') => {
        setCurrentDate(prev => {
            if (direction === 'today') return new Date();

            const isNext = direction === 'next';
            switch (viewMode) {
                case 'month':
                    return isNext ? addMonths(prev, 1) : subMonths(prev, 1);
                case 'week':
                    return isNext ? addWeeks(prev, 1) : subWeeks(prev, 1);
                case '3day':
                    return isNext ? addDays(prev, 3) : subDays(prev, 3);
                case 'day':
                case 'schedule': // Schedule view usually scrolls, but if we navigate via buttons:
                    return isNext ? addDays(prev, 1) : subDays(prev, 1);
                default:
                    return prev;
            }
        });
    }, [viewMode]);

    // -- Data Window Calculation --
    // We determine what range calls for "new data"
    const fetchWindow = useMemo(() => {
        const start = subMonths(startOfMonth(currentDate), 1); // Buffer Prev
        const end = addMonths(endOfMonth(currentDate), 1);     // Buffer Next
        return {
            start,
            end,
            key: format(currentDate, 'yyyy-MM') // Cache Key
        };
    }, [currentDate]);

    // -- Data Fetching --
    const refreshData = useCallback(async () => {
        setIsLoading(true);
        try {
            const startKey = format(fetchWindow.start, 'yyyy-MM-dd');
            const endKey = format(fetchWindow.end, 'yyyy-MM-dd');

            // Check In-Memory Cache first (Simple optimization)
            // Note: complex caching needs invalidation strategies, keeping it simple for now

            const fetchedItems = await CalendarService.fetchItems(
                startKey,
                endKey,
                user?.id,
                user?.gymId ?? undefined
            );

            setItems(fetchedItems);

            // Update Cache
            setCache(prev => {
                const newCache = new Map(prev);
                newCache.set(fetchWindow.key, fetchedItems);
                return newCache;
            });

        } catch (error) {
            console.error("Failed to load calendar", error);
        } finally {
            setIsLoading(false);
        }
    }, [fetchWindow, user?.id, user?.gymId]);

    // Initial Load & Updates
    useEffect(() => {
        refreshData();
    }, [refreshData]);

    // -- Selectors --
    const itemsForView = useMemo(() => {
        // Filter items based on viewMode if necessary, 
        // though usually the MonthView just takes them all and filters by day cell.
        return items;
    }, [items]);

    // -- Actions --
    const toggleItemSelection = useCallback(async (item: CalendarItem) => {
        if (!user) return;

        // Optimistic Update
        setItems(prev => prev.map(i =>
            i.id === item.id
                ? { ...i, isPersonal: !i.isPersonal }
                : i
        ));

        try {
            await CalendarService.toggleSelection(user.id, item);
        } catch (error) {
            // Revert on error
            setItems(prev => prev.map(i =>
                i.id === item.id
                    ? { ...i, isPersonal: !i.isPersonal }
                    : i
            ));
            console.error("Selection toggle failed", error);
        }
    }, [user]);

    return {
        currentDate,
        viewMode,
        setViewMode,
        navigate,
        items: itemsForView,
        isLoading,
        refresh: refreshData,
        toggleItemSelection
    };
};
