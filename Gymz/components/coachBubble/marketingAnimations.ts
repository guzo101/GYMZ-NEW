/**
 * Marketing animations for AI Bubble during pre-authentication flow.
 * Reusable animation sequences for peek, run-away, guide, and celebration behaviors.
 */

import { Animated, Easing } from 'react-native';

// ── Animation Constants ──────────────────────────────────────────────

export const MARKETING_TIMING = {
  PEEK_DURATION: 600,
  RUN_AWAY_DURATION: 400,
  GUIDE_DURATION: 500,
  CELEBRATION_DURATION: 800,
  BOUNCE_DURATION: 400,
  SLIDE_DURATION: 500,
  FADE_DURATION: 300,
};

// ── Peek Animation ────────────────────────────────────────────────────

export interface PeekAnimationConfig {
  fromEdge: 'top' | 'right' | 'left' | 'bottom';
  finalPosition: { left: number; top: number };
  screenWidth: number;
  screenHeight: number;
}

export function createPeekAnimation(
  animValue: Animated.Value,
  config: PeekAnimationConfig
): Animated.CompositeAnimation {
  const { fromEdge, finalPosition, screenWidth, screenHeight } = config;
  
  let initialPosition = { left: 0, top: 0 };
  
  switch (fromEdge) {
    case 'top':
      initialPosition = { left: finalPosition.left, top: -100 };
      break;
    case 'right':
      initialPosition = { left: screenWidth + 100, top: finalPosition.top };
      break;
    case 'left':
      initialPosition = { left: -100, top: finalPosition.top };
      break;
    case 'bottom':
      initialPosition = { left: finalPosition.left, top: screenHeight + 100 };
      break;
  }
  
  const animation = Animated.parallel([
    Animated.sequence([
      Animated.timing(animValue, {
        toValue: 1,
        duration: MARKETING_TIMING.PEEK_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // Bounce effect
      Animated.sequence([
        Animated.timing(animValue, {
          toValue: 1.1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(animValue, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
    ]),
  ]);
  
  return animation;
}

// ── Run-Away Animation (Privacy) ─────────────────────────────────────

export interface RunAwayAnimationConfig {
  currentPosition: { left: number; top: number };
  direction: 'left' | 'right' | 'up' | 'down';
  distance?: number;
}

export function createRunAwayAnimation(
  positionAnim: Animated.ValueXY,
  scaleAnim: Animated.Value,
  opacityAnim: Animated.Value,
  config: RunAwayAnimationConfig
): Animated.CompositeAnimation {
  const { currentPosition, direction, distance = 80 } = config;
  
  let targetPosition = { x: currentPosition.left, y: currentPosition.top };
  
  switch (direction) {
    case 'left':
      targetPosition.x = currentPosition.left - distance;
      break;
    case 'right':
      targetPosition.x = currentPosition.left + distance;
      break;
    case 'up':
      targetPosition.y = currentPosition.top - distance;
      break;
    case 'down':
      targetPosition.y = currentPosition.top + distance;
      break;
  }
  
  const animation = Animated.parallel([
    Animated.timing(positionAnim, {
      toValue: targetPosition,
      duration: MARKETING_TIMING.RUN_AWAY_DURATION,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }),
    Animated.timing(scaleAnim, {
      toValue: 0.85,
      duration: MARKETING_TIMING.RUN_AWAY_DURATION,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }),
    Animated.timing(opacityAnim, {
      toValue: 0.7,
      duration: MARKETING_TIMING.RUN_AWAY_DURATION,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }),
  ]);
  
  return animation;
}

// ── Guide Animation (Pointing to Input) ───────────────────────────────

export interface GuideAnimationConfig {
  targetPosition: { x: number; y: number };
  currentPosition: { left: number; top: number };
}

export function createGuideAnimation(
  positionAnim: Animated.ValueXY,
  leanAnim: Animated.Value,
  config: GuideAnimationConfig
): Animated.CompositeAnimation {
  const { targetPosition, currentPosition } = config;
  
  // Calculate direction to lean
  const dx = targetPosition.x - (currentPosition.left + 28); // 28 = half bubble size
  const dy = targetPosition.y - (currentPosition.top + 28);
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Normalize and limit lean amount
  const maxLean = 8;
  const leanX = Math.min(maxLean, (dx / distance) * maxLean);
  const leanY = Math.min(maxLean, (dy / distance) * maxLean);
  
  const animation = Animated.parallel([
    Animated.spring(positionAnim, {
      toValue: {
        x: currentPosition.left + leanX,
        y: currentPosition.top + leanY,
      },
      useNativeDriver: false,
      damping: 15,
      stiffness: 120,
      mass: 0.7,
    }),
    Animated.sequence([
      Animated.timing(leanAnim, {
        toValue: 1,
        duration: MARKETING_TIMING.GUIDE_DURATION / 2,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(leanAnim, {
        toValue: 0,
        duration: MARKETING_TIMING.GUIDE_DURATION / 2,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]),
  ]);
  
  return animation;
}

// ── Celebration Animation ─────────────────────────────────────────────

export function createCelebrationAnimation(
  jumpAnim: Animated.Value,
  scaleAnim: Animated.Value,
  rotationAnim: Animated.Value
): Animated.CompositeAnimation {
  const animation = Animated.parallel([
    // Jump sequence
    Animated.sequence([
      Animated.spring(jumpAnim, {
        toValue: -40,
        useNativeDriver: true,
        damping: 8,
        stiffness: 200,
        mass: 0.5,
      }),
      Animated.spring(jumpAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 10,
        stiffness: 150,
        mass: 0.6,
      }),
    ]),
    // Scale pulse
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.2,
        duration: MARKETING_TIMING.CELEBRATION_DURATION / 3,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: MARKETING_TIMING.CELEBRATION_DURATION / 3,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1.1,
        duration: MARKETING_TIMING.CELEBRATION_DURATION / 6,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: MARKETING_TIMING.CELEBRATION_DURATION / 6,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]),
    // Rotation wiggle
    Animated.sequence([
      Animated.timing(rotationAnim, {
        toValue: 1,
        duration: MARKETING_TIMING.CELEBRATION_DURATION / 2,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
      Animated.timing(rotationAnim, {
        toValue: 0,
        duration: MARKETING_TIMING.CELEBRATION_DURATION / 2,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    ]),
  ]);
  
  return animation;
}

// ── Slide In Animation ───────────────────────────────────────────────

export interface SlideInAnimationConfig {
  fromEdge: 'left' | 'right' | 'top' | 'bottom';
  finalPosition: { left: number; top: number };
  screenWidth: number;
  screenHeight: number;
}

export function createSlideInAnimation(
  positionAnim: Animated.ValueXY,
  opacityAnim: Animated.Value,
  config: SlideInAnimationConfig
): Animated.CompositeAnimation {
  const { fromEdge, finalPosition, screenWidth, screenHeight } = config;
  
  let initialPosition = { x: 0, y: 0 };
  
  switch (fromEdge) {
    case 'left':
      initialPosition = { x: -100, y: finalPosition.top };
      break;
    case 'right':
      initialPosition = { x: screenWidth + 100, y: finalPosition.top };
      break;
    case 'top':
      initialPosition = { x: finalPosition.left, y: -100 };
      break;
    case 'bottom':
      initialPosition = { x: finalPosition.left, y: screenHeight + 100 };
      break;
  }
  
  positionAnim.setValue(initialPosition);
  opacityAnim.setValue(0);
  const animation = Animated.parallel([
    Animated.spring(positionAnim, {
      toValue: { x: finalPosition.left, y: finalPosition.top },
      useNativeDriver: false,
      damping: 12,
      stiffness: 100,
      mass: 0.8,
    }),
    Animated.timing(opacityAnim, {
      toValue: 1,
      duration: MARKETING_TIMING.SLIDE_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }),
  ]);
  
  return animation;
}

// ── Bounce Animation ──────────────────────────────────────────────────

export function createBounceAnimation(
  animValue: Animated.Value
): Animated.CompositeAnimation {
  const animation = Animated.sequence([
    Animated.timing(animValue, {
      toValue: 1.15,
      duration: MARKETING_TIMING.BOUNCE_DURATION / 2,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }),
    Animated.timing(animValue, {
      toValue: 1,
      duration: MARKETING_TIMING.BOUNCE_DURATION / 2,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }),
  ]);
  
  animValue.setValue(1);
  return animation;
}
