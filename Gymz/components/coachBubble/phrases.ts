/**
 * AI Coach character phrase libraries.
 * Playful Guardian: observant, playful suspicion, goal guardian.
 * Tone: encouraging, funny, supportive — never shaming.
 */

/** Personality temperature 1–5: Calm → Goal Protector */
export type PersonalityTemperature = 1 | 2 | 3 | 4 | 5;

/** Watcher effect: "The system knows what I am doing" — curious, not creepy */
export const WATCHER_PHRASES = [
  'I noticed something.',
  'Interesting pattern.',
  'I might be wrong…',
  'I am noticing things.',
  'That did not go unnoticed.',
  'I see what happened.',
  'Something happened here.',
  'Interesting behavior.',
  'Data updated.',
  'The pattern continues.',
] as const;

/** Position-aware quips when user moves the bubble */
export const POSITION_QUIPS = {
  top: [
    'I have a good view from up here.',
    'Keeping an eye on things.',
  ],
  bottom: [
    'Front row seat.',
    'Right where the action is.',
  ],
  blocking: [
    'I am blocking something… am I?',
    'Should I move?',
  ],
  movedOften: [
    'You are rearranging my office.',
    'I like a change of scenery.',
  ],
} as const;

/** Behavioral trigger reactions by category */
export const BEHAVIORAL_REACTIONS: Record<string, string[]> = {
  mealLogged: [
    'I smell macros.',
    'I clocked that.',
    'That did not go unnoticed.',
    'Interesting move.',
    'That counted.',
    'Data updated.',
    'The numbers like that.',
    'Your goal liked that.',
  ],
  workoutLogged: [
    'That looked intentional.',
    'That looked intense.',
    'That was real work.',
    'That was not easy.',
    'Effort confirmed.',
    'That was strong.',
    'That was commitment.',
    'You showed up.',
  ],
  streakMilestone: [
    'This is becoming a habit.',
    'The streak survives.',
    'That strengthens the streak.',
    'Keep stacking wins.',
    'The momentum continues.',
    'We are building something.',
    'This is how habits form.',
    'I like this pattern.',
  ],
  missedDay: [
    'We were building momentum.',
    'I am getting curious.',
    'Interesting choice.',
  ],
  threeMissedDays: [
    'I am getting concerned.',
    'We are drifting from the goal.',
    'I noticed a gap.',
  ],
  longAbsence: [
    'You disappeared.',
    'Ah, you\'re back.',
    'I was keeping an eye on things.',
    'Ready to continue?',
  ],
  appOpened: [
    'Oh… someone opened the app.',
    'Are we about to make progress today?',
    'Did I just see food?',
    'I smell something being logged.',
  ],
  stepsLogged: [
    'I see today\'s steps.',
    'Momentum detected.',
    'That moved the needle.',
  ],
  hydrationLogged: [
    'Hydration detected.',
    'That was a good call.',
  ],
};

