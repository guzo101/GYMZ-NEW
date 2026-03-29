import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TIMING } from './constants';

interface BubbleContainerProps {
  size: number;
  brandColor: string;
  /** 0.6–1: dull when inactive, full when progressing (brand-only) */
  saturation?: number;
  /** Cute female variant: softer, rounder orb */
  variant?: 'default' | 'cute';
  children: React.ReactNode;
  /**
   * Drama: external rotation in degrees (from DramaAnimationEngine).
   * Springs back to 0 automatically in the engine — pass the raw Animated.Value here.
   */
  externalRotation?: Animated.Value;
  /**
   * Drama: external scale multiplier (1 = normal).
   * Composes with internal breathing scale.
   */
  externalScale?: Animated.Value;
}

export function hexToRgb(hex: string): [number, number, number] {
  const num = parseInt(hex.slice(1), 16);
  return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
}

export function desaturate(hex: string, saturation: number): string {
  const [r, g, b] = hexToRgb(hex);
  const l = 0.299 * r + 0.587 * g + 0.114 * b;
  const nr = l + (r - l) * saturation;
  const ng = l + (g - l) * saturation;
  const nb = l + (b - l) * saturation;
  return rgbToHex(nr, ng, nb);
}

export function darken(hex: string, pct: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(
    Math.max(0, r * (1 - pct)),
    Math.max(0, g * (1 - pct)),
    Math.max(0, b * (1 - pct))
  );
}

export function lighten(hex: string, pct: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(
    Math.min(255, r + 255 * pct),
    Math.min(255, g + 255 * pct),
    Math.min(255, b + 255 * pct)
  );
}

/**
 * Premium Volumetric Orb: Physically-based lighting (Rim Light + Key Light + Specular).
 * Designed to look like a polished 3D glass jewel/marble.
 */
export const BubbleContainer: React.FC<BubbleContainerProps> = React.memo(
  ({ size, brandColor, saturation = 1, variant = 'default', children, externalRotation, externalScale }) => {
    const sat = Math.max(0.6, Math.min(1, saturation));
    const baseFull = brandColor;
    const isCute = variant === 'cute';

    const saturationAnim = useRef(new Animated.Value(sat)).current;
    const floatAnim      = useRef(new Animated.Value(0)).current;
    const breathAnim     = useRef(new Animated.Value(1)).current;

    useEffect(() => {
      Animated.timing(saturationAnim, {
        toValue: sat,
        duration: TIMING.MOOD_GLOW_TRANSITION_MS,
        useNativeDriver: true,
      }).start();
    }, [sat, saturationAnim]);
 
    useEffect(() => {
      // 1 · Persistent floating (Y-axis drift)
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, {
            toValue: TIMING.FLOAT_DRIFT_PX,
            duration: TIMING.FLOAT_CYCLE_MS / 2,
            useNativeDriver: true,
          }),
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: TIMING.FLOAT_CYCLE_MS / 2,
            useNativeDriver: true,
          }),
        ])
      ).start();
 
      // 2 · Persistent breathing (Subtle scale pulse)
      Animated.loop(
        Animated.sequence([
          Animated.timing(breathAnim, {
            toValue: TIMING.BREATH_SCALE_MAX,
            duration: TIMING.BREATH_CYCLE_MS / 2,
            useNativeDriver: true,
          }),
          Animated.timing(breathAnim, {
            toValue: 1,
            duration: TIMING.BREATH_CYCLE_MS / 2,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }, [floatAnim, breathAnim]);

    const fullColorOpacity = saturationAnim.interpolate({
      inputRange: [0.6, 1],
      outputRange: [0, 1],
    });

    // Modern Social Media Aesthetic: Hyper-vibrant glow and sleek glass finish
    const gradientColors = (isCute 
      ? ['#FF9A9E', '#FECFEF', '#FF9A9E'] // Playful, cute sunset pinks
      : [lighten(baseFull, 0.4), baseFull, darken(baseFull, 0.2)]) as readonly [string, string, ...string[]]; // Brand vibrant

    // Compose external drama rotation onto the base float+breathe transform
    const rotateInterpolated = externalRotation
      ? externalRotation.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] })
      : '0deg';

    return (
      <Animated.View
        style={[
          styles.outer,
          {
            width: size,
            height: size,
            transform: [
              { translateY: floatAnim },
              { scale: externalScale ? Animated.multiply(breathAnim, externalScale) : breathAnim },
              { rotate: rotateInterpolated },
            ],
          },
        ]}
        pointerEvents="none"
      >
        {/* Modern Vibrant Gradient Core */}
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.circle, { width: size, height: size, borderRadius: size / 2, opacity: 0.95 }]}
        >
          {/* Intense Inner Glow Layer */}
          <View
            style={[
              StyleSheet.absoluteFill,
              { 
                borderRadius: size / 2, 
                backgroundColor: isCute ? 'transparent' : 'rgba(255,255,255,0.15)',
                borderWidth: 2,
                borderColor: 'rgba(255,255,255,0.4)'
              },
            ]}
          />

          {/* Premium Glassmorphic Frost Layer (to smooth out the gradient) */}
           <View
            style={[
               StyleSheet.absoluteFill,
               {
                 borderRadius: size / 2,
                 backgroundColor: 'rgba(255,255,255,0.1)', // Very subtle frost
               }
            ]}
           />

          {/* Epic Specular Pop (Modern Apple-style reflection) */}
          <View
            style={[
              styles.specularTeardrop,
              {
                width: size * 0.4,
                height: size * 0.2,
                top: 4,
                left: size * 0.3,
                backgroundColor: 'rgba(255,255,255,0.4)',
                transform: [{ rotate: '-5deg' }], // Less aggressive rotation
                borderRadius: 999,
              },
            ]}
          />

          {/* Face Content Anchor */}
          <View style={styles.content}>
            <View style={styles.eyesWrap}>{children}</View>
          </View>
        </LinearGradient>
      </Animated.View>
    );
  }
);

BubbleContainer.displayName = 'BubbleContainer';

const styles = StyleSheet.create({
  outer: {
    // Crisp dropping shadow for a beautiful floating effect
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 20,
    backgroundColor: 'transparent',
    borderRadius: 9999,
  },
  circle: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: '12%', // Vertical face centering (golden ratio/biological proportions)
  },
  eyesWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  specularTeardrop: {
    position: 'absolute',
    borderRadius: 999,
    transform: [{ rotate: '-12deg' }],
    opacity: 0.9,
  },
  microGlow: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    transform: [{ scaleX: 1.2 }],
  },
  rimLight: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  ambientBottom: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: '32%',
    backgroundColor: 'rgba(0,0,0,0.12)',
    borderBottomLeftRadius: 999,
    borderBottomRightRadius: 999,
  },
});
