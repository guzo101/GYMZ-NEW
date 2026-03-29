import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface ParticleProps {
  type: 'star' | 'heart' | 'sparkle';
  color: string;
  delay: number;
  angle: number;
  distance: number;
  size: number;
}

const Particle: React.FC<ParticleProps> = ({ type, color, delay, angle, distance, size }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 800 + Math.random() * 400,
      delay,
      easing: Easing.out(Easing.back(1.2)),
      useNativeDriver: true,
    }).start();
  }, [anim, delay]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.cos(angle) * distance],
  });

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.sin(angle) * distance],
  });

  const scale = anim.interpolate({
    inputRange: [0, 0.2, 0.8, 1],
    outputRange: [0, 1.2, 1, 0],
  });

  const opacity = anim.interpolate({
    inputRange: [0, 0.1, 0.8, 1],
    outputRange: [0, 1, 1, 0],
  });

  const rotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${(Math.random() - 0.5) * 180}deg`],
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          transform: [{ translateX }, { translateY }, { scale }, { rotate }],
          opacity,
        },
      ]}
    >
      {type === 'star' ? (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={color} />
        </Svg>
      ) : type === 'heart' ? (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill={color} />
        </Svg>
      ) : (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M12 2L13 11 22 12 13 13 12 22 11 13 2 12 11 11 12 2z" fill={color} />
        </Svg>
      )}
    </Animated.View>
  );
};

interface NutritionRatingReactionProps {
  score: number;
  visible?: boolean;
}

/**
 * High-energy particle burst reaction.
 * Repurposed from a simple face to an excitement explosion.
 */
export function NutritionRatingReaction({ score, visible = false }: NutritionRatingReactionProps) {
  const particles = useMemo(() => {
    if (!visible) return [];
    
    const count = score >= 9 ? 16 : score >= 7 ? 10 : 6;
    const items: ParticleProps[] = [];
    
    for (let i = 0; i < count; i++) {
      const type = score >= 9 ? (Math.random() > 0.5 ? 'star' : 'sparkle') :
                   score >= 7 ? (Math.random() > 0.5 ? 'heart' : 'sparkle') : 'sparkle';
      const color = score >= 9 ? '#FFD700' : score >= 7 ? '#FF4B2B' : '#ffffff';
      
      items.push({
        type: type as any,
        color,
        delay: Math.random() * 200,
        angle: (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5,
        distance: 40 + Math.random() * 60,
        size: 14 + Math.random() * 10,
      });
    }
    return items;
  }, [score, visible]);

  if (!visible) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {particles.map((p, i) => (
        <Particle key={i} {...p} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  },
  particle: {
    position: 'absolute',
  },
});
