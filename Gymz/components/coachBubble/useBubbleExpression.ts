import { useMemo } from 'react';
import type { BubbleMode, BubbleMood } from './constants';
import type { EyeExpression, EyelidState } from './constants';
import type { BehavioralTrigger } from '../../contexts/CoachCharacterContext';
import { TRIGGER_TO_EXPRESSION, getExpressionForNutritionScore } from '../../contexts/CoachCharacterContext';

interface UseBubbleExpressionArgs {
  mode: BubbleMode;
  gender: 'male' | 'female';
  eventTrigger?: BehavioralTrigger | null;
  /** When eventTrigger is 'mealScanned', expression is driven by this (1–10). */
  nutritionScore?: number | null;
  mood?: BubbleMood;
  inConversation?: boolean;
}

const MOOD_TO_EXPRESSION: Record<BubbleMood, EyeExpression> = {
  calm: 'idle',
  encouraging: 'wide',
  observing: 'idle',
  celebrating: 'celebration',
  concerned: 'narrow',
};

/** Map eye expression to eyelid state for Pixar-style expressive eyes. */
const EXPRESSION_TO_EYELID: Record<EyeExpression, EyelidState> = {
  idle: 'neutralAttentive',
  blink: 'neutralAttentive',
  lookLeft: 'neutralAttentive',
  lookRight: 'neutralAttentive',
  lookUp: 'neutralAttentive',
  lookDown: 'neutralAttentive',
  wide: 'focused',
  narrow: 'suspicious',
  sleepy: 'encouraging',
  happy: 'encouraging',
  amused: 'playful',
  suspicious: 'suspicious',
  curiousTilt: 'curious',
  eyeRoll: 'playful',
  proud: 'encouraging',
  celebration: 'encouraging',
  starEyes: 'focused',
  heartEyes: 'encouraging',
};

export interface BubbleExpressionResult {
  expression: EyeExpression;
  eyelidState: EyelidState;
}

/**
 * Expression controller: eventTrigger overrides; then inConversation (attentive); then mood; then mode.
 * Returns both expression (for pupils/look) and eyelidState (for eyelid shape). Gender nuance applied in BubbleEyes.
 */
export function useBubbleExpression({
  mode,
  gender,
  eventTrigger,
  nutritionScore = null,
  mood = 'observing',
  inConversation = false,
}: UseBubbleExpressionArgs): BubbleExpressionResult {
  return useMemo(() => {
    let expression: EyeExpression;
    if (eventTrigger != null) {
      if (eventTrigger.type === 'mealScanned' && nutritionScore != null) {
        expression = getExpressionForNutritionScore(nutritionScore);
      } else {
        expression = TRIGGER_TO_EXPRESSION[eventTrigger.type];
      }
    } else if (inConversation || mode === 'active') expression = 'wide';
    else if (mode === 'sleep') expression = 'sleepy';
    else expression = MOOD_TO_EXPRESSION[mood];

    let eyelidState: EyelidState = EXPRESSION_TO_EYELID[expression];
    if (inConversation || mode === 'active') eyelidState = 'focused';
    return { expression, eyelidState };
  }, [mode, gender, eventTrigger, nutritionScore, mood, inConversation]);
}
