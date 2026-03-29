/**
 * Request ALL app permissions at startup (upon first launch after install).
 * Requesting upfront ensures features work immediately when the user needs them.
 */
import { Platform, NativeModules, PermissionsAndroid } from 'react-native';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as Notifications from 'expo-notifications';

const { StepCounterModule } = NativeModules;

export async function requestAllPermissionsAtStartup(): Promise<void> {
  if (Platform.OS === 'web') return;

  const results: Record<string, string> = {};

  try {
    // 1. Camera
    const camera = await Camera.requestCameraPermissionsAsync();
    results.camera = camera.status;
  } catch (e) {
    console.warn('[Permissions] Camera request failed:', e);
  }

  try {
    // 2. Media picker
    const mediaPicker = await ImagePicker.requestMediaLibraryPermissionsAsync();
    results.mediaPicker = mediaPicker.status;
  } catch (e) {
    console.warn('[Permissions] Media picker request failed:', e);
  }

  try {
    // 3. Media save
    const mediaSave = await MediaLibrary.requestPermissionsAsync();
    results.mediaSave = mediaSave.status;
  } catch (e) {
    console.warn('[Permissions] Media save request failed:', e);
  }

  try {
    // 4. Notifications
    const notifications = await Notifications.requestPermissionsAsync();
    results.notifications = notifications.status;
  } catch (e) {
    console.warn('[Permissions] Notifications request failed:', e);
  }

  try {
    // 5. Pedometer / Physical Activity
    if (Platform.OS === 'android') {
      console.log('[Permissions] Requesting ACTIVITY_RECOGNITION...');
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION
      );
      results.pedometer = granted === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied';

      if (results.pedometer === 'granted' && StepCounterModule) {
        console.log('[Permissions] Starting StepCounterModule...');
        await StepCounterModule.startTracking();
      }
    } else {
      results.pedometer = 'unavailable';
    }
  } catch (e) {
    console.error('[Permissions] Pedometer request failed:', e);
    results.pedometer = 'error';
  }

  console.log('[Permissions] Startup permission results:', results);
}
