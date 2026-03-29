/**
 * AI Coach Bubble - constants for size, timing, and performance.
 * Kept minimal for low-end Android.
 */

/** Cute female AI bubble — soft coral pink when profile is female */
export const CUTE_FEMALE_BUBBLE_COLOR = '#F4A0A8';

export const BUBBLE = {
  /** Normal size (Idle/Active) */
  SIZE_IDLE: 56,
  /** Sleep mode - smaller */
  SIZE_SLEEP: 44,
  /** Position from bottom (above tab bar) */
  BOTTOM_OFFSET: 92,
  /** Position from right */
  RIGHT_OFFSET: 16,
  /** Reserve space at bottom so bubble never overlaps tab bar (position awareness) */
  TAB_BAR_HEIGHT: 56,
  /** Nudge bubble inward if within this distance of edge (px) */
  EDGE_NUDGE_PX: 20,
} as const;

/** Animation durations and motion - spec-aligned, lightweight */
export const TIMING = {
  FLOAT_CYCLE_MS: 2800,
  FLOAT_DRIFT_PX: 10,
  BREATH_SCALE_MAX: 1.03,
  BREATH_CYCLE_MS: 4000,
  BLINK_DURATION_MS: 110,
  BLINK_INTERVAL_MS_MIN: 6000,
  BLINK_INTERVAL_MS_MAX: 12000,
  BLINK_INTERVAL_ACTIVE_MS_MIN: 4000,
  BLINK_INTERVAL_ACTIVE_MS_MAX: 7000,
  STATE_TRANSITION_MS: 400,
  SLEEP_AFTER_IDLE_MS: 60_000,
  DRAG_STRETCH_FACTOR: 0.12,
  RELEASE_BOUNCE_MS: 250,
  TAP_COMPRESS_MS: 180,
  LONG_PRESS_MS: 450,
  MOOD_GLOW_TRANSITION_MS: 500,
  BROW_TRANSITION_MS: 220,
  EXCITEMENT_JUMP_MS: 600,
  EXCITEMENT_BURST_DURATION_MS: 1200,
} as const;

/** Saturation: dull when inactive, full when progressing (brand-only color) */
export const SATURATION = {
  MIN: 0.6,
  MAX: 1,
} as const;

export type BubbleMode = 'active' | 'idle' | 'sleep';

export type BubbleMood = 'calm' | 'encouraging' | 'observing' | 'celebrating' | 'concerned';

export type EyeExpression =
  | 'idle'
  | 'blink'
  | 'lookLeft'
  | 'lookRight'
  | 'lookUp'
  | 'lookDown'
  | 'wide'
  | 'narrow'
  | 'sleepy'
  | 'happy'
  | 'amused'
  | 'suspicious'
  | 'curiousTilt'
  | 'eyeRoll'
  | 'proud'
  | 'celebration' // eyes closed, joyful bounce
  | 'starEyes'
  | 'heartEyes';

/** Eyelid states for expressive cartoon eyes (Pixar-style). Subtle eyelid movement, not exaggerated. */
export type EyelidState =
  | 'neutralAttentive'  // default, alert
  | 'curious'           // eyelids slightly raised
  | 'playful'           // one eyelid slightly lowered (playful suspicion)
  | 'suspicious'        // eyelids slightly narrowed
  | 'encouraging'       // relaxed, warm
  | 'focused';          // eyes open slightly wider

/** Micro-expression duration range (ms) */
export const EXPRESSION_DURATION_MS = { min: 400, max: 1200 } as const;

/** Storage key for bubble position */
export const BUBBLE_POSITION_STORAGE_KEY = '@Gymz_ai_coach_bubble_position';

// ─── Drama System Constants ───────────────────────────────────────────────────

/** Drama bubble size (px) for dual-bubble overlay actors */
export const DRAMA_BUBBLE_SIZE = 72;

/** Drama timing constants (ms) */
export const DRAMA_TIMING = {
  /** Intro sequence max — stays within 3–8s user requirement */
  INTRO_MAX_MS: 7500,
  /** Default speech display duration before auto-hide */
  SPEECH_AUTO_HIDE_MS: 3000,
  /** Cooldown before replaying the same idle script */
  IDLE_COOLDOWN_MS: 15_000,
  /** Slide/move spring damping */
  SPRING_DAMPING: 12,
  SPRING_STIFFNESS: 100,
} as const;

/** Default normalized screen position for Tyson (right side) */
export const TYSON_DEFAULT_POSITION = { x: 0.85, y: 0.78 } as const;
/** Default normalized screen position for Lily (left side) */
export const LILY_DEFAULT_POSITION  = { x: 0.12, y: 0.78 } as const;

/** Tyson brand color (green to match theme.primary / post-login coach bubble) */
export const TYSON_COLOR = '#2A4B2A';
/** Lily brand color (accent to match theme.accent / post-login female coach bubble) */
export const LILY_COLOR  = '#FBD85D';
