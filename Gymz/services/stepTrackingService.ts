/**
 * STEP TRACKING SERVICE - Reliable implementation using Expo Pedometer
 *
 * DIAGNOSIS (root cause of previous failure):
 * The app previously depended on a custom native module StepCounterModule from NativeModules.
 * That module was never implemented or registered in the Android project, so StepCounterModule
 * was undefined. Initialization always failed at "Native StepCounterModule not found" and no
 * step data was ever received.
 *
 * This implementation uses Expo's built-in Pedometer from expo-sensors (Android and iOS).
 * On Android, the native stack uses the step counter sensor; permissions are requested via
 * Pedometer.requestPermissionsAsync(). On iOS, CoreMotion/CMPedometer applies; foreground
 * step delivery follows Expo's Pedometer behavior (see expo-sensors docs for background notes).
 *
 * Pipeline layers (clearly separated):
 * 1. Permission: Pedometer.getPermissionsAsync / requestPermissionsAsync
 * 2. Capability: Pedometer.isAvailableAsync()
 * 3. Data source: Pedometer.watchStepCount (Android: cumulative since boot → daily via baseline)
 * 4. Storage: AsyncStorage daily baseline; healthService.syncSteps for server
 * 5. Display: callbacks.onStepsUpdate(stepsToday)
 */

import { Platform, AppState } from 'react-native';
import { Pedometer } from 'expo-sensors';
import type { EventSubscription } from 'expo-modules-core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { healthService } from './healthService';

const LOG_PREFIX = '[StepTrackingService]';

// Storage keys
const STORAGE_KEY_PREFIX = '@gymz_step_tracking_';
const KEY_TRACKING_ENABLED = `${STORAGE_KEY_PREFIX}enabled`;
const KEY_BASELINE_PREFIX = `${STORAGE_KEY_PREFIX}baseline_`; // KEY_BASELINE_PREFIX + "YYYY-MM-DD" = cumulative at start of day

// Configuration
const SYNC_INTERVAL_MS = 2 * 60 * 1000; // Sync to DB every 2 minutes
const MIN_STEPS_DELTA_TO_SYNC = 10;
const MIN_SYNC_GAP_MS = 30 * 1000; // Throttle forced sync calls

interface StepTrackingState {
    currentSteps: number;
    isAvailable: boolean;
    isTracking: boolean;
    error: string | null;
}

interface StepTrackingCallbacks {
    onStepsUpdate?: (steps: number) => void;
    onError?: (error: string) => void;
    onAvailabilityChange?: (available: boolean) => void;
}

function todayDateString(): string {
    return new Date().toISOString().split('T')[0];
}

class StepTrackingService {
    private syncInterval: ReturnType<typeof setInterval> | null = null;
    private subscription: EventSubscription | null = null;
    private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
    private callbacks: StepTrackingCallbacks = {};
    private userId: string | null = null;
    private lastSyncedSteps: number = 0;
    private currentSteps: number = 0;
    private isTrackingActive: boolean = false;
    private isAvailable: boolean = false;
    private lastCumulativeFromSensor: number = 0;
    private lastSyncAtMs: number = 0;

