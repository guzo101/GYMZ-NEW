import React, { useEffect, useRef, useMemo } from 'react';
import { StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { GymzLogo } from '../GymzLogo';

const PHI = 1.6180339887; // Golden ratio
const PATH_KEYFRAME_COUNT = 21;
const START_ANGLE = (-3 * Math.PI) / 4; // 225° – start from bottom-left
const PATH_DURATION_MS = 1200;
const PULSE_UP_MS = 300;
const PULSE_DOWN_MS = 450;
const PULSE_PEAK_SCALE = 1.08;
const REVEAL_START_SCALE = 0.38; // Start small; grow toward final size at center
const FINAL_REST_SCALE = 0.88; // Logo size at final position (smaller than full)

// Spiral radius: start from far (large fraction of screen)
const SPIRAL_RADIUS_FACTOR = 0.72;

const FINAL_ANGLE = START_ANGLE + 2 * Math.PI * PHI; // Offset rotation so logo ends at 0deg (upright)

function buildGoldenSpiralKeyframes() {
  const { width, height } = Dimensions.get('window');
  const R0 = Math.min(width, height) * SPIRAL_RADIUS_FACTOR;
  const inputRange: number[] = [];
  const outputRangeX: number[] = [];
  const outputRangeY: number[] = [];
  const outputRangeRotate: string[] = [];

  for (let i = 0; i < PATH_KEYFRAME_COUNT; i++) {
    const t = i / (PATH_KEYFRAME_COUNT - 1);
    inputRange.push(t);
    const angle = START_ANGLE + 2 * Math.PI * PHI * t;
    const r = R0 * (1 - t);
    outputRangeX.push(r * Math.cos(angle));
    outputRangeY.push(r * Math.sin(angle));
    // Rotation relative to final angle so logo is upright (0deg) when path ends
    const rotateDeg = ((angle - FINAL_ANGLE) * 180) / Math.PI;
    outputRangeRotate.push(`${rotateDeg}deg`);
  }

  return { inputRange, outputRangeX, outputRangeY, outputRangeRotate };
}

const GOLDEN_PATH = buildGoldenSpiralKeyframes();

interface SplashLogoProps {
  size?: number;
  /** When true, splash is exiting (overlay fades; logo stays at rest). */
  exiting?: boolean;
  /** Called when path + pulse animation finishes (so splash can start exit). */
  onAnimationComplete?: () => void;
}

/**
 * Splash logo: follows a golden-ratio spiral path from off-center into the screen center,
 * with speed-ramped easing (slow start, fast finish). Then one strength pulse.
 */
export function SplashLogo({ size = 120, exiting, onAnimationComplete }: SplashLogoProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current; // 1 during path; then 1→1.08→1 for pulse
  const onCompleteRef = useRef(onAnimationComplete);
  onCompleteRef.current = onAnimationComplete;

  const translateX = useMemo(
    () =>
      progress.interpolate({
        inputRange: GOLDEN_PATH.inputRange,
        outputRange: GOLDEN_PATH.outputRangeX,
      }),
    [progress]
  );

  const translateY = useMemo(
    () =>
      progress.interpolate({
        inputRange: GOLDEN_PATH.inputRange,
        outputRange: GOLDEN_PATH.outputRangeY,
      }),
    [progress]
  );

  const rotate = useMemo(
    () =>
      progress.interpolate({
        inputRange: GOLDEN_PATH.inputRange,
        outputRange: GOLDEN_PATH.outputRangeRotate,
      }),
    [progress]
  );

  const opacity = useMemo(
    () =>
      progress.interpolate({
        inputRange: [0, 0.4, 1],
        outputRange: [0, 0.7, 1],
      }),
    [progress]
  );

  const pathScale = useMemo(
    () =>
      progress.interpolate({
        inputRange: [0, 1],
        outputRange: [REVEAL_START_SCALE, FINAL_REST_SCALE],
      }),
    [progress]
  );

  const combinedScale = useMemo(
    () => Animated.multiply(pathScale, scale),
    [pathScale, scale]
  );

  useEffect(() => {
    const pathAnimation = Animated.timing(progress, {
      toValue: 1,
      duration: PATH_DURATION_MS,
      easing: Easing.out(Easing.cubic), // Speed ramped: slow start, fast arrival at center
      useNativeDriver: true,
    });

    const pulse = Animated.sequence([
      Animated.timing(scale, {
        toValue: PULSE_PEAK_SCALE,
        duration: PULSE_UP_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: PULSE_DOWN_MS,
        easing: Easing.in(Easing.cubic), // Hard stump: fast then sharp stop at rest
        useNativeDriver: true,
      }),
    ]);

    pathAnimation.start(({ finished }) => {
      if (finished) {
        pulse.start(({ finished: pulseFinished }) => {
          if (pulseFinished) onCompleteRef.current?.();
        });
      }
    });
  }, []);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            { translateX },
            { translateY },
            { rotate },
            { scale: combinedScale },
          ],
          opacity,
        },
      ]}
    >
      <GymzLogo size={size} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
