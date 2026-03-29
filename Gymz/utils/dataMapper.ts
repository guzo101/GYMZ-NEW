/**
 * CANONICAL NAMING DICTIONARY & DATA MAPPER
 * 
 * Enforces strict separation between snake_case (Database) and camelCase (Application).
 * 
 * GLOBAL RULES:
 * 1. App Layer MUST ONLY use camelCase models.
 * 2. Database layer MUST ONLY use snake_case payloads.
 * 3. Mixed objects are blocked.
 */

// Helper to check if a string is snake_case (contains an underscore and lowercase letters)
const isSnakeCase = (str: string) => /^[a-z0-9]+(_[a-z0-9]+)*$/.test(str) && str.includes('_');

// Helper to check if a string is camelCase
const isCamelCase = (str: string) => /^[a-z][a-zA-Z0-9]*$/.test(str) && !str.includes('_');

// Convert snake_case to camelCase
const snakeToCamel = (str: string): string => {
    // If it's already camelCase (has uppercase) and has no underscores, return as is
    if (!str.includes('_') && /[A-Z]/.test(str)) {
        return str;
    }
    // Otherwise, do the standard conversion
    return str.toLowerCase().replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());
};

// Convert camelCase to snake_case
const camelToSnake = (str: string): string =>
    str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

export class DataMapper {
    /**
     * READ GUARD: fromDb
     * Converts a snake_case database row object into a strict camelCase application object.
     * Discards or warns on arbitrary non-snake-case keys if they violate DB norms, 
     * but primarily ensures the app only gets camelCase.
     */
    static fromDb<TApp = any>(dbRow: any): TApp {
        if (!dbRow || typeof dbRow !== 'object') return dbRow as any;

        // Arrays: map over elements
        if (Array.isArray(dbRow)) {
            return dbRow.map(item => this.fromDb(item)) as any;
        }

        const appObj: Record<string, any> = {};

        for (const [key, value] of Object.entries(dbRow)) {
            // Special case: Supabase sometimes returns exact matches for system columns or relationships
            // Convert key to camelCase
            const camelKey = snakeToCamel(key);

            // Recursively map objects (useful for nested joins)
            if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
                appObj[camelKey] = this.fromDb(value);
            } else {
                appObj[camelKey] = value;
            }
        }

        return appObj as TApp;
    }

    /**
     * WRITE GUARD: toDb
     * Validates that the application payload strictly uses camelCase before converting to snake_case.
     * BLOCKS mixed objects or raw snake_case keys leaking from the UI.
     */
    static toDb<TDb = any>(appModel: any): TDb {
        if (!appModel || typeof appModel !== 'object') return appModel as any;

        if (Array.isArray(appModel)) {
            return appModel.map(item => this.toDb(item)) as any;
        }

        const dbObj: Record<string, any> = {};

        for (const [key, value] of Object.entries(appModel)) {
            // STRICT RUNTIME GUARD: Block explicit snake_case keys coming from App Layer
            if (key.includes('_')) {
                const errorMsg = `[StrictDataMapper] FATAL: snake_case key '${key}' detected in application payload. The App layer must use camelCase exclusively.`;
                if (__DEV__) {
                    throw new Error(errorMsg);
                } else {
                    console.error(errorMsg); // In prod, log loud error but try to sanitize safely
                }
            }

            const snakeKey = camelToSnake(key);

            if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
                dbObj[snakeKey] = this.toDb(value);
            } else {
                dbObj[snakeKey] = value;
            }
        }

        return dbObj as TDb;
    }
}

// Global declaration for dev mode (handled by bundlers like Metro/Vite)
declare const __DEV__: boolean;