    async initialize(userId: string, callbacks?: StepTrackingCallbacks): Promise<boolean> {
        console.log(`${LOG_PREFIX} initialize() called`, { userId, platform: Platform.OS });

        if (Platform.OS === 'web') {
            console.log(`${LOG_PREFIX} Step tracking not supported on web`);
            this.isAvailable = false;
            this.callbacks.onAvailabilityChange?.(false);
            return false;
        }

        this.userId = userId;
        this.callbacks = callbacks || {};

        try {
            // --- LAYER 1: Permission ---
            let perm = await Pedometer.getPermissionsAsync();
            console.log(`${LOG_PREFIX} permission get:`, { status: perm.status, granted: perm.granted });

            if (!perm.granted) {
                perm = await Pedometer.requestPermissionsAsync();
                console.log(`${LOG_PREFIX} permission request result:`, { status: perm.status, granted: perm.granted });
            }

            if (!perm.granted) {
                const msg = perm.status === 'denied' && !perm.canAskAgain
                    ? 'Activity permission was denied. Enable it in app settings to track steps.'
                    : 'Activity permission is required to track steps.';
                console.warn(`${LOG_PREFIX} Permission not granted:`, perm.status);
                this.callbacks.onError?.(msg);
                this.callbacks.onAvailabilityChange?.(false);
                return false;
            }

            // --- LAYER 2: Capability ---
            const available = await Pedometer.isAvailableAsync();
            console.log(`${LOG_PREFIX} isAvailableAsync():`, available);

            this.isAvailable = available;
            this.callbacks.onAvailabilityChange?.(available);

            if (!available) {
                this.callbacks.onError?.('Step counter is not available on this device.');
                return false;
            }

            const isEnabled = await this.isTrackingEnabled();
            if (!isEnabled) {
                console.log(`${LOG_PREFIX} Tracking disabled by user (toggle off)`);
                return false;
            }

            this.stopSubscription();

            // --- LAYER 3: Data source - subscribe to step updates ---
            console.log(`${LOG_PREFIX} Subscribing to watchStepCount (subscription start)`);
            this.subscription = Pedometer.watchStepCount(async (result) => {
                const cumulative = result.steps;
                this.lastCumulativeFromSensor = cumulative;
                const stepsToday = await this.computeStepsToday(cumulative);
                console.log(`${LOG_PREFIX} incoming step values:`, { cumulative, stepsToday, date: todayDateString() });

                this.currentSteps = stepsToday;
                this.callbacks.onStepsUpdate?.(stepsToday);
                // Persist promptly so short sessions still reach Supabase.
                await this.syncWithDB(true);
            });

            this.isTrackingActive = true;

            // Initial read: we may not get an event immediately, so compute from last known cumulative or 0
            const initialSteps = this.lastCumulativeFromSensor > 0
                ? await this.computeStepsToday(this.lastCumulativeFromSensor)
                : await this.readInitialStepsFromBaseline();
            this.currentSteps = initialSteps;
            console.log(`${LOG_PREFIX} stored step values (initial):`, { currentSteps: this.currentSteps });
            this.callbacks.onStepsUpdate?.(this.currentSteps);

            this.setupPeriodicSync();

            this.appStateSubscription = AppState.addEventListener('change', (nextState) => {
                if (nextState === 'active') {
                    this.refreshStepsFromSensor();
                }
            });

            console.log(`${LOG_PREFIX} Initialization complete. Tracking active.`);
            return true;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`${LOG_PREFIX} Initialization failed:`, error);
            this.callbacks.onError?.(message);
            this.callbacks.onAvailabilityChange?.(false);
            return false;
        }
    }

    /**
     * On Android, the pedometer reports cumulative steps since boot.
     * We persist a baseline (cumulative at first read for this calendar day) and compute stepsToday = cumulative - baseline.
     * After device reboot, cumulative resets to 0; if cumulative < baseline we reset baseline to cumulative.
     */
    private async computeStepsToday(cumulative: number): Promise<number> {
        const today = todayDateString();
        const key = KEY_BASELINE_PREFIX + today;
        let baselineStr = await AsyncStorage.getItem(key);

        if (baselineStr == null || baselineStr === '') {
            await AsyncStorage.setItem(key, String(cumulative));
            console.log(`${LOG_PREFIX} baseline set for ${today}:`, cumulative);
            return 0;
        }

        let baseline = parseInt(baselineStr, 10);
        if (isNaN(baseline)) {
            await AsyncStorage.setItem(key, String(cumulative));
            return 0;
        }

        if (cumulative < baseline) {
            await AsyncStorage.setItem(key, String(cumulative));
            console.log(`${LOG_PREFIX} cumulative < baseline (e.g. reboot), baseline reset:`, cumulative);
            return 0;
        }

        return Math.max(0, cumulative - baseline);
    }

    private async readInitialStepsFromBaseline(): Promise<number> {
        const today = todayDateString();
        const key = KEY_BASELINE_PREFIX + today;
        const baselineStr = await AsyncStorage.getItem(key);
        if (baselineStr == null || baselineStr === '') return 0;
        const baseline = parseInt(baselineStr, 10);
        if (isNaN(baseline)) return 0;
        return Math.max(0, this.lastCumulativeFromSensor - baseline);
    }

    private stopSubscription(): void {
        if (this.subscription) {
            this.subscription.remove();
            this.subscription = null;
            console.log(`${LOG_PREFIX} watchStepCount subscription removed`);
        }
        if (this.appStateSubscription) {
            this.appStateSubscription.remove();
            this.appStateSubscription = null;
        }
    }

    private async refreshStepsFromSensor(): Promise<void> {
        if (!this.isTrackingActive) return;
        if (this.lastCumulativeFromSensor > 0) {
            const stepsToday = await this.computeStepsToday(this.lastCumulativeFromSensor);
            if (stepsToday !== this.currentSteps) {
                this.currentSteps = stepsToday;
                this.callbacks.onStepsUpdate?.(stepsToday);
                console.log(`${LOG_PREFIX} foreground refresh: displayed step values:`, stepsToday);
            }
        }
    }

    private setupPeriodicSync(): void {
        if (this.syncInterval) clearInterval(this.syncInterval);
        this.syncInterval = setInterval(() => {
            this.syncWithDB();
        }, SYNC_INTERVAL_MS);
    }

    private async syncWithDB(force: boolean = false): Promise<void> {
        if (!this.userId || !this.isTrackingActive) return;

        const now = Date.now();
        const delta = Math.abs(this.currentSteps - this.lastSyncedSteps);
        // Periodic sync: require min delta + avoid spamming the API.
        if (!force && delta < MIN_STEPS_DELTA_TO_SYNC) return;
        if (!force && (now - this.lastSyncAtMs) < MIN_SYNC_GAP_MS) return;
        // Forced sync (sensor callback): never time-throttle — the old 30s gate blocked
        // legitimate step bursts right after a successful sync, so rows lagged behind.
        if (force && delta <= 0) return;

        try {
            console.log(`${LOG_PREFIX} SYNC TO DB:`, { totalSteps: this.currentSteps, delta });
            await healthService.syncSteps(this.userId, this.currentSteps);
            this.lastSyncedSteps = this.currentSteps;
            this.lastSyncAtMs = now;
            console.log(`${LOG_PREFIX} DATABASE SYNC SUCCESS`);
        } catch (e) {
            console.error(`${LOG_PREFIX} Sync to DB failed:`, e);
        }
    }

    async isTrackingEnabled(): Promise<boolean> {
        const enabled = await AsyncStorage.getItem(KEY_TRACKING_ENABLED);
        return enabled === null || enabled === 'true';
    }

    async setTrackingEnabled(enabled: boolean): Promise<void> {
        await AsyncStorage.setItem(KEY_TRACKING_ENABLED, enabled ? 'true' : 'false');
        if (enabled) {
            if (this.userId) await this.initialize(this.userId, this.callbacks);
        } else {
            this.stopSubscription();
            this.isTrackingActive = false;
        }
    }

    getCurrentSteps(): number {
        return this.currentSteps;
    }

    getState(): StepTrackingState {
        return {
            currentSteps: this.currentSteps,
            isAvailable: this.isAvailable,
            isTracking: this.isTrackingActive,
            error: null,
        };
    }

    /**
     * Request permission only. Call this from UI (e.g. onboarding) so the app can show the system dialog.
     * Returns permission status; does not start tracking.
     */
    async requestPermissionOnly(): Promise<{ granted: boolean; status: string }> {
        if (Platform.OS === 'web') {
            return { granted: false, status: 'unsupported' };
        }
        try {
            const perm = await Pedometer.requestPermissionsAsync();
            console.log(`${LOG_PREFIX} requestPermissionOnly result:`, { status: perm.status, granted: perm.granted });
            return { granted: perm.granted ?? false, status: perm.status };
        } catch (e) {
            console.error(`${LOG_PREFIX} requestPermissionOnly failed:`, e);
            return { granted: false, status: 'error' };
        }
    }

    async cleanup(): Promise<void> {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        this.stopSubscription();
    }
}

export const stepTrackingService = new StepTrackingService();
