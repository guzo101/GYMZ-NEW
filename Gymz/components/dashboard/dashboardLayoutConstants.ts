/**
 * Dashboard Layout Constants
 * Explicit, named spacing values for the Dashboard screen.
 * No magic numbers. Every layout decision is deliberate.
 */

export const DASHBOARD_LAYOUT = {
  /** Horizontal padding for scroll content (both sides) */
  contentPaddingHorizontal: 16,

  /** Top padding for scroll content - ZERO to avoid dead space. Safe area handled by header. */
  contentPaddingTop: 0,

  /** Bottom padding so last content clears the tab bar */
  contentPaddingBottom: 100,

  /** Space between header (logo + greeting) and first content block (calendar/banners) */
  headerToContentSpacing: 8,

  /** Space between days row and the block below it (CoachInsight or DailyPulse) */
  daysToNextBlockSpacing: 16,

  /** Space between major sections (e.g. DailyPulse and next card) */
  sectionSpacing: 20,

  /** Space between tightly related items (e.g. CalibrationBanner and SponsorBanners) */
  tightSpacing: 12,

  /** Header internal: space between top bar (logo/avatar) and welcome text */
  headerTopBarToGreeting: 6,

  /** Header internal: space below greeting before next section */
  headerGreetingToBottom: 0,
} as const;
