export type CalendarViewMode = 'month' | 'week' | 'day' | '3day' | 'schedule';

export interface CalendarItemMetadata {
    difficulty?: string;
    slotsAvailable?: number;
    trainerName?: string;
    location?: string;
    description?: string;
    durationMinutes?: number;
    originalDate?: Date; // For timezone debugging
}

export interface CalendarItem {
    id: string;              // Unique ID for the UI key (prefix + original ID)
    sourceId: string;        // Original DB UUID
    type: 'class' | 'event';

    // Normalized Time (ISO Strings for easy comparison)
    startIso: string;
    endIso: string;
    dateKey: string;         // YYYY-MM-DD

    // Display Attributes
    title: string;
    subtitle?: string;
    color?: string;

    // Status Flags
    isPersonal: boolean;     // Is this in user's personal selections?
    isGymEvent: boolean;     // Is this a global gym event?
    isPublished: boolean;

    metadata: CalendarItemMetadata;
}
