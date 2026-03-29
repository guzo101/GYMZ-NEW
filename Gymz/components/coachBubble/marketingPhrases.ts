/**
 * Marketing phrases for AI Bubble during pre-authentication and onboarding flow.
 * Playful, enticing, and encouraging tone to guide users through signup.
 */

import { pickRandom } from './phrases';

// ── Login Screen Phrases ────────────────────────────────────────────

export const LOGIN_PHRASES = {
  initialPeek: [
    "Oh, someone's here! 👀",
    "Who's that? 👋",
    "Hello there! 👀",
    "I see you! 👋",
  ],
  emailTyping: [
    "Email? Got it! 📧",
    "I see what you're typing...",
    "Nice email! ✨",
  ],
  passwordTyping: [
    "I'll look away... privacy matters! 😌",
    "Your secret's safe with me 🤐",
    "Privacy first! I respect that! 🔒",
    "Looking away now... 👀➡️",
  ],
  formError: [
    "Almost there! Let's fix that ✨",
    "Oops! Let's try again 🛠️",
    "We can fix this together! 💪",
  ],
  loginSuccess: [
    "Welcome back! Let's go! 🎉",
    "Great to see you again! 🚀",
    "You're in! Let's do this! 💪",
  ],
  inactivity: [
    "Still there? Let's keep going! 👋",
    "Don't give up! You got this! 💪",
  ],
};

// ── Signup Screen Phrases ────────────────────────────────────────────

export const SIGNUP_PHRASES = {
  initialEntrance: [
    "New friend! Let's do this! 🚀",
    "Welcome! I'm excited to meet you! 👋",
    "Hey there! Ready to transform? 💪",
    "Let's get you started! 🎯",
  ],
  nameInput: [
    "Tell me your name! I'm curious 👋",
    "What should I call you? ✨",
    "Your name? Perfect! 👋",
  ],
  emailInput: [
    "Email? Got it! 📧",
    "Email address? Noted! ✨",
  ],
  passwordInput: [
    "Your secret's safe with me 🤐",
    "I'll look away... privacy matters! 😌",
    "Password? I'm not looking! 👀➡️",
  ],
  passwordConfirm: [
    "Matching? Perfect! ✨",
    "Passwords match? Great! ✅",
    "Looking good! ✨",
  ],
  formComplete: [
    "You're doing great! Almost there! 💪",
    "Almost done! You got this! 🔥",
    "Perfect! Let's keep going! 🎯",
  ],
  validationError: [
    "Oops! Let's fix that together 🛠️",
    "Almost there! Let's adjust that ✨",
    "We can fix this! 💪",
  ],
  progressMilestones: {
    quarter: [
      "25% done! 🎯",
      "Getting started! ✨",
    ],
    half: [
      "Halfway there! 🌟",
      "50%! You're crushing it! 💪",
    ],
    threeQuarters: [
      "75%! Almost! 🔥",
      "Almost done! Keep going! 🚀",
    ],
    complete: [
      "100%! Perfect! 🎉",
      "All done! Amazing! 🌟",
    ],
  },
};

// ── Gym Selection Phrases ────────────────────────────────────────────

export const GYM_SELECTION_PHRASES = {
  initialEntrance: [
    "Pick your gym! I'm excited to see where you'll train! 🏋️",
    "Choose your gym! Let's find the perfect fit! 💪",
    "Which gym? I'm curious! 👀",
  ],
  gymHover: [
    "Good choice! That one looks great! 👀",
    "Nice pick! ✨",
    "I like that one! 💪",
  ],
  gymSelected: [
    "Perfect! Let's keep going! 🎯",
    "Great choice! Next step! 🚀",
    "Excellent! Moving forward! 💪",
  ],
};

// ── Access Mode Selection Phrases ────────────────────────────────────

export const ACCESS_MODE_PHRASES = {
  initialPeek: [
    "How do you want to access Gymz? 🤔",
    "What's your access style? 💪",
    "Choose your path! 🎯",
  ],
  modeSelected: [
    "Nice! That's a solid choice! 💪",
    "Good pick! ✨",
    "Perfect! 🎯",
  ],
  gymAccessSelected: [
    "Full access? I like your style! 🔥",
    "Full access! That's the way! 💪",
    "Maximum access! Let's go! 🚀",
  ],
};

