/**
 * Drama System Types
 * 
 * Data-driven scripting system for dual-bubble (Tyson + Lily) onboarding drama sequences.
 * Scripts are arrays of timed keyframes controlling two bubble actors with position,
 * expression, speech and motion.
 */

import type { EyeExpression } from '../constants';

// ─── Actors ──────────────────────────────────────────────────────────────────

export type DramaActor = 'tyson' | 'lily';

// ─── Actions ─────────────────────────────────────────────────────────────────

export type DramaAction =
  // Move to absolute normalized position (0-1 of screen)
  | { type: 'moveTo'; x: number; y: number; spring?: boolean }
  // Slide from off-screen edge (peek effect)
  | { type: 'slideFromEdge'; edge: 'top' | 'right' | 'left' | 'bottom'; peekFraction?: number }
  // Slide fully off an edge
  | { type: 'slideToEdge'; edge: 'top' | 'right' | 'left' | 'bottom' }
  // Change eye expression
  | { type: 'expression'; value: EyeExpression }
  // Show a speech bubble
  | { type: 'speech'; text: string }
  // Hide the speech bubble
  | { type: 'hideSpeech' }
  // Look toward a named target
  | { type: 'lookAt'; target: 'user' | 'otherBubble' | 'logo' | 'center' | 'away' | 'left' | 'right' | 'down' }
  // Scale the bubble (1 = normal)
  | { type: 'scale'; value: number }
  // Rotate the bubble (degrees, springs back to 0)
  | { type: 'rotate'; degrees: number }
  // Quick bounce jump
  | { type: 'bounce' }
  // Side-to-side shake (disagreement / shy)
  | { type: 'shake' }
  // Nod up-down (agreement)
  | { type: 'nod' }
  // Fade in
  | { type: 'show' }
  // Fade out
  | { type: 'hide' }
  // No-op - just marks a pause point
  | { type: 'wait' };

// ─── Keyframe ────────────────────────────────────────────────────────────────

export interface DramaKeyframe {
  /** Which character performs this action */
  actor: DramaActor;
  /** Milliseconds from sequence start when this keyframe fires */
  at: number;
  /** Action to perform */
  action: DramaAction;
}

// ─── Script ──────────────────────────────────────────────────────────────────

export type DramaTrigger =
  | 'screenEnter'
  | 'passwordFocus'
  | 'passwordBlur'
  | 'passwordToggle'
  | 'emailFocus'
  | 'emailTyping'
  | 'nameFocus'
  | 'formError'
  | 'formSuccess'
  | 'formProgress25'
  | 'formProgress50'
  | 'formProgress75'
  | 'formProgress100'
  | 'idle'
  | 'typing'
  | 'onboardingComplete'
  | 'gymSelected';

export interface DramaScript {
  id: string;
  trigger: DramaTrigger;
  /** Screen this script applies to (undefined = any) */
  screen?: string;
  keyframes: DramaKeyframe[];
  /** Can be interrupted by a higher-priority script */
  interruptible: boolean;
  /** Higher = runs over lower when conflict */
  priority: number;
  /** Don't replay this script within cooldownMs after it last ran */
  cooldownMs?: number;
}

// ─── Live Actor State ─────────────────────────────────────────────────────────
// This is what the Drama Director exposes per-actor for the BubbleActor component

export interface ActorState {
  visible: boolean;
  /** Normalized 0-1 position on screen */
  position: { x: number; y: number };
  expression: EyeExpression;
  speech: string | null;
  rotation: number;
  scale: number;
  /** Named look-at target for eye direction */
  lookTarget: DramaAction extends { type: 'lookAt' } ? DramaAction['target'] : never;
  /** Is this actor partially hidden behind screen edge (peek) */
  peeking: boolean;
  /** How far off-screen the peek is (0 = fully visible, 1 = fully hidden) */
  peekDepth: number;
  /** Edge this actor is peeking from (when peeking) */
  peekEdge: 'top' | 'right' | 'left' | 'bottom' | null;
}

export type LookTarget = 'user' | 'otherBubble' | 'logo' | 'center' | 'away' | 'left' | 'right' | 'down';

export interface ActorStateComplete {
  visible: boolean;
  position: { x: number; y: number };
  expression: EyeExpression;
  speech: string | null;
  rotation: number;
  scale: number;
  lookTarget: LookTarget;
  peeking: boolean;
  peekDepth: number;
  peekEdge: 'top' | 'right' | 'left' | 'bottom' | null;
}

// ─── Director State ────────────────────────────────────────────────────────────

export interface DramaDirectorState {
  tyson: ActorStateComplete;
  lily: ActorStateComplete;
}

// ─── Character Configs ─────────────────────────────────────────────────────────

export interface CharacterConfig {
  name: string;
  gender: 'male' | 'female';
  defaultPosition: { x: number; y: number };
  color: string;
}

/** Tyson uses theme primary (green) to match post-login coach bubble; default for consumers without theme */
export const TYSON_CONFIG: CharacterConfig = {
  name: 'Tyson',
  gender: 'male',
  defaultPosition: { x: 0.85, y: 0.78 },
  color: '#2A4B2A',
};

/** Lily uses theme accent to match post-login female coach bubble; default for consumers without theme */
export const LILY_CONFIG: CharacterConfig = {
  name: 'Lily',
  gender: 'female',
  defaultPosition: { x: 0.08, y: 0.78 },
  color: '#FBD85D',
};
