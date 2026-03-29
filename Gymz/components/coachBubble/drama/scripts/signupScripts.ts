/**
 * Signup + GymSelection + HealthMetrics Drama Scripts
 */

import type { DramaScript } from '../types';

export const signupScripts: DramaScript[] = [
  // ─── Signup Screen Enter ──────────────────────────────────────────────────
  {
    id: 'signup_enter',
    trigger: 'screenEnter',
    screen: 'Signup',
    priority: 10,
    interruptible: false,
    cooldownMs: 30_000,
    keyframes: [
      // Lily appears first this time — gender reveal energy
      { actor: 'lily',  at: 0,   action: { type: 'moveTo',       x: -0.2, y: 0.78, spring: false } },
      { actor: 'lily',  at: 50,  action: { type: 'show' } },
      { actor: 'lily',  at: 100, action: { type: 'moveTo',       x: 0.12, y: 0.78 } },
      { actor: 'lily',  at: 100, action: { type: 'expression',   value: 'heartEyes' } },
      { actor: 'lily',  at: 600, action: { type: 'speech',       text: "A new member! Tyson, come look! 😍" } },
      { actor: 'lily',  at: 600, action: { type: 'bounce' } },
      // Tyson slides in from right
      { actor: 'tyson', at: 900, action: { type: 'moveTo',       x: 1.2, y: 0.78, spring: false } },
      { actor: 'tyson', at: 900, action: { type: 'show' } },
      { actor: 'tyson', at: 1000, action: { type: 'moveTo',      x: 0.85, y: 0.78 } },
      { actor: 'tyson', at: 1000, action: { type: 'expression',  value: 'wide' } },
      // Tyson squints trying to see
      { actor: 'tyson', at: 1600, action: { type: 'expression',  value: 'curiousTilt' } },
      { actor: 'tyson', at: 1700, action: { type: 'speech',      text: "Whoa. This one looks serious 💪" } },
      // Lily rolls eyes
      { actor: 'lily',  at: 2200, action: { type: 'hideSpeech' } },
      { actor: 'lily',  at: 2200, action: { type: 'expression',  value: 'eyeRoll' } },
      { actor: 'lily',  at: 2400, action: { type: 'speech',      text: "Fill in your details and let's GO! 🚀" } },
      { actor: 'tyson', at: 2600, action: { type: 'hideSpeech' } },
      { actor: 'tyson', at: 2600, action: { type: 'nod' } },
      { actor: 'lily',  at: 4000, action: { type: 'hideSpeech' } },
    ],
  },

  // ─── Signup Name Focus ────────────────────────────────────────────────────
  {
    id: 'signup_name_focus',
    trigger: 'nameFocus',
    screen: 'Signup',
    priority: 6,
    interruptible: true,
    cooldownMs: 10_000,
    keyframes: [
      { actor: 'lily',  at: 0,   action: { type: 'expression', value: 'starEyes' } },
      { actor: 'lily',  at: 0,   action: { type: 'speech',     text: "What shall we call our new champion? 🏆" } },
      { actor: 'tyson', at: 400, action: { type: 'nod' } },
      { actor: 'lily',  at: 2500, action: { type: 'hideSpeech' } },
      { actor: 'lily',  at: 2600, action: { type: 'expression', value: 'idle' } },
    ],
  },

  // ─── Signup Email Typing ──────────────────────────────────────────────────
  {
    id: 'signup_email_typing',
    trigger: 'emailTyping',
    screen: 'Signup',
    priority: 4,
    interruptible: true,
    cooldownMs: 12_000,
    keyframes: [
      { actor: 'tyson', at: 0,  action: { type: 'expression', value: 'happy' } },
      { actor: 'tyson', at: 0,  action: { type: 'speech',     text: "Email locked in. You're on your way! 🎯" } },
      { actor: 'tyson', at: 0,  action: { type: 'nod' } },
      { actor: 'tyson', at: 2000, action: { type: 'hideSpeech' } },
    ],
  },

  // ─── Signup Form Progress 50% ─────────────────────────────────────────────
  {
    id: 'signup_progress_50',
    trigger: 'formProgress50',
    screen: 'Signup',
    priority: 5,
    interruptible: true,
    cooldownMs: 60_000,
    keyframes: [
      { actor: 'tyson', at: 0,   action: { type: 'bounce' } },
      { actor: 'lily',  at: 200, action: { type: 'bounce' } },
      { actor: 'tyson', at: 400, action: { type: 'expression', value: 'happy' } },
      { actor: 'tyson', at: 400, action: { type: 'speech',     text: "Halfway there! You're crushing it! 💥" } },
      { actor: 'lily',  at: 600, action: { type: 'speech',     text: "Keep going! Almost there! 🔥" } },
      { actor: 'tyson', at: 2500, action: { type: 'hideSpeech' } },
      { actor: 'lily',  at: 2800, action: { type: 'hideSpeech' } },
    ],
  },

  // ─── Signup Complete ──────────────────────────────────────────────────────
  {
    id: 'signup_complete',
    trigger: 'formSuccess',
    screen: 'Signup',
    priority: 10,
    interruptible: false,
    keyframes: [
      { actor: 'tyson', at: 0,    action: { type: 'expression', value: 'celebration' } },
      { actor: 'lily',  at: 0,    action: { type: 'expression', value: 'celebration' } },
      { actor: 'tyson', at: 0,    action: { type: 'bounce' } },
      { actor: 'lily',  at: 150,  action: { type: 'bounce' } },
      { actor: 'tyson', at: 300,  action: { type: 'speech',     text: "YES! Let's GO champion!! 🏆🔥" } },
      { actor: 'lily',  at: 500,  action: { type: 'speech',     text: "Welcome to the Gymz family! 🎉" } },
      { actor: 'tyson', at: 600,  action: { type: 'scale',      value: 1.2 } },
      { actor: 'lily',  at: 750,  action: { type: 'scale',      value: 1.2 } },
      { actor: 'tyson', at: 1200, action: { type: 'scale',      value: 1 } },
      { actor: 'lily',  at: 1350, action: { type: 'scale',      value: 1 } },
      { actor: 'tyson', at: 3000, action: { type: 'hideSpeech' } },
      { actor: 'lily',  at: 3200, action: { type: 'hideSpeech' } },
    ],
  },

  // ─── Signup Error ─────────────────────────────────────────────────────────
  {
    id: 'signup_error',
    trigger: 'formError',
    screen: 'Signup',
    priority: 8,
    interruptible: true,
    cooldownMs: 5_000,
    keyframes: [
      { actor: 'tyson', at: 0,   action: { type: 'expression', value: 'suspicious' } },
      { actor: 'tyson', at: 0,   action: { type: 'shake' } },
      { actor: 'tyson', at: 300, action: { type: 'speech',     text: "Oops! Check that field again 🔍" } },
      { actor: 'lily',  at: 500, action: { type: 'expression', value: 'curiousTilt' } },
      { actor: 'lily',  at: 600, action: { type: 'speech',     text: "Nearly there! Fix it and keep going 💪" } },
      { actor: 'lily',  at: 600, action: { type: 'nod' } },
      { actor: 'tyson', at: 2500, action: { type: 'hideSpeech' } },
      { actor: 'lily',  at: 3000, action: { type: 'hideSpeech' } },
    ],
  },
];

