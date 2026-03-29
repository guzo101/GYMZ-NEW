import React, { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCoachInsight } from './CoachInsightContext';
import type { CoachInsightPayload } from '../components/dashboard/CoachInsightCard';
import { getReactionForTrigger, pickRandom, type PersonalityTemperature } from '../components/coachBubble/phrases';
import { POSITION_QUIPS } from '../components/coachBubble/phrases';
import { EXPRESSION_DURATION_MS, BUBBLE_POSITION_STORAGE_KEY, SATURATION } from '../components/coachBubble/constants';
import type { EyeExpression, BubbleMood } from '../components/coachBubble/constants';

export type BehavioralTriggerType =
  | 'mealLogged'
  | 'mealScanned'
  | 'mealScanStarted'
  | 'workoutLogged'
  | 'streakMilestone'
  | 'missedDay'
  | 'threeMissedDays'
  | 'longAbsence'
  | 'appOpened'
  | 'stepsLogged'
  | 'hydrationLogged';

export interface BehavioralTrigger {
  type: BehavioralTriggerType;
  payload?: any;
}

/** Maps trigger type → micro-expression (400–1200ms). mealScanned uses nutritionScore in useBubbleExpression. */
export const TRIGGER_TO_EXPRESSION: Record<BehavioralTriggerType, EyeExpression> = {
  mealLogged: 'wide',
  mealScanned: 'celebration',
  mealScanStarted: 'idle',
  workoutLogged: 'wide',
  streakMilestone: 'proud',
  missedDay: 'narrow',
  threeMissedDays: 'suspicious',
  longAbsence: 'sleepy',
  appOpened: 'idle',
  stepsLogged: 'happy',
  hydrationLogged: 'happy',
};

/** Exaggerated expression for nutrition rating 1–10 (used by main bubble and reaction orb). */
export function getExpressionForNutritionScore(score: number): EyeExpression {
  if (score >= 9) return 'starEyes';  // OMG! / STUNNING
  if (score >= 7) return 'heartEyes'; // Love / Amazing
  if (score >= 5) return 'happy';     // Solid / okay
  return 'narrow';                    // Needs work (1–4)
}

export interface BubblePosition {
  x: number; // left in px, or 0–1 normalized
  y: number; // top in px, or 0–1 normalized
  normalized?: boolean;
}

/** Screen position (center of bubble) to animate the bubble toward (e.g. near a tapped Daily Pulse metric). */
export interface BubbleTargetPosition {
  x: number;
  y: number;
}

interface CoachCharacterContextValue {
  bubblePosition: BubblePosition | null;
  setBubblePosition: (p: BubblePosition) => void;
  /** When set, the bubble should animate to this screen position (bubble center). Cleared after move. */
  bubbleTargetPosition: BubbleTargetPosition | null;
  setBubbleTargetPosition: (p: BubbleTargetPosition | null) => void;
  reaction: string | null;
  eventTrigger: BehavioralTrigger | null;
  /** When user scans a meal, 1–10; drives exaggerated expression until cleared. */
  nutritionScore: number | null;
  /** Fire excited state and set expression from meal scan (healthScore 1–10). */
  fireMealScanned: (healthScore: number, customQuip?: string) => void;
  /** Fire a short excited expression when the user starts a meal scan. */
  fireMealScanStarted: () => void;
  personalityTemperature: PersonalityTemperature;
  mood: BubbleMood;
  saturation: number;
  inConversation: boolean;
  setInConversation: (v: boolean) => void;
  positionQuip: string | null;
  setPositionQuip: (q: string | null) => void;
  dragCount: number;
  incrementDragCount: () => void;
  /** Force the coach to speak; optional trigger and optional target position (bubble moves near that point). */
  fireSpeech: (text: string, trigger?: BehavioralTriggerType, options?: { targetPosition?: BubbleTargetPosition }) => void;
}

const CoachCharacterContext = createContext<CoachCharacterContextValue | null>(null);

const REACTION_DURATION_MS = 3500;
const EXPRESSION_CLEAR_MS = EXPRESSION_DURATION_MS.min + Math.random() * (EXPRESSION_DURATION_MS.max - EXPRESSION_DURATION_MS.min);

function computeTemperature(payload: CoachInsightPayload | null): PersonalityTemperature {
  if (!payload?.stats) return 2;
  const { stats } = payload;
  const calories = stats.calories ?? 0;
  const streak = stats.streak ?? 0;
  const hasGoal = Boolean(stats.goals?.dailyCalorieGoal);
  if (streak >= 7 && calories > 0) return 1;
  if (streak >= 3 && calories > 0) return 2;
  if (calories > 0) return 3;
  if (streak === 0 && !hasGoal) return 5;
  return 4;
}

