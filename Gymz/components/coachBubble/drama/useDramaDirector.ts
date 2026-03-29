/**
 * useDramaDirector
 *
 * Central hook that manages drama state for two actors (Tyson and Lily).
 * - Accepts a list of DramaScripts to register
 * - Accepts trigger events from screens (via triggerDrama)
 * - Manages cooldowns, priority and interruption
 * - Provides per-actor animated values + state for BubbleActor components
 */

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  createActorAnimValues,
  runKeyframes,
  type ActorAnimatedValues,
  type ActorStateUpdater,
} from './DramaAnimationEngine';
import {
  type DramaScript,
  type DramaKeyframe,
  type DramaTrigger,
  type ActorStateComplete,
  type DramaDirectorState,
  TYSON_CONFIG,
  LILY_CONFIG,
} from './types';
import type { NormalizedLogoBounds } from './DramaBridgeContext';

// ─── Default actor states ────────────────────────────────────────────────────

const defaultTysonState: ActorStateComplete = {
  visible: false,
  position: TYSON_CONFIG.defaultPosition,
  expression: 'idle',
  speech: null,
  rotation: 0,
  scale: 1,
  lookTarget: 'center',
  peeking: false,
  peekDepth: 0,
  peekEdge: null,
};

const defaultLilyState: ActorStateComplete = {
  visible: false,
  position: LILY_CONFIG.defaultPosition,
  expression: 'idle',
  speech: null,
  rotation: 0,
  scale: 1,
  lookTarget: 'center',
  peeking: false,
  peekDepth: 0,
  peekEdge: null,
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export interface DramaDirectorControls {
  /** Per-actor animated values for BubbleActor's Animated.View transforms */
  tysonAnims: ActorAnimatedValues;
  lilyAnims: ActorAnimatedValues;
  /** Live state (expression, speech, lookTarget, etc.) for each actor */
  state: DramaDirectorState;
  /** Fire a drama trigger — plays matching script if available */
  triggerDrama: (trigger: DramaTrigger, screen?: string) => void;
  /** Stop all running drama */
  stopDrama: () => void;
}

export const BUBBLE_SIZE = 72;

/** Compute Lily "behind logo" positions from measured logo bounds. */
function lilyPositionsFromLogoBounds(b: NormalizedLogoBounds) {
  return {
    hidden: { x: b.leftX - 0.06, y: b.topY - 0.05 },
    peek: { x: b.leftX - 0.02, y: b.topY + 0.03 },
  };
}

export function useDramaDirector(scripts: DramaScript[], logoBounds: NormalizedLogoBounds | null = null): DramaDirectorControls {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Create stable animated values once
  const tysonAnims = useMemo(
    () => createActorAnimValues(
      TYSON_CONFIG.defaultPosition.x * screenWidth,
      TYSON_CONFIG.defaultPosition.y * screenHeight,
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const lilyAnims = useMemo(
    () => createActorAnimValues(
      LILY_CONFIG.defaultPosition.x * screenWidth,
      LILY_CONFIG.defaultPosition.y * screenHeight,
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Mutable state for expressions, speech, etc.
  const [state, setState] = useState<DramaDirectorState>({
    tyson: { ...defaultTysonState },
    lily:  { ...defaultLilyState },
  });

  const cancelCurrentRef = useRef<(() => void) | null>(null);
  const currentPriorityRef = useRef<number>(0);
  const lastRunRef = useRef<Map<string, number>>(new Map());

  const updater = useCallback((actor: 'tyson' | 'lily'): ActorStateUpdater => {
    return (update) => {
      setState(prev => ({
        ...prev,
        [actor]: { ...prev[actor], ...update },
      }));
    };
  }, []);

  const tysonUpdater = useMemo(() => updater('tyson'), [updater]);
  const lilyUpdater  = useMemo(() => updater('lily'),  [updater]);

  const triggerDrama = useCallback((trigger: DramaTrigger, screen?: string) => {
    // Don't run with zero or tiny dimensions — layout not ready, positions would be wrong
    if (screenWidth < 100 || screenHeight < 100) return;

    // Find all matching scripts, sorted by priority desc
    const matching = scripts
      .filter(s =>
        s.trigger === trigger &&
        (!s.screen || s.screen === screen)
      )
      .sort((a, b) => b.priority - a.priority);

    if (matching.length === 0) return;

    const script = matching[0];
    const now = Date.now();

    // Check cooldown
    const lastRun = lastRunRef.current.get(script.id) ?? 0;
    if (script.cooldownMs && now - lastRun < script.cooldownMs) return;

    // Check priority — can we interrupt?
    if (cancelCurrentRef.current && currentPriorityRef.current > script.priority) return;

    // Cancel current if running
    if (cancelCurrentRef.current) {
      cancelCurrentRef.current();
      cancelCurrentRef.current = null;
    }

    currentPriorityRef.current = script.priority;
    lastRunRef.current.set(script.id, now);

    // Use measured logo position for Lily in login_enter so she truly comes from the logo
    let keyframes = script.keyframes;
    if (script.id === 'login_enter' && logoBounds) {
      const pos = lilyPositionsFromLogoBounds(logoBounds);
      keyframes = script.keyframes.map((kf: DramaKeyframe) => {
        if (kf.actor !== 'lily' || kf.action.type !== 'moveTo') return kf;
        if (kf.at === 6100) {
          return { ...kf, action: { ...kf.action, x: pos.hidden.x, y: pos.hidden.y } };
        }
        if (kf.at === 6250) {
          return { ...kf, action: { ...kf.action, x: pos.peek.x, y: pos.peek.y } };
        }
        return kf;
      });
    }

    const cancel = runKeyframes(
      keyframes,
      { tyson: tysonAnims, lily: lilyAnims },
      { tyson: tysonUpdater, lily: lilyUpdater },
      { width: screenWidth, height: screenHeight },
      BUBBLE_SIZE,
      () => {
        currentPriorityRef.current = 0;
        cancelCurrentRef.current = null;
      },
    );

    cancelCurrentRef.current = cancel;
  }, [scripts, logoBounds, tysonAnims, lilyAnims, tysonUpdater, lilyUpdater, screenWidth, screenHeight]);

  const stopDrama = useCallback(() => {
    if (cancelCurrentRef.current) {
      cancelCurrentRef.current();
      cancelCurrentRef.current = null;
    }
    currentPriorityRef.current = 0;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cancelCurrentRef.current) {
        cancelCurrentRef.current();
      }
    };
  }, []);

  return { tysonAnims, lilyAnims, state, triggerDrama, stopDrama };
}
