/**
 * Login Screen Drama Scripts
 *
 * Creative direction: Tyson = motion/confidence, Lily = charm/reaction.
 * Stage 1: Entrance story only. Scenes are short (1.2s–3.5s per beat), one line then motion.
 * Lily Scene 2 positions come from loginScreenLayout.ts (logo coordinates from LoginScreen.tsx).
 */

import type { DramaScript } from '../types';
import { LILY_BEHIND_LOGO } from '../loginScreenLayout';

export const loginScripts: DramaScript[] = [
  // ─── Stage 1 · Scene 1: The quiet screen scan (Arrival) ───────────────────
  // Trigger: 350ms after layout. Tyson only. 4–6s total.
  // Goal: Screen feels inhabited before anything else. One line, then motion.
  {
    id: 'login_enter',
    trigger: 'screenEnter',
    screen: 'Login',
    priority: 10,
    interruptible: false,
    cooldownMs: 30_000,
    keyframes: [
      // 0ms — Tyson hiding, peeking. Eyes curious, looking around (not idle).
      { actor: 'tyson', at: 0,    action: { type: 'show' } },
      { actor: 'tyson', at: 0,    action: { type: 'moveTo',       x: 1.05, y: 0.78, spring: false } },
      { actor: 'tyson', at: 0,    action: { type: 'expression',   value: 'curiousTilt' } },
      { actor: 'tyson', at: 0,    action: { type: 'lookAt',       target: 'left' } },
      // 400ms — Glance center, then keep looking around
      { actor: 'tyson', at: 400,  action: { type: 'lookAt',       target: 'center' } },
      // 700ms — Lean in, still curious
      { actor: 'tyson', at: 700,  action: { type: 'moveTo',       x: 1.02, y: 0.78 } },
      { actor: 'tyson', at: 700,  action: { type: 'lookAt',       target: 'left' } },
      // 1000ms — Look up at logo
      { actor: 'tyson', at: 1000, action: { type: 'lookAt',       target: 'logo' } },
      { actor: 'tyson', at: 1000, action: { type: 'expression',   value: 'wide' } },
      // 1200ms — Single blink
      { actor: 'tyson', at: 1200, action: { type: 'expression',   value: 'sleepy' } },
      { actor: 'tyson', at: 1320, action: { type: 'expression',   value: 'curiousTilt' } },
      { actor: 'tyson', at: 1320, action: { type: 'lookAt',       target: 'logo' } },
      // 1600ms — Look at card / form
      { actor: 'tyson', at: 1600, action: { type: 'lookAt',       target: 'down' } },
      // 2100ms — Quick glance left, then center
      { actor: 'tyson', at: 2100, action: { type: 'lookAt',       target: 'left' } },
      { actor: 'tyson', at: 2400, action: { type: 'lookAt',       target: 'center' } },
      // 2700ms — Look at card again
      { actor: 'tyson', at: 2700, action: { type: 'lookAt',       target: 'down' } },
      // 3200ms — Look at user (noticing them)
      { actor: 'tyson', at: 3200, action: { type: 'lookAt',       target: 'user' } },
      { actor: 'tyson', at: 3200, action: { type: 'expression',   value: 'wide' } },
      // 3600ms — Hold on user, then speak
      { actor: 'tyson', at: 3600, action: { type: 'lookAt',       target: 'user' } },
      { actor: 'tyson', at: 4000, action: { type: 'speech',       text: "Wait... someone is here." } },
      // After speech: stay curious (looking at user), not idle
      { actor: 'tyson', at: 5300, action: { type: 'hideSpeech' } },
      { actor: 'tyson', at: 5300, action: { type: 'expression',   value: 'curiousTilt' } },
      { actor: 'tyson', at: 5300, action: { type: 'lookAt',       target: 'user' } },

      // ─── Scene 2: Lily hiding behind the logo (0.8s after Scene 1) ─────────
      // Positions from loginScreenLayout.ts (derived from LoginScreen.tsx logo layout).
      { actor: 'lily',  at: 6100, action: { type: 'show' } },
      { actor: 'lily',  at: 6100, action: { type: 'moveTo',       x: LILY_BEHIND_LOGO.hidden.x, y: LILY_BEHIND_LOGO.hidden.y, spring: false } },
      { actor: 'lily',  at: 6100, action: { type: 'expression',   value: 'amused' } },
      { actor: 'lily',  at: 6100, action: { type: 'lookAt',       target: 'right' } },
      // Peek down from behind the logo (left side of logo)
      { actor: 'lily',  at: 6250, action: { type: 'moveTo',       x: LILY_BEHIND_LOGO.peek.x, y: LILY_BEHIND_LOGO.peek.y } },
      // Tyson notices — turn sharply toward logo, tiny surprise recoil
      { actor: 'tyson', at: 6400, action: { type: 'lookAt',       target: 'logo' } },
      { actor: 'tyson', at: 6400, action: { type: 'expression',   value: 'wide' } },
      { actor: 'tyson', at: 6450, action: { type: 'shake' } },
      // Tyson: "Lily. Stop hiding." — then Lily replies and ducks back behind logo
      { actor: 'tyson', at: 6700, action: { type: 'speech',       text: "Lily. Stop hiding." } },
      { actor: 'lily',  at: 7200, action: { type: 'speech',       text: "I was observing." } },
      { actor: 'lily',  at: 7200, action: { type: 'expression',   value: 'curiousTilt' } },
      { actor: 'lily',  at: 7800, action: { type: 'hideSpeech' } },
      { actor: 'lily',  at: 7900, action: { type: 'slideToEdge',  edge: 'top' } },
      { actor: 'tyson', at: 8600, action: { type: 'hideSpeech' } },
    ],
  },

  // ─── 2 · Password Focus — Privacy Reaction ───────────────────────────────
  {
    id: 'login_password_focus',
    trigger: 'passwordFocus',
    screen: 'Login',
    priority: 8,
    interruptible: true,
    cooldownMs: 3_000,
    keyframes: [
      // Both look away dramatically
      { actor: 'tyson', at: 0,   action: { type: 'expression', value: 'happy' } },
      { actor: 'lily',  at: 0,   action: { type: 'expression', value: 'happy' } },
      { actor: 'tyson', at: 0,   action: { type: 'lookAt',     target: 'away' } },
      { actor: 'lily',  at: 100, action: { type: 'lookAt',     target: 'away' } },
      // Tyson covers by rotating away
      { actor: 'tyson', at: 200, action: { type: 'rotate',     degrees: -30 } },
      { actor: 'lily',  at: 300, action: { type: 'rotate',     degrees: 30 } },
      // Speech bubble
      { actor: 'tyson', at: 400, action: { type: 'speech',     text: "Not looking! 🙈 Privacy first!" } },
      { actor: 'lily',  at: 600, action: { type: 'speech',     text: "We. Are. Not. Watching. 👀➡️" } },
      { actor: 'lily',  at: 600, action: { type: 'bounce' } },
      { actor: 'tyson', at: 2000, action: { type: 'hideSpeech' } },
      { actor: 'lily',  at: 2200, action: { type: 'hideSpeech' } },
    ],
  },

  // ─── 3 · Password Toggle — Tyson Peeks ───────────────────────────────────
  {
    id: 'login_password_toggle',
    trigger: 'passwordToggle',
    screen: 'Login',
    priority: 9,
    interruptible: true,
    cooldownMs: 2_000,
    keyframes: [
      // Tyson dramatically turns back
      { actor: 'tyson', at: 0,   action: { type: 'rotate',     degrees: 15 } },
      { actor: 'tyson', at: 0,   action: { type: 'expression', value: 'wide' } },
      { actor: 'tyson', at: 0,   action: { type: 'lookAt',     target: 'user' } },
      { actor: 'tyson', at: 200, action: { type: 'speech',     text: "HEY! I wasn't peeking! 😳" } },
      { actor: 'tyson', at: 200, action: { type: 'shake' } },
      // Lily judges
      { actor: 'lily',  at: 400, action: { type: 'lookAt',     target: 'otherBubble' } },
      { actor: 'lily',  at: 400, action: { type: 'expression', value: 'suspicious' } },
      { actor: 'lily',  at: 600, action: { type: 'speech',     text: "Sure you weren't 🙄" } },
      // Tyson defensive
      { actor: 'tyson', at: 1200, action: { type: 'hideSpeech' } },
      { actor: 'lily',  at: 1500, action: { type: 'hideSpeech' } },
      { actor: 'tyson', at: 1600, action: { type: 'lookAt',   target: 'away' } },
      { actor: 'lily',  at: 1600, action: { type: 'lookAt',   target: 'away' } },
    ],
  },

  // ─── 4 · Password Blur — Both Return ─────────────────────────────────────
  {
    id: 'login_password_blur',
    trigger: 'passwordBlur',
    screen: 'Login',
    priority: 6,
    interruptible: true,
    keyframes: [
      { actor: 'tyson', at: 0,   action: { type: 'rotate',     degrees: 0 } },
      { actor: 'lily',  at: 0,   action: { type: 'rotate',     degrees: 0 } },
      { actor: 'tyson', at: 200, action: { type: 'expression', value: 'idle' } },
      { actor: 'lily',  at: 200, action: { type: 'expression', value: 'idle' } },
      { actor: 'tyson', at: 200, action: { type: 'lookAt',     target: 'user' } },
      { actor: 'lily',  at: 200, action: { type: 'lookAt',     target: 'user' } },
    ],
  },

  // ─── 5 · Email Focus — Tyson Curious ────────────────────────────────────
  {
    id: 'login_email_focus',
    trigger: 'emailFocus',
    screen: 'Login',
    priority: 6,
    interruptible: true,
    cooldownMs: 5_000,
    keyframes: [
      { actor: 'tyson', at: 0,   action: { type: 'expression', value: 'curiousTilt' } },
      { actor: 'tyson', at: 0,   action: { type: 'lookAt',     target: 'down' } },
      { actor: 'tyson', at: 200, action: { type: 'speech',     text: "Email? Don't worry, it's safe with us 🔒" } },
      { actor: 'lily',  at: 400, action: { type: 'nod' } },
      { actor: 'tyson', at: 2500, action: { type: 'hideSpeech' } },
    ],
  },

  // ─── 6 · Form Error — Tyson Facepalm ────────────────────────────────────
  {
    id: 'login_form_error',
    trigger: 'formError',
    screen: 'Login',
    priority: 9,
    interruptible: true,
    cooldownMs: 4_000,
    keyframes: [
      { actor: 'tyson', at: 0,   action: { type: 'expression', value: 'suspicious' } },
      { actor: 'lily',  at: 0,   action: { type: 'expression', value: 'concerned' as any } },
      { actor: 'tyson', at: 0,   action: { type: 'shake' } },
      { actor: 'tyson', at: 300, action: { type: 'speech',     text: "Hmm... something's not right 🤔" } },
      { actor: 'lily',  at: 500, action: { type: 'speech',     text: "Don't worry, try again! You've got this 💪" } },
      { actor: 'lily',  at: 500, action: { type: 'bounce' } },
      { actor: 'tyson', at: 2500, action: { type: 'hideSpeech' } },
      { actor: 'lily',  at: 3000, action: { type: 'hideSpeech' } },
      { actor: 'tyson', at: 3200, action: { type: 'expression', value: 'idle' } },
      { actor: 'lily',  at: 3200, action: { type: 'expression', value: 'idle' } },
    ],
  },

  // ─── 7 · Typing — Tyson Encouraging ─────────────────────────────────────
  {
    id: 'login_typing',
    trigger: 'typing',
    screen: 'Login',
    priority: 3,
    interruptible: true,
    cooldownMs: 8_000,
    keyframes: [
      { actor: 'tyson', at: 0, action: { type: 'nod' } },
      { actor: 'tyson', at: 0, action: { type: 'expression', value: 'happy' } },
    ],
  },

  // ─── 8 · Idle Nudge ───────────────────────────────────────────────────────
  {
    id: 'login_idle',
    trigger: 'idle',
    screen: 'Login',
    priority: 2,
    interruptible: true,
    cooldownMs: 15_000,
    keyframes: [
      // Tyson nudges Lily
      { actor: 'tyson', at: 0,   action: { type: 'bounce' } },
      { actor: 'tyson', at: 200, action: { type: 'lookAt',     target: 'otherBubble' } },
      { actor: 'tyson', at: 200, action: { type: 'expression', value: 'amused' } },
      { actor: 'tyson', at: 400, action: { type: 'speech',     text: "Psst... they're still there 👀" } },
      // Lily yawns (sleepy expression)
      { actor: 'lily',  at: 800, action: { type: 'expression', value: 'sleepy' } },
      { actor: 'lily',  at: 1000, action: { type: 'speech',    text: "I know... I'm watching 😴" } },
      { actor: 'tyson', at: 2000, action: { type: 'hideSpeech' } },
      { actor: 'lily',  at: 2500, action: { type: 'hideSpeech' } },
      { actor: 'lily',  at: 2800, action: { type: 'expression', value: 'idle' } },
      { actor: 'tyson', at: 2800, action: { type: 'lookAt',     target: 'user' } },
      // Tyson shouts at user to continue
      { actor: 'tyson', at: 3000, action: { type: 'speech',    text: "Hey! Sign in to unlock your best self 🔥" } },
      { actor: 'tyson', at: 3000, action: { type: 'bounce' } },
      { actor: 'tyson', at: 5000, action: { type: 'hideSpeech' } },
    ],
  },
];
