/**
 * STEP TRACKING HOOK
 *
 * Wraps stepTrackingService (Expo Pedometer) on native platforms. Web is unsupported.
 */

import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { stepTrackingService } from '../services/stepTrackingService';
import { useAuth } from './useAuth';

interface StepTrackingData {
    currentSteps: number;
    isAvailable: boolean;
    isTracking: boolean;
    error: string | null;
    lastSyncTime: number | null;
}

/**
 * Hook for step tracking
 * Provides current step count and tracking status
 */
export function useStepTracking(): StepTrackingData {
    const { user } = useAuth();
    const userId = user?.id;

    const [state, setState] = useState<StepTrackingData>({
        currentSteps: 0,
        isAvailable: false,
        isTracking: false,
        error: null,
        lastSyncTime: null,
    });

    const initializedRef = useRef(false);

    useEffect(() => {
        if (!userId) {
            // Clear state if user logs out
            setState({
                currentSteps: 0,
                isAvailable: false,
                isTracking: false,
                error: null,
                lastSyncTime: null,
            });
            initializedRef.current = false;
            return;
        }

        // Only initialize once per user
        if (initializedRef.current) {
            return;
        }

        const initialize = async () => {
            if (Platform.OS === 'web') {
                initializedRef.current = true;
                setState(prev => ({
                    ...prev,
                    isAvailable: false,
                    isTracking: false,
                    error: null,
                }));
                return;
            }

            initializedRef.current = true;

            const success = await stepTrackingService.initialize(userId, {
                onStepsUpdate: (steps) => {
                    console.log('[useStepTracking] displayed step values:', steps);
                    setState(prev => ({
                        ...prev,
                        currentSteps: steps,
                        error: null,
                    }));
                },
                onError: (error) => {
                    console.error('[useStepTracking] Error:', error);
                    setState(prev => ({
                        ...prev,
                        error,
                    }));
                },
                onAvailabilityChange: (available) => {
                    console.log('[useStepTracking] Availability changed:', available);
                    setState(prev => ({
                        ...prev,
                        isAvailable: available,
                    }));
                },
            });

            if (success) {
                const initialState = stepTrackingService.getState();
                console.log('[useStepTracking] initialization success, state:', initialState);
                setState({
                    currentSteps: initialState.currentSteps,
                    isAvailable: initialState.isAvailable,
                    isTracking: initialState.isTracking,
                    error: initialState.error,
                    lastSyncTime: null,
                });
            } else {
                console.log('[useStepTracking] initialization returned false (check permission, capability, or service logs)');
            }
        };

        initialize();

        // Cleanup on unmount
        // Note: We don't necessarily want to STOP tracking when the hook unmounts,
        // as we want background tracking. But we can cleanup listeners if any.
        return () => {
            // stepTrackingService.cleanup() cleared DB sync interval, which we might want to keep running if app is in background.
            // But if the user logs out, userId changes and handled by the first useEffect branch.
        };
    }, [userId]);

    return state;
}