function computeMood(
  eventTrigger: BehavioralTrigger | null,
  temperature: PersonalityTemperature
): BubbleMood {
  const type = eventTrigger?.type || null;
  if (type === 'streakMilestone') return 'celebrating';
  if (type === 'threeMissedDays' || temperature === 5) return 'concerned';
  if (type === 'mealLogged' || type === 'workoutLogged' || type === 'stepsLogged') return 'encouraging';
  if (temperature === 1 || temperature === 2) return 'calm';
  if (temperature === 3) return 'observing';
  return 'observing';
}

function computeSaturation(payload: CoachInsightPayload | null): number {
  if (!payload?.stats) return SATURATION.MAX;
  const { stats } = payload;
  const calories = stats.calories ?? 0;
  const streak = stats.streak ?? 0;
  const hasGoal = Boolean(stats.goals?.dailyCalorieGoal);
  if (calories > 0 && (streak > 0 || hasGoal)) return SATURATION.MAX;
  if (calories === 0 && streak === 0) return SATURATION.MIN;
  return SATURATION.MIN + (SATURATION.MAX - SATURATION.MIN) * 0.5;
}

export function CoachCharacterProvider({ children }: { children: ReactNode }) {
  const { payload } = useCoachInsight() ?? { payload: null };
  const [bubblePosition, setBubblePositionState] = useState<BubblePosition | null>(null);
  const [bubbleTargetPosition, setBubbleTargetPosition] = useState<BubbleTargetPosition | null>(null);
  const [reaction, setReactionState] = useState<string | null>(null);
  const [eventTrigger, setEventTriggerState] = useState<BehavioralTrigger | null>(null);
  const [nutritionScore, setNutritionScore] = useState<number | null>(null);
  const [positionQuip, setPositionQuip] = useState<string | null>(null);
  const [dragCount, setDragCount] = useState(0);
  const [inConversation, setInConversation] = useState(false);
  const prevPayloadRef = useRef<CoachInsightPayload | null>(null);
  const reactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expressionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const positionQuipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasFiredAppOpenedRef = useRef(false);
  const lastManualScanTimeRef = useRef<number>(0);

  const personalityTemperature = computeTemperature(payload);
  const mood = computeMood(eventTrigger, personalityTemperature);
  const saturation = computeSaturation(payload);

  const setBubblePosition = useCallback((p: BubblePosition) => {
    setBubblePositionState(p);
    AsyncStorage.setItem(BUBBLE_POSITION_STORAGE_KEY, JSON.stringify(p)).catch(() => {});
  }, []);

  const incrementDragCount = useCallback(() => {
    setDragCount((c) => c + 1);
  }, []);

  // Load persisted position on mount
  useEffect(() => {
    AsyncStorage.getItem(BUBBLE_POSITION_STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const p = JSON.parse(raw) as BubblePosition;
            if (typeof p.x === 'number' && typeof p.y === 'number') setBubblePositionState(p);
          } catch (_) {}
        }
      })
      .catch(() => {});
  }, []);

  // When reaction is set, clear after delay
  useEffect(() => {
    if (!reaction) return;
    if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
    reactionTimerRef.current = setTimeout(() => {
      setReactionState(null);
      reactionTimerRef.current = null;
    }, REACTION_DURATION_MS);
    return () => {
      if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
    };
  }, [reaction]);

  // When eventTrigger is set, clear after a delay so expression reverts
  useEffect(() => {
    if (!eventTrigger) return;
    if (expressionTimerRef.current) clearTimeout(expressionTimerRef.current);
    const isNutritionScan =
      eventTrigger.type === 'mealScanned' || eventTrigger.type === 'mealScanStarted';
    // For nutrition scan reactions (scan started + result), keep the expression/speech
    // visible roughly twice as long as other micro-reactions.
    const ms = isNutritionScan
      ? 7000
      : EXPRESSION_DURATION_MS.min +
        Math.random() * (EXPRESSION_DURATION_MS.max - EXPRESSION_DURATION_MS.min);
    expressionTimerRef.current = setTimeout(() => {
      setEventTriggerState(null);
      setNutritionScore(null);
      expressionTimerRef.current = null;
    }, ms);
    return () => {
      if (expressionTimerRef.current) clearTimeout(expressionTimerRef.current);
    };
  }, [eventTrigger]);

  const fireMealScanned = useCallback((healthScore: number, customQuip?: string) => {
    const score = Math.max(1, Math.min(10, Math.round(healthScore)));
    console.log('[CoachCharacter] fireMealScanned()', { raw: healthScore, score, customQuip });
    lastManualScanTimeRef.current = Date.now();
    setNutritionScore(score);
    setEventTriggerState({ type: 'mealScanned', payload: { score, customQuip } });
  }, []);

  const fireMealScanStarted = useCallback(() => {
    console.log('[CoachCharacter] fireMealScanStarted()');
    setEventTriggerState({ type: 'mealScanStarted' });
    // REMOVED setReactionState to reduce "random" popping noise at start of scan
  }, []);

  const fireSpeech = useCallback((text: string, trigger?: BehavioralTriggerType, options?: { targetPosition?: BubbleTargetPosition }) => {
    console.log('[CoachCharacter] fireSpeech()', { text, trigger, targetPosition: options?.targetPosition });
    setReactionState(text);
    if (trigger) {
      setEventTriggerState({ type: trigger });
    } else {
      setEventTriggerState({ type: 'appOpened' });
    }
    if (options?.targetPosition) {
      setBubbleTargetPosition(options.targetPosition);
    }
  }, []);

  // Clear position quip after 4s
  useEffect(() => {
    if (!positionQuip) return;
    if (positionQuipTimerRef.current) clearTimeout(positionQuipTimerRef.current);
    positionQuipTimerRef.current = setTimeout(() => {
      setPositionQuip(null);
      positionQuipTimerRef.current = null;
    }, 4000);
    return () => {
      if (positionQuipTimerRef.current) clearTimeout(positionQuipTimerRef.current);
    };
  }, [positionQuip]);

  // Behavioral trigger engine: compare payload with previous
  useEffect(() => {
    if (!payload?.stats) {
      if (payload && hasFiredAppOpenedRef.current === false) {
        hasFiredAppOpenedRef.current = true;
        setReactionState(getReactionForTrigger('appOpened'));
        setEventTriggerState({ type: 'appOpened' });
      }
      prevPayloadRef.current = payload;
      return;
    }
    const prev = prevPayloadRef.current?.stats;
    const curr = payload.stats;
    if (prev) {
      const prevCal = prev.calories ?? 0;
      const currCal = curr.calories ?? 0;
      const prevStreak = prev.streak ?? 0;
      const currStreak = curr.streak ?? 0;
      if (currCal > prevCal) {
        // DEDUPLICATION: If we just manually handled mealScanned, skip the automatic reaction for a 10s window
        const timeSinceScan = Date.now() - lastManualScanTimeRef.current;
        if (eventTrigger?.type === 'mealScanned' || timeSinceScan < 10000) {
          console.log('[CoachCharacter] Skipping automatic mealLogged reaction; manual scan detected recently.');
        } else {
          setReactionState(getReactionForTrigger('mealLogged'));
          setEventTriggerState({ type: 'mealLogged' });
        }
      } else if (currStreak > prevStreak && currStreak > 0) {
        setReactionState(getReactionForTrigger('streakMilestone'));
        setEventTriggerState({ type: 'streakMilestone' });
      }
    }
    prevPayloadRef.current = payload;
  }, [payload]);

  const value: CoachCharacterContextValue = useMemo(() => ({
    bubblePosition,
    setBubblePosition,
    bubbleTargetPosition,
    setBubbleTargetPosition,
    reaction,
    eventTrigger,
    nutritionScore,
    fireMealScanned,
    fireMealScanStarted,
    personalityTemperature,
    mood,
    saturation,
    inConversation,
    setInConversation,
    positionQuip,
    setPositionQuip,
    dragCount,
    incrementDragCount,
    fireSpeech,
  }), [
    bubblePosition,
    setBubblePosition,
    bubbleTargetPosition,
    setBubbleTargetPosition,
    reaction,
    eventTrigger,
    nutritionScore,
    fireMealScanned,
    fireMealScanStarted,
    personalityTemperature,
    mood,
    saturation,
    inConversation,
    setInConversation,
    positionQuip,
    setPositionQuip,
    dragCount,
    incrementDragCount,
    fireSpeech,
  ]);

  return (
    <CoachCharacterContext.Provider value={value}>
      {children}
    </CoachCharacterContext.Provider>
  );
}

export function useCoachCharacter() {
  const ctx = useContext(CoachCharacterContext);
  return ctx;
}

/** Pick a position quip from zone and drag count */
export function getPositionQuip(
  zone: 'top' | 'bottom' | 'blocking' | 'movedOften',
  dragCount: number
): string {
  if (zone === 'movedOften' && dragCount >= 3) return pickRandom(POSITION_QUIPS.movedOften);
  return pickRandom(POSITION_QUIPS[zone]);
}