// ── Subscription Plans Phrases ────────────────────────────────────────

export const SUBSCRIPTION_PHRASES = {
  initialEntrance: [
    "Let's find your perfect plan! 💎",
    "Time to pick a plan! ✨",
    "Which plan fits you? 💪",
  ],
  planHover: [
    "That one's got great value! ✨",
    "Nice choice! 💪",
    "Good value there! ✨",
  ],
  planSelected: [
    "Smart choice! You're investing in yourself! 🎉",
    "Perfect! You're committed! 💪",
    "Great decision! Let's transform! 🚀",
  ],
};

// ── Health Metrics / AI Calibration Phrases ──────────────────────────

export const CALIBRATION_PHRASES = {
  initialGrandEntrance: [
    "Finally! Time to calibrate! I've been waiting! 🎯",
    "Calibration time! This is exciting! 🚀",
    "Let's calibrate! I need to know you better! 💪",
  ],
  heightInput: [
    "Perfect! 📏",
    "Got your height! ✨",
    "Height recorded! 📏",
  ],
  weightInput: [
    "Got it! ⚖️",
    "Weight noted! ✨",
    "Perfect! ⚖️",
  ],
  ageInput: [
    "Noted! 🎂",
    "Age recorded! ✨",
    "Got it! 🎂",
  ],
  goalInput: [
    "Love that goal! Let's crush it! 💪",
    "Amazing goal! We'll achieve it! 🎯",
    "Perfect goal! Let's make it happen! 🚀",
  ],
  calibrationComplete: [
    "YES! We're calibrated! Let's transform! 🚀🎉",
    "Perfect! I know you now! Let's go! 💪",
    "Calibration complete! Time to transform! 🎯",
  ],
  encouragement: [
    "This helps me help you better! 📊",
    "The more I know, the better I can help! 💪",
    "This data makes me smarter! 🧠",
  ],
};

// ── Screen Transition Phrases ─────────────────────────────────────────

export const TRANSITION_PHRASES = {
  screenChange: [
    "Ooh, what's this? 👀",
    "New screen! Exciting! ✨",
    "Moving forward! 🚀",
  ],
  returning: [
    "Welcome back! Missed you! 😊",
    "You're back! Let's continue! 💪",
    "Good to see you again! 👋",
  ],
};

// ── Helper Functions ──────────────────────────────────────────────────

export function getLoginPhrase(category: keyof typeof LOGIN_PHRASES): string {
  return pickRandom(LOGIN_PHRASES[category]);
}

export function getSignupPhrase(category: keyof typeof SIGNUP_PHRASES): string {
  if (category === 'progressMilestones') {
    // Return a random milestone phrase (simplified)
    const milestones = SIGNUP_PHRASES.progressMilestones;
    const allMilestones = [
      ...milestones.quarter,
      ...milestones.half,
      ...milestones.threeQuarters,
      ...milestones.complete,
    ];
    return pickRandom(allMilestones);
  }
  return pickRandom(SIGNUP_PHRASES[category]);
}

export function getGymSelectionPhrase(category: keyof typeof GYM_SELECTION_PHRASES): string {
  return pickRandom(GYM_SELECTION_PHRASES[category]);
}

export function getAccessModePhrase(category: keyof typeof ACCESS_MODE_PHRASES): string {
  return pickRandom(ACCESS_MODE_PHRASES[category]);
}

export function getSubscriptionPhrase(category: keyof typeof SUBSCRIPTION_PHRASES): string {
  return pickRandom(SUBSCRIPTION_PHRASES[category]);
}

export function getCalibrationPhrase(category: keyof typeof CALIBRATION_PHRASES): string {
  return pickRandom(CALIBRATION_PHRASES[category]);
}

export function getTransitionPhrase(category: keyof typeof TRANSITION_PHRASES): string {
  return pickRandom(TRANSITION_PHRASES[category]);
}
