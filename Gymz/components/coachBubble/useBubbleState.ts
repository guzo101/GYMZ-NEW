import { useState, useEffect, useRef, useCallback } from 'react';
import type { BubbleMode } from './constants';
import { TIMING } from './constants';

const SLEEP_AFTER_MS = TIMING.SLEEP_AFTER_IDLE_MS;

/**
 * State controller: Active (just interacted) → Idle → Sleep (inactive).
 * Lightweight; no heavy subscriptions.
 */
export function useBubbleState() {
  const [mode, setMode] = useState<BubbleMode>('idle');
  const lastInteractionRef = useRef<number>(Date.now());
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setActive = useCallback(() => {
    lastInteractionRef.current = Date.now();
    setMode((m) => (m === 'sleep' ? 'idle' : m));
  }, []);

  const setActiveBriefly = useCallback(() => {
    lastInteractionRef.current = Date.now();
    setMode('active');
    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
    sleepTimerRef.current = setTimeout(() => {
      setMode('idle');
      sleepTimerRef.current = null;
    }, 3000);
  }, []);

  useEffect(() => {
    const check = () => {
      const elapsed = Date.now() - lastInteractionRef.current;
      if (mode === 'sleep') return;
      if (elapsed >= SLEEP_AFTER_MS) {
        setMode('sleep');
      }
    };
    const id = setInterval(check, 8000);
    return () => clearInterval(id);
  }, [mode]);

  useEffect(() => {
    return () => {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    };
  }, []);

  return { mode, setActive, setActiveBriefly };
}
