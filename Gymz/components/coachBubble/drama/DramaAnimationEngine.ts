/**
 * Drama Animation Engine
 *
 * Converts DramaScript keyframes into Animated API calls.
 * Each action updates the mutable ActorAnimatedValues which the
 * BubbleActor component reads via Animated.View bindings.
 */

import { Animated, Easing } from 'react-native';
import type { DramaKeyframe, DramaAction, ActorStateComplete, LookTarget } from './types';
import type { EyeExpression } from '../constants';

// ─── Per-actor animated values ──────────────────────────────────────────────

export interface ActorAnimatedValues {
  positionX: Animated.Value;
  positionY: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
  rotation: Animated.Value;
  /** 0 = fully visible, 1 = half off-screen (peek) */
  peekOffset: Animated.Value;
}

export function createActorAnimValues(initialX: number, initialY: number): ActorAnimatedValues {
  return {
    positionX:  new Animated.Value(initialX),
    positionY:  new Animated.Value(initialY),
    opacity:    new Animated.Value(0),
    scale:      new Animated.Value(1),
    rotation:   new Animated.Value(0),
    peekOffset: new Animated.Value(0),
  };
}

// ─── State update callback (for non-animated state: expression, speech, lookTarget) ──

export type ActorStateUpdater = (update: Partial<ActorStateComplete>) => void;

// ─── Sequence runner ────────────────────────────────────────────────────────

/**
 * Execute a list of keyframes.
 * Returns a cancel function to stop all running timers and animations.
 */
export function runKeyframes(
  keyframes: DramaKeyframe[],
  actorValues: Record<'tyson' | 'lily', ActorAnimatedValues>,
  actorUpdaters: Record<'tyson' | 'lily', ActorStateUpdater>,
  screenDimensions: { width: number; height: number },
  bubbleSize: number,
  onComplete?: () => void,
): () => void {
  const timers: ReturnType<typeof setTimeout>[] = [];
  const runningAnims: Animated.CompositeAnimation[] = [];
  let cancelled = false;

  // Sort by `at` to ensure correct ordering
  const sorted = [...keyframes].sort((a, b) => a.at - b.at);

  sorted.forEach((frame) => {
    const t = setTimeout(() => {
      if (cancelled) return;
      executeAction(
        frame.actor,
        frame.action,
        actorValues[frame.actor],
        actorUpdaters[frame.actor],
        screenDimensions,
        bubbleSize,
        runningAnims,
      );
    }, frame.at);
    timers.push(t);
  });

  // Fire onComplete after the last keyframe + 400ms buffer
  const lastAt = sorted.length > 0 ? sorted[sorted.length - 1].at : 0;
  const completeTimer = setTimeout(() => {
    if (!cancelled && onComplete) onComplete();
  }, lastAt + 400);
  timers.push(completeTimer);

  return () => {
    cancelled = true;
    timers.forEach(clearTimeout);
    runningAnims.forEach(a => a.stop());
  };
}

// ─── Single-action executor ─────────────────────────────────────────────────