/** Social media lingo — modern, punchy tone */
export const SOCIAL_LINGO = [
  'I clocked that.',
  'Interesting move.',
  'That did not go unnoticed.',
  'I see what happened.',
  'Suspicious activity detected.',
  'Something happened here.',
  'That was calculated.',
  'I respect the effort.',
  'That was clean.',
  'That was smooth.',
  'That was intentional.',
  'Now that is discipline.',
  'That helped the mission.',
  'That supports the goal.',
  'I like this energy.',
  'Momentum detected.',
  'Effort confirmed.',
  'Progress recorded.',
  'Interesting pattern.',
  'I am noticing things.',
  'That was strategic.',
  'That was deliberate.',
  'Smart move.',
  'That counted.',
  'That changed the data.',
  'The numbers like that.',
  'Your goal liked that.',
  'I approve this behavior.',
  'The streak survives.',
  'That protects the streak.',
  'Not bad.',
  'Respectable.',
  'That took effort.',
  'That required focus.',
  'That was controlled.',
  'That was strong.',
  'That was commitment.',
  'You showed up.',
  'Showing up matters.',
  'That moved the needle.',
  'That changed the trajectory.',
  'That was disciplined.',
  'That was a decision.',
  'I respect the consistency.',
  'I like the direction.',
  'That was not random.',
  'You planned that.',
  'This is how habits form.',
  'That is repeatable.',
  'That was focused.',
  'Keep stacking wins.',
  'The momentum continues.',
  'We are building something.',
  'That was real work.',
  'That was not easy.',
  'That was a good call.',
  'I saw that coming.',
  'That surprised me.',
  'I like this pattern.',
  'That was a win.',
  'That helped your future self.',
  'Future you approves.',
  'Interesting choice.',
  'Bold decision.',
  'That was controlled chaos.',
  'That was calculated risk.',
  'That was thoughtful.',
  'That was smart.',
  'That was impressive.',
  'That was clean execution.',
  'Precision move.',
  'I like that strategy.',
  'That was efficient.',
  'That was productive.',
  'That counts.',
  'That mattered.',
  'That was progress.',
  'That was momentum.',
  'Momentum continues.',
  'I like what I am seeing.',
  'This is how progress looks.',
  'This is becoming a habit.',
  'The system likes that.',
  'Data updated.',
  'Goal alignment detected.',
  'That supports the mission.',
  'That protects the plan.',
  'Interesting behavior.',
  'I noticed that.',
  'The pattern continues.',
  'That was intentional progress.',
  'That was well played.',
  'That was a disciplined choice.',
  'That was thoughtful execution.',
  'That was strategic thinking.',
  'That strengthens the streak.',
  'The numbers approve.',
  'I like that decision.',
  'That helps the objective.',
  'Keep going.',
] as const;

export const SCAN_START_PHRASES = {
  ratifah: [
    "Glow-up fuel? Snapshot! ✨📸",
    "Salad or lie? Prove it! 🥗",
    "Main character vibes. Capture! 💅",
    "Lens on the flex. ✨📸",
    "Cute meal. Vibe check! 🌸",
    "We look good. Save this! 📸✨",
    "Aesthetic check. Lock it in! 🥗✨",
  ],
  tyson: [
    "Elite fuel. Screen it! 🦍⚡",
    "Macros check. Lock it in! 🔥",
    "Absolute unit. Snapshot! 📸⚡",
    "Victory lap. Capture! 💪⚡",
    "Post-worthy. Proof now! 🦍",
    "Don't blink. Screen it! ⚡📸",
    "Beast mode fuel. Record it! 🔥💪",
  ],
};

/** Pattern revelation — "The AI is studying the user" */
export const PATTERN_REVELATION_TEMPLATES = [
  'You tend to skip breakfast on weekdays.',
  'You are most consistent on Tuesdays.',
  'You log dinner late.',
  'You log dinner consistently… but breakfast disappears.',
  'I cannot prove it… but something happened between lunch and dinner.',
  'You said the goal was {goal}. I am guarding that.',
] as const;

/** Temperature-based example lines (for tone reference) */
export const TEMPERATURE_EXAMPLES: Record<PersonalityTemperature, string[]> = {
  1: ['I see today\'s steps.', 'Noted.', 'Watching.'],
  2: ['That helped the mission.', 'I like this energy.', 'Keep going.'],
  3: ['That snack looked suspicious.', 'Interesting move.', 'I clocked that.'],
  4: ['We are drifting from the goal.', 'That was a disciplined choice.', 'Show up again.'],
  5: ['We are drifting from the goal.', 'I am getting concerned.', 'Your goal needs you.'],
};

export function pickRandom<T extends readonly string[]>(arr: T): T[number] {
  return arr[Math.floor(Math.random() * arr.length)] as T[number];
}

export function getReactionForTrigger(trigger: string): string {
  const list = BEHAVIORAL_REACTIONS[trigger];
  if (!list || list.length === 0) return pickRandom([...SOCIAL_LINGO]);
  return pickRandom(list);
}
