/**
 * DramaBridgeContext
 *
 * A lightweight bridge between screens and the DualBubbleOverlay.
 * Screens call the provided helpers to emit drama events.
 * DualBubbleOverlay reads `currentScreen` and `lastEvent` to fire triggers.
 * Login screen can report measured logo bounds so Lily uses the real logo position.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type { DramaTrigger } from './types';

/** Normalized (0–1) logo region from measureInWindow + window size. Single source of truth for drama. */
export interface NormalizedLogoBounds {
  centerX: number;
  centerY: number;
  topY: number;
  bottomY: number;
  leftX: number;
  rightX: number;
}

// ─── Context value ────────────────────────────────────────────────────────────

interface DramaEvent {
  trigger: DramaTrigger;
  screen: string;
  /** Incremented each time to force re-renders even for repeat events */
  seq: number;
}

interface DramaBridgeContextValue {
  /** Current active screen name (set by useScreenDrama hook) */
  currentScreen: string | null;
  /** Last event fired from a screen */
  lastEvent: DramaEvent | null;
  /** Measured logo bounds (0–1) when Login has measured the logo; null otherwise */
  logoBounds: NormalizedLogoBounds | null;
  /** Internal — used by useScreenDrama to set active screen */
  setCurrentScreen: (screen: string | null) => void;
  /** Internal — used by useScreenDrama to emit events */
  emitDramaEvent: (trigger: DramaTrigger, screen: string) => void;
  /** Set measured logo bounds (Login screen) or clear (null on unmount) */
  setLogoBounds: (bounds: NormalizedLogoBounds | null) => void;
}

const DramaBridgeContext = createContext<DramaBridgeContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function DramaBridgeProvider({ children }: { children: ReactNode }) {
  const [currentScreen, setCurrentScreen] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<DramaEvent | null>(null);
  const [logoBounds, setLogoBounds] = useState<NormalizedLogoBounds | null>(null);
  const seqRef = useRef(0);

  const emitDramaEvent = useCallback((trigger: DramaTrigger, screen: string) => {
    seqRef.current += 1;
    setLastEvent({ trigger, screen, seq: seqRef.current });
  }, []);

  return (
    <DramaBridgeContext.Provider value={{ currentScreen, lastEvent, logoBounds, setCurrentScreen, emitDramaEvent, setLogoBounds }}>
      {children}
    </DramaBridgeContext.Provider>
  );
}

// ─── Hook for the overlay ─────────────────────────────────────────────────────

export function useDramaBridge(): DramaBridgeContextValue {
  const ctx = useContext(DramaBridgeContext);
  if (!ctx) {
    return {
      currentScreen: null,
      lastEvent: null,
      logoBounds: null,
      setCurrentScreen: () => {},
      emitDramaEvent: () => {},
      setLogoBounds: () => {},
    };
  }
  return ctx;
}

// ─── Hook for screens ─────────────────────────────────────────────────────────

/**
 * Use this hook inside any onboarding screen.
 * It automatically:
 * - Sets currentScreen on mount/unmount
 * - Provides `emit(trigger)` to fire drama events
 *
 * Example usage in Login.tsx:
 *   const { emitDrama } = useScreenDrama('Login');
 *   // When password input is focused:
 *   emitDrama('passwordFocus');
 */
export function useScreenDrama(screenName: string) {
  const ctx = useContext(DramaBridgeContext);

  // Register this screen on mount
  React.useEffect(() => {
    if (!ctx) return;
    ctx.setCurrentScreen(screenName);
    return () => {
      ctx.setCurrentScreen(null);
    };
  }, [screenName, ctx]);

  const emitDrama = useCallback(
    (trigger: DramaTrigger) => {
      ctx?.emitDramaEvent(trigger, screenName);
    },
    [ctx, screenName],
  );

  return { emitDrama };
}
