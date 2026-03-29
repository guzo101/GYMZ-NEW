import { useState, useEffect, useCallback } from 'react';
import { Camera, useCameraPermissions } from 'expo-camera';
import { Platform } from 'react-native';

export interface CameraPermissionState {
    hasPermission: boolean | null;
    canAskAgain: boolean;
    isRefreshing: boolean;
    requestPermission: () => Promise<boolean>;
}

/**
 * Standardized hook for camera permissions across the app.
 * Handles proactive checks and provides a consistent interface.
 */
export function useCamera() {
    const [permission, requestPermissionNative] = useCameraPermissions();
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Standardized permission check
    const checkPermission = useCallback(async () => {
        if (Platform.OS === 'web') return true;

        if (!permission) return null;

        return permission.granted;
    }, [permission]);

    const request = useCallback(async () => {
        setIsRefreshing(true);
        try {
            const result = await requestPermissionNative();
            return result.granted;
        } catch (error) {
            console.error('[useCamera] Error requesting permission:', error);
            return false;
        } finally {
            setIsRefreshing(false);
        }
    }, [requestPermissionNative]);

    // Proactive check removed to avoid intrusive permission prompts on every mount.
    // Permissions should be requested manually via the returned requestPermission function.

    return {
        hasPermission: Platform.OS === 'web' ? true : (permission ? permission.granted : null),
        canAskAgain: permission ? permission.canAskAgain : true,
        isRefreshing,
        requestPermission: request,
    };
}