export const gymSelectionScripts: DramaScript[] = [
  // ─── Gym Selection Enter ──────────────────────────────────────────────────
  {
    id: 'gym_enter',
    trigger: 'screenEnter',
    screen: 'GymSelection',
    priority: 10,
    interruptible: false,
    cooldownMs: 30_000,
    keyframes: [
      { actor: 'tyson', at: 0,   action: { type: 'show' } },
      { actor: 'lily',  at: 0,   action: { type: 'show' } },
      { actor: 'tyson', at: 0,   action: { type: 'expression', value: 'wide' } },
      { actor: 'lily',  at: 0,   action: { type: 'expression', value: 'happy' } },
      { actor: 'tyson', at: 300, action: { type: 'speech',     text: "Pick your gym! This is where it gets REAL 🏋️" } },
      { actor: 'tyson', at: 300, action: { type: 'bounce' } },
      { actor: 'lily',  at: 800, action: { type: 'speech',     text: "Choose wisely... or don't. We'll guide you! 😉" } },
      { actor: 'lily',  at: 800, action: { type: 'nod' } },
      { actor: 'tyson', at: 2500, action: { type: 'hideSpeech' } },
      { actor: 'lily',  at: 3000, action: { type: 'hideSpeech' } },
    ],
  },

  // ─── Gym Selected ─────────────────────────────────────────────────────────
  {
    id: 'gym_selected',
    trigger: 'gymSelected',
    screen: 'GymSelection',
    priority: 9,
    interruptible: false,
    keyframes: [
      { actor: 'tyson', at: 0,   action: { type: 'expression', value: 'starEyes' } },
      { actor: 'lily',  at: 100, action: { type: 'expression', value: 'heartEyes' } },
      { actor: 'tyson', at: 0,   action: { type: 'bounce' } },
      { actor: 'tyson', at: 300, action: { type: 'speech',     text: "Great choice! Now let's get to work! 💪" } },
      { actor: 'lily',  at: 500, action: { type: 'bounce' } },
      { actor: 'lily',  at: 700, action: { type: 'speech',     text: "This gym is going to love you! 🌟" } },
      { actor: 'tyson', at: 2800, action: { type: 'hideSpeech' } },
      { actor: 'lily',  at: 3200, action: { type: 'hideSpeech' } },
    ],
  },

  // ─── Health Metrics Enter ─────────────────────────────────────────────────
  {
    id: 'health_enter',
    trigger: 'screenEnter',
    screen: 'HealthMetrics',
    priority: 10,
    interruptible: false,
    cooldownMs: 30_000,
    keyframes: [
      { actor: 'tyson', at: 0,   action: { type: 'show' } },
      { actor: 'lily',  at: 0,   action: { type: 'show' } },
      { actor: 'lily',  at: 0,   action: { type: 'expression', value: 'curiousTilt' } },
      { actor: 'lily',  at: 300, action: { type: 'speech',     text: "Tell us about yourself! The more we know... 📊" } },
      { actor: 'tyson', at: 600, action: { type: 'expression', value: 'proud' } },
      { actor: 'tyson', at: 700, action: { type: 'speech',     text: "...the better we coach! Data = gains! 🎯" } },
      { actor: 'tyson', at: 700, action: { type: 'nod' } },
      { actor: 'lily',  at: 2800, action: { type: 'hideSpeech' } },
      { actor: 'tyson', at: 3200, action: { type: 'hideSpeech' } },
    ],
  },

  // ─── Onboarding Complete ──────────────────────────────────────────────────
  {
    id: 'onboarding_complete',
    trigger: 'onboardingComplete',
    priority: 10,
    interruptible: false,
    keyframes: [
      { actor: 'tyson', at: 0,    action: { type: 'expression', value: 'celebration' } },
      { actor: 'lily',  at: 100,  action: { type: 'expression', value: 'celebration' } },
      { actor: 'tyson', at: 0,    action: { type: 'bounce' } },
      { actor: 'lily',  at: 200,  action: { type: 'bounce' } },
      { actor: 'tyson', at: 400,  action: { type: 'scale',      value: 1.25 } },
      { actor: 'lily',  at: 500,  action: { type: 'scale',      value: 1.25 } },
      { actor: 'tyson', at: 500,  action: { type: 'speech',     text: "You're IN!! Welcome to the squad! 🔥" } },
      { actor: 'lily',  at: 700,  action: { type: 'speech',     text: "Time to transform your life! 💫" } },
      { actor: 'tyson', at: 1400, action: { type: 'scale',      value: 1 } },
      { actor: 'lily',  at: 1500, action: { type: 'scale',      value: 1 } },
      // Lily exits first — she'll be replaced by gender-matched bubble
      { actor: 'lily',  at: 3500, action: { type: 'hideSpeech' } },
      { actor: 'lily',  at: 4000, action: { type: 'slideToEdge', edge: 'left' } },
      { actor: 'tyson', at: 3800, action: { type: 'hideSpeech' } },
      { actor: 'tyson', at: 4200, action: { type: 'slideToEdge', edge: 'right' } },
    ],
  },
];
