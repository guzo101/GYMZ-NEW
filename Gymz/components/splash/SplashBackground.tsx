import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../hooks/useTheme';

const { width, height } = Dimensions.get('window');

/** Gymz gradient background with subtle circular motion graphics - theme-aware */
export function SplashBackground() {
  const { isDark, theme } = useTheme();
  const orbit1 = useRef(new Animated.Value(0)).current;
  const orbit2 = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const duration = 8000;
    Animated.loop(
      Animated.timing(orbit1, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
    Animated.loop(
      Animated.timing(orbit2, {
        toValue: 1,
        duration: duration * 0.7,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.8,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.5,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const rotate1 = orbit1.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const rotate2 = orbit2.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  });
  const scale = pulse.interpolate({
    inputRange: [0.5, 0.8],
    outputRange: [1, 1.15],
  });
  const opacity = pulse.interpolate({
    inputRange: [0.5, 0.8],
    outputRange: [0.03, 0.06],
  });

  // Theme-aware gradient colors
  const gradientColors: [string, string, string] = isDark
    ? ['#2A4B2A', '#1B2E1B', '#0A120A'] // Dark theme gradient
    : ['#D0DDD0', '#E8EFE8', '#F1F5F9']; // Light theme gradient (stronger tint)

  return (
    <LinearGradient
      colors={gradientColors}
      style={StyleSheet.absoluteFill}
    >
      {/* Subtle circular motion rings */}
      <Animated.View
        style={[
          styles.ring,
          {
            transform: [{ rotate: rotate1 }, { scale }],
            opacity,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.ring,
          styles.ring2,
          {
            transform: [{ rotate: rotate2 }, { scale: Animated.multiply(scale, 0.85) }],
            opacity: Animated.multiply(opacity, 0.7),
          },
        ]}
      />
    </LinearGradient>
  );
}

const ringSize = Math.max(width, height) * 0.6;
const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    width: ringSize,
    height: ringSize,
    borderRadius: ringSize / 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    top: '50%',
    left: '50%',
    marginLeft: -ringSize / 2,
    marginTop: -ringSize / 2,
  },
  ring2: {
    width: ringSize * 0.7,
    height: ringSize * 0.7,
    borderRadius: (ringSize * 0.7) / 2,
    marginLeft: -(ringSize * 0.7) / 2,
    marginTop: -(ringSize * 0.7) / 2,
  },
});