function executeAction(
  actor: 'tyson' | 'lily',
  action: DramaAction,
  values: ActorAnimatedValues,
  updater: ActorStateUpdater,
  screen: { width: number; height: number },
  bubbleSize: number,
  runningAnims: Animated.CompositeAnimation[],
) {
  const { width: W, height: H } = screen;
  const half = bubbleSize / 2;

  switch (action.type) {
    case 'show': {
      const anim = Animated.timing(values.opacity, {
        toValue: 1, duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      runningAnims.push(anim);
      anim.start();
      updater({ visible: true });
      break;
    }

    case 'hide': {
      const anim = Animated.timing(values.opacity, {
        toValue: 0, duration: 300,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      });
      runningAnims.push(anim);
      anim.start(() => updater({ visible: false }));
      break;
    }

    case 'moveTo': {
      // Normalized coords → pixel coords
      const targetX = action.x * W - half;
      const targetY = action.y * H - half;

      if (action.spring !== false) {
        const anim = Animated.parallel([
          Animated.spring(values.positionX, {
            toValue: targetX, useNativeDriver: true,
            damping: 14, stiffness: 120, mass: 0.7,
          }),
          Animated.spring(values.positionY, {
            toValue: targetY, useNativeDriver: true,
            damping: 14, stiffness: 120, mass: 0.7,
          }),
        ]);
        runningAnims.push(anim);
        anim.start();
      } else {
        values.positionX.setValue(targetX);
        values.positionY.setValue(targetY);
      }
      updater({ position: { x: action.x, y: action.y }, peeking: false, peekEdge: null });
      break;
    }

    case 'slideFromEdge': {
      const peek = action.peekFraction ?? 0.5;
      const edge = action.edge;
      let startX = (values.positionX as any)._value as number;
      let startY = (values.positionY as any)._value as number;
      let endX = startX;
      let endY = startY;

      switch (edge) {
        case 'top':
          startY = -bubbleSize;
          endY = -bubbleSize * (1 - peek);
          break;
        case 'bottom':
          startY = H;
          endY = H - bubbleSize * peek;
          break;
        case 'left':
          startX = -bubbleSize;
          endX = -bubbleSize * (1 - peek);
          break;
        case 'right':
          startX = W;
          endX = W - bubbleSize * peek;
          break;
      }

      values.positionX.setValue(startX);
      values.positionY.setValue(startY);

      const anim = Animated.parallel([
        Animated.spring(values.positionX, {
          toValue: endX, useNativeDriver: true,
          damping: 12, stiffness: 100, mass: 0.8,
        }),
        Animated.spring(values.positionY, {
          toValue: endY, useNativeDriver: true,
          damping: 12, stiffness: 100, mass: 0.8,
        }),
        Animated.timing(values.opacity, {
          toValue: 1, duration: 200, useNativeDriver: true,
        }),
      ]);
      runningAnims.push(anim);
      anim.start();
      updater({ visible: true, peeking: true, peekEdge: edge, peekDepth: 1 - peek });
      break;
    }

    case 'slideToEdge': {
      const edge = action.edge;
      let targetX = (values.positionX as any)._value as number;
      let targetY = (values.positionY as any)._value as number;

      switch (edge) {
        case 'top':    targetY = -bubbleSize * 2; break;
        case 'bottom': targetY = H + bubbleSize; break;
        case 'left':   targetX = -bubbleSize * 2; break;
        case 'right':  targetX = W + bubbleSize; break;
      }

      const anim = Animated.parallel([
        Animated.timing(values.positionX, {
          toValue: targetX, duration: 400,
          easing: Easing.in(Easing.cubic), useNativeDriver: true,
        }),
        Animated.timing(values.positionY, {
          toValue: targetY, duration: 400,
          easing: Easing.in(Easing.cubic), useNativeDriver: true,
        }),
      ]);
      runningAnims.push(anim);
      anim.start(() => updater({ visible: false }));
      break;
    }

    case 'expression': {
      updater({ expression: action.value as EyeExpression });
      break;
    }

    case 'speech': {
      updater({ speech: action.text });
      break;
    }

    case 'hideSpeech': {
      updater({ speech: null });
      break;
    }

    case 'lookAt': {
      updater({ lookTarget: action.target as LookTarget });
      break;
    }

    case 'scale': {
      const anim = Animated.spring(values.scale, {
        toValue: action.value, useNativeDriver: true,
        damping: 12, stiffness: 200, mass: 0.5,
      });
      runningAnims.push(anim);
      anim.start();
      break;
    }

    case 'rotate': {
      const anim = Animated.sequence([
        Animated.timing(values.rotation, {
          toValue: action.degrees, duration: 200,
          easing: Easing.out(Easing.quad), useNativeDriver: true,
        }),
        Animated.spring(values.rotation, {
          toValue: 0, useNativeDriver: true,
          damping: 10, stiffness: 100, mass: 0.6,
        }),
      ]);
      runningAnims.push(anim);
      anim.start();
      break;
    }

    case 'bounce': {
      const currentY = (values.positionY as any)._value as number;
      const anim = Animated.sequence([
        Animated.spring(values.positionY, {
          toValue: currentY - 20, useNativeDriver: true,
          damping: 8, stiffness: 200, mass: 0.5,
        }),
        Animated.spring(values.positionY, {
          toValue: currentY, useNativeDriver: true,
          damping: 10, stiffness: 150, mass: 0.6,
        }),
      ]);
      runningAnims.push(anim);
      anim.start();
      break;
    }

    case 'shake': {
      const currentX = (values.positionX as any)._value as number;
      const anim = Animated.sequence([
        Animated.timing(values.positionX, { toValue: currentX - 12, duration: 60, useNativeDriver: true }),
        Animated.timing(values.positionX, { toValue: currentX + 12, duration: 60, useNativeDriver: true }),
        Animated.timing(values.positionX, { toValue: currentX - 8,  duration: 60, useNativeDriver: true }),
        Animated.timing(values.positionX, { toValue: currentX + 8,  duration: 60, useNativeDriver: true }),
        Animated.timing(values.positionX, { toValue: currentX,      duration: 60, useNativeDriver: true }),
      ]);
      runningAnims.push(anim);
      anim.start();
      break;
    }

    case 'nod': {
      const currentY = (values.positionY as any)._value as number;
      const anim = Animated.sequence([
        Animated.timing(values.positionY, { toValue: currentY + 8, duration: 120, useNativeDriver: true }),
        Animated.timing(values.positionY, { toValue: currentY - 4, duration: 100, useNativeDriver: true }),
        Animated.timing(values.positionY, { toValue: currentY,     duration: 100, useNativeDriver: true }),
      ]);
      runningAnims.push(anim);
      anim.start();
      break;
    }

    case 'wait': {
      // No-op intentional pause marker
      break;
    }
  }
}
