import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { getAuthLogoLayout } from '../../utils/authScreenLogoLayout';
import { SplashBackground } from './SplashBackground';
import { SplashLogo } from './SplashLogo';

/** Splash tagline — green theme (primary brand). */
const SPLASH_TAGLINE_COLOR = '#2A4B2A';
const SPLASH_TAGLINE_FADE_MS = 520;
const SPLASH_TAGLINE_MARGIN_TOP = 16;

const MIN_DISPLAY_MS = 2200; // Fallback max wait if logo callback doesn't fire
/** Fade duration for merge with next screen (splash fades out, main app fades in together). */
export const SPLASH_MERGE_FADE_MS = 220;

/** Splash-only: logo larger than auth screen (scale factor). */
const SPLASH_LOGO_SIZE_SCALE = 1.18;
/** Splash-only: move logo down from auth position (dp). */
const SPLASH_LOGO_OFFSET_DOWN_DP = 40;

interface AnimatedSplashScreenProps {
  /** When true, app is ready and we can transition out */
  isReady?: boolean;
  /** Called when exit animation starts (parent can fade in main app) */
  onExitStart?: () => void;
  /** Called when splash exit animation completes */
  onTransitionComplete?: () => void;
}

/**
 * Animated splash screen: theme-aware gradient, logo reveal.
 * Exit: fade out only — merges with next screen via crossfade (main app fades in same duration).
 */
export function AnimatedSplashScreen({
  isReady = false,
  onExitStart,
  onTransitionComplete,
}: AnimatedSplashScreenProps) {
  const [exiting, setExiting] = useState(false);
  const [canTransition, setCanTransition] = useState(false);
  const [logoAnimationComplete, setLogoAnimationComplete] = useState(false);
  const [splashContentLaidOut, setSplashContentLaidOut] = useState(false);
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const hasCompleted = useRef(false);
  const insets = useSafeAreaInsets();
  const { width, height } = Dimensions.get('window');
  const authLogoLayout = getAuthLogoLayout(width, height, insets);
  const splashLogoSize = Math.round(authLogoLayout.logoSize * SPLASH_LOGO_SIZE_SCALE);
  const splashLogoTopPx = authLogoLayout.logoTopPx + SPLASH_LOGO_OFFSET_DOWN_DP;

  // Hide native splash only after our splash content (including logo) has laid out,
  // so the Gymz logo is visible every time and no blank frame is shown.
  useEffect(() => {
    if (!splashContentLaidOut) return;
    const frame = requestAnimationFrame(() => {
      ExpoSplashScreen.hideAsync().catch(() => {});
    });
    return () => cancelAnimationFrame(frame);
  }, [splashContentLaidOut]);

  useEffect(() => {
    const timer = setTimeout(() => setCanTransition(true), MIN_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const readyToExit = (canTransition || logoAnimationComplete) && isReady;
    if (!readyToExit || exiting || hasCompleted.current) return;
    hasCompleted.current = true;
    setExiting(true);
    onExitStart?.();

    Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: SPLASH_MERGE_FADE_MS,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      onTransitionComplete?.();
    });
  }, [canTransition, logoAnimationComplete, isReady, exiting]);

  return (
    <Animated.View
      style={[styles.overlay, { opacity: overlayOpacity }]}
      pointerEvents={exiting ? 'none' : 'auto'}
    >
      <SplashBackground />
      <View
        style={[styles.content, { paddingTop: splashLogoTopPx }]}
        pointerEvents="none"
        onLayout={() => setSplashContentLaidOut(true)}
      >
        <SplashLogo
          size={splashLogoSize}
          exiting={exiting}
          onAnimationComplete={() => {
            setLogoAnimationComplete(true);
            Animated.timing(taglineOpacity, {
              toValue: 1,
              duration: SPLASH_TAGLINE_FADE_MS,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }).start();
          }}
        />
        <Animated.Text
          style={[
            styles.tagline,
            {
              opacity: taglineOpacity,
              color: SPLASH_TAGLINE_COLOR,
              marginTop: SPLASH_TAGLINE_MARGIN_TOP,
            },
          ]}
          numberOfLines={1}
        >
          GYMZ & NUTRITION
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start', // Logo at top of content; paddingTop sets vertical position
  },
  tagline: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2.6,
    fontFamily: Platform.select({ ios: 'System', android: 'SamsungOne', default: 'System' }),
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 5,
  },
});
