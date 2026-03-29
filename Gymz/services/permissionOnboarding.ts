/**
 * PERMISSION ONBOARDING SYSTEM
 * 
 * Professional permission request flow that:
 * - Requests permissions sequentially with clear explanations
 * - Stores permission state to avoid re-requesting
 * - Handles denied permissions gracefully
 * - Provides user-friendly permission descriptions
 */

import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as Notifications from 'expo-notifications';
import { Pedometer } from 'expo-sensors';

const STORAGE_KEY_PERMISSIONS_REQUESTED = '@gymz_permissions_requested';
const STORAGE_KEY_PERMISSIONS_STATE = '@gymz_permissions_state';

interface PermissionResult {
  permission: string;
  status: 'granted' | 'denied' | 'undetermined';
  canAskAgain: boolean;
}

interface PermissionState {
  [key: string]: PermissionResult;
}

/**
 * Permission definitions with user-friendly descriptions
 */
const PERMISSION_DEFINITIONS = {
  camera: {
    name: 'Camera',
    description: 'Allow Gymz to access your camera to scan QR codes for check-in and barcode scanning for nutrition logging.',
    androidPermission: 'CAMERA',
    required: true,
  },
  mediaLibrary: {
    name: 'Photos',
    description: 'Allow Gymz to access your photos to upload profile pictures, progress snapshots, and community posts.',
    androidPermission: 'READ_MEDIA_IMAGES',
    required: true,
  },
  mediaSave: {
    name: 'Save Photos',
    description: 'Allow Gymz to save comparison images and screenshots to your gallery.',
    androidPermission: 'WRITE_EXTERNAL_STORAGE',
    required: false,
  },
  notifications: {
    name: 'Notifications',
    description: 'Allow Gymz to send you workout reminders, nutrition nudges, and important updates.',
    androidPermission: 'POST_NOTIFICATIONS',
    required: false,
  },
  activityRecognition: {
    name: 'Physical Activity',
    description: 'Allow Gymz to track your steps and physical activity to help you reach your fitness goals.',
    androidPermission: 'ACTIVITY_RECOGNITION',
    required: true,
  },
};

/**
 * Check if permissions have already been requested
 */
async function havePermissionsBeenRequested(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEY_PERMISSIONS_REQUESTED);
    return value === 'true';
  } catch {
    return false;
  }
}

/**
 * Mark permissions as requested
 */
async function markPermissionsAsRequested(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_PERMISSIONS_REQUESTED, 'true');
  } catch (error) {
    console.error('[PermissionOnboarding] Error marking permissions as requested:', error);
  }
}

/**
 * Get stored permission state
 */
async function getStoredPermissionState(): Promise<PermissionState> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEY_PERMISSIONS_STATE);
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
}

/**
 * Store permission state
 */
async function storePermissionState(state: PermissionState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_PERMISSIONS_STATE, JSON.stringify(state));
  } catch (error) {
    console.error('[PermissionOnboarding] Error storing permission state:', error);
  }
}

/**
 * Request a single permission with user-friendly explanation
 */
