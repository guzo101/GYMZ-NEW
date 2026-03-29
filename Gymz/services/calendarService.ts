import { supabase } from './supabase';
import { CalendarItem } from '../types/calendar';
import { format, parseISO } from 'date-fns';

export const CalendarService = {
    /**
     * Fetches all calendar items (schedules and events) for a given date range.
     * Merges personal selections to flag items as 'isPersonal'.
     * @param gymId - When set, filters events to only this gym's community events
     */
    async fetchItems(startKey: string, endKey: string, userId?: string, gymId?: string): Promise<CalendarItem[]> {
        console.log(`[CalendarService] Fetching from ${startKey} to ${endKey}${gymId ? ` (gym: ${gymId})` : ''}`);

        try {
            // 1. Fetch Schedules (Published only)
            const schedulesPromise = supabase
                .from('gym_class_schedules')
                .select(`
                    id, date, start_time, end_time, is_published,
                    gym_classes (id, name, description, difficulty, trainer_name, duration_minutes)
                `)
                .gte('date', startKey)
                .lte('date', endKey)
                .eq('is_published', true);

            // 2. Fetch Events (from the unified events table) — filter by gym when user has one
            let eventsQuery = supabase
                .from('events')
                .select('*')
                .gte('event_date', `${startKey}T00:00:00.000Z`)
                .lte('event_date', `${endKey}T23:59:59.999Z`)
                .eq('is_active', true);
            if (gymId) {
                eventsQuery = eventsQuery.eq('gym_id', gymId);
            }
            const eventsPromise = eventsQuery;

            // 3. Fetch User Selections (if logged in)
            let selectionsPromise: Promise<any> = Promise.resolve({ data: [] });
            if (userId) {
                // @ts-ignore
                selectionsPromise = supabase
                    .from('user_calendar_selections')
                    .select('schedule_id, event_id')
                    .eq('user_id', userId);
            }

            const [schedulesRes, eventsRes, selectionsRes] = await Promise.all([
                schedulesPromise,
                eventsPromise,
                selectionsPromise
            ]);

            if (schedulesRes.error) throw schedulesRes.error;
            if (eventsRes.error) throw eventsRes.error;

            // 4. Create Selection Sets for O(1) Lookup
            const selectedSchedules = new Set(selectionsRes.data?.map((s: any) => s.schedule_id).filter(Boolean));
            const selectedEvents = new Set(selectionsRes.data?.map((s: any) => s.event_id).filter(Boolean));

            const items: CalendarItem[] = [];

            // 5. Normalize Schedules
            schedulesRes.data?.forEach((s: any) => {
                // Defensive: ensure we have class data
                const classData = s.gym_classes;
                if (!classData) return;

                items.push({
                    id: `schedule-${s.id}`,
                    sourceId: s.id,
                    type: 'class',
                    startIso: `${s.date}T${s.start_time}`,
                    endIso: `${s.date}T${s.end_time}`,
                    dateKey: s.date,
                    title: classData.name,
                    subtitle: classData.trainer_name,
                    color: undefined, // Classes use default theme color usually
                    isPersonal: selectedSchedules.has(s.id),
                    isGymEvent: false,
                    isPublished: s.is_published,
                    metadata: {
                        difficulty: classData.difficulty,
                        trainerName: classData.trainer_name,
                        description: classData.description,
                        durationMinutes: classData.duration_minutes
                    }
                });
            });

            // 6. Normalize Events
            eventsRes.data?.forEach((e: any) => {
                // event_date in 'events' table is a timestamptz (ISO string)
                const eventDate = parseISO(e.event_date);
                const dateKey = format(eventDate, 'yyyy-MM-dd');

                items.push({
                    id: `event-${e.id}`,
                    sourceId: e.id,
                    type: 'event',
                    startIso: e.event_date,
                    endIso: e.end_date || e.event_date,
                    dateKey: dateKey,
                    title: e.title,
                    subtitle: e.event_type,
                    color: e.color,
                    isPersonal: selectedEvents.has(e.id),
                    isGymEvent: true,
                    isPublished: true,
                    metadata: {
                        description: e.description,
                        location: e.location,
                        originalDate: eventDate
                    }
                });
            });

            return items;

        } catch (error) {
            console.error('[CalendarService] Error:', error);
            throw error;
        }
    },

    /**
     * Toggle logic: Adds or Removes a selection.
     * Returns the NEW state (true = selected, false = unselected).
     */
    async toggleSelection(userId: string, item: CalendarItem): Promise<boolean> {
        const table = 'user_calendar_selections';

        // Determine if we are deleting or inserting
        // We can't trust item.isPersonal fully because it might be stale, 
        // but for an optimistic UI we usually do. 
        // Better pattern: Check existence first or optimize with "upsert" if unique constraints allow.
        // Given the constraints, we check existence.

        const column = item.type === 'class' ? 'schedule_id' : 'event_id';

        const { data: existing } = await supabase
            .from(table)
            .select('id')
            .eq('user_id', userId)
            // @ts-ignore
            .eq(column, item.sourceId)
            .single();

        if (existing) {
            // Remove
            // @ts-ignore
            await supabase.from(table).delete().eq('id', (existing as any).id);
            return false;
        } else {
            // Add
            // @ts-ignore
            await supabase.from(table).insert({
                user_id: userId,
                [column]: item.sourceId
            });
            return true;
        }
    }
};