async function requestPermissionWithExplanation(
  key: keyof typeof PERMISSION_DEFINITIONS
): Promise<PermissionResult> {
  const definition = PERMISSION_DEFINITIONS[key];

  console.log(`[PermissionOnboarding] Requesting ${definition.name} permission...`);

  try {
    let result: PermissionResult;

    switch (key) {
      case 'camera': {
        const response = await Camera.requestCameraPermissionsAsync();
        result = {
          permission: key,
          status: response.status === 'granted' ? 'granted' : 'denied',
          canAskAgain: response.canAskAgain ?? true,
        };
        break;
      }
      case 'mediaLibrary': {
        const response = await ImagePicker.requestMediaLibraryPermissionsAsync();
        result = {
          permission: key,
          status: response.status === 'granted' ? 'granted' : 'denied',
          canAskAgain: response.canAskAgain ?? true,
        };
        break;
      }
      case 'mediaSave': {
        const response = await MediaLibrary.requestPermissionsAsync();
        result = {
          permission: key,
          status: response.status === 'granted' ? 'granted' : 'denied',
          canAskAgain: response.canAskAgain ?? true,
        };
        break;
      }
      case 'notifications': {
        const response = await Notifications.requestPermissionsAsync();
        result = {
          permission: key,
          status: response.status === 'granted' ? 'granted' : 'denied',
          canAskAgain: response.canAskAgain ?? true,
        };
        break;
      }
      case 'activityRecognition': {
        if (Platform.OS === 'web') {
          result = {
            permission: key,
            status: 'undetermined',
            canAskAgain: false,
          };
          break;
        }
        try {
          console.log('[PermissionOnboarding] Requesting motion / pedometer permission...');
          let perm = await Pedometer.getPermissionsAsync();
          if (!perm.granted) {
            perm = await Pedometer.requestPermissionsAsync();
          }
          result = {
            permission: key,
            status: perm.granted ? 'granted' : 'denied',
            canAskAgain: perm.canAskAgain ?? true,
          };
        } catch (e) {
          console.error('[PermissionOnboarding] Pedometer permission error:', e);
          result = {
            permission: key,
            status: 'denied',
            canAskAgain: false,
          };
        }
        break;
      }
      default:
        result = {
          permission: key,
          status: 'undetermined',
          canAskAgain: true,
        };
    }

    console.log(`[PermissionOnboarding] ${definition.name} permission result:`, result);
    return result;
  } catch (error) {
    console.error(`[PermissionOnboarding] Error requesting ${definition.name} permission:`, error);
    return {
      permission: key,
      status: 'denied',
      canAskAgain: false,
    };
  }
}

/**
 * Show alert for denied required permission
 */
function showPermissionDeniedAlert(permissionName: string): void {
  Alert.alert(
    'Permission Required',
    `${permissionName} permission is required for Gymz to function properly. You can enable it later in Settings.`,
    [{ text: 'OK' }]
  );
}

/**
 * Run permission onboarding flow
 * 
 * This should be called on first app launch or when permissions haven't been requested yet.
 * Requests permissions sequentially with brief delays for better UX.
 */
export async function runPermissionOnboarding(): Promise<PermissionState> {
  if (Platform.OS === 'web') {
    console.log('[PermissionOnboarding] Skipping permissions on web');
    return {};
  }

  // Check if already requested
  const alreadyRequested = await havePermissionsBeenRequested();
  const storedState = await getStoredPermissionState();

  // If already requested and we have stored state, return it
  if (alreadyRequested && Object.keys(storedState).length > 0) {
    console.log('[PermissionOnboarding] Permissions already requested, using stored state');
    return storedState;
  }

  console.log('[PermissionOnboarding] Starting permission onboarding flow...');

  const results: PermissionState = {};

  // Request permissions sequentially
  const permissionOrder: (keyof typeof PERMISSION_DEFINITIONS)[] = [
    'camera',
    'mediaLibrary',
    'mediaSave',
    'notifications',
    'activityRecognition',
  ];

  for (const permissionKey of permissionOrder) {
    const definition = PERMISSION_DEFINITIONS[permissionKey];

    // Skip if already granted in stored state
    if (storedState[permissionKey]?.status === 'granted') {
      console.log(`[PermissionOnboarding] ${definition.name} already granted, skipping`);
      results[permissionKey] = storedState[permissionKey];
      continue;
    }

    // Request permission
    const result = await requestPermissionWithExplanation(permissionKey);
    results[permissionKey] = result;

    // If required permission denied, show alert
    if (definition.required && result.status === 'denied' && !result.canAskAgain) {
      showPermissionDeniedAlert(definition.name);
    }

    // Small delay between requests for better UX
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Store results
  await storePermissionState(results);
  await markPermissionsAsRequested();

  console.log('[PermissionOnboarding] Permission onboarding complete:', results);
  return results;
}

/**
 * Check current permission statuses without requesting
 */
export async function checkPermissionStatuses(): Promise<PermissionState> {
  const storedState = await getStoredPermissionState();
  return storedState;
}

/**
 * Get permission status for a specific permission
 */
export async function getPermissionStatus(
  key: keyof typeof PERMISSION_DEFINITIONS
): Promise<PermissionResult | null> {
  const state = await checkPermissionStatuses();
  return state[key] || null;
}
