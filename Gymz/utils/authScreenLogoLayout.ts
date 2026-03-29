/**
 * Single source of truth for logo size and position on auth screens (AuthEntry, Login).
 * Used by splash screen so the logo is exactly the same size and position — no guesswork.
 *
 * Layout matches AuthEntryScreen (first screen after splash):
 * - DESIGN_WIDTH, DESIGN_HEIGHT, SPACE from AuthEntryScreen.
 * - ScrollView content is vertically centered; logo is at top of that content + padding.
 */

export const DESIGN_WIDTH = 360;
export const DESIGN_HEIGHT = 800;
export const SPACE = { xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 40 };

export function getScale(width: number, height: number): number {
  return Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT, 1.1);
}

function s(scale: number, n: number): number {
  return Math.round(n * scale);
}

/**
 * Content height below the logo on AuthEntryScreen (branding tagline + powered by + padding + buttons block).
 * Used to compute where the centered content starts so the logo top matches.
 */
export interface AuthLogoLayout {
  logoSize: number;
  logoTopPx: number;
  logoPaddingPx: number;
}

/**
 * Returns logo size and logo top position (in screen pixels) so the splash logo
 * can be placed exactly where the auth screen logo appears.
 * Uses the same scale and content centering as AuthEntryScreen.
 */
export function getAuthLogoLayout(
  width: number,
  height: number,
  insets: { top: number; bottom: number }
): AuthLogoLayout {
  const scale = getScale(width, height);
  const logoSize = s(scale, 80);
  const logoPaddingPx = s(scale, SPACE.sm);

  const contentAreaHeight = height - insets.top - insets.bottom;
  const scrollContentHeight =
    s(scale, 24) + // paddingTop
    s(scale, 12) * 2 +
    s(scale, 80) +
    s(scale, 8) + // logo block
    22 +
    s(scale, 8) +
    s(scale, 12) +
    16 + // tagline + powered by
    s(scale, 16) + // paddingBottom
    s(scale, 40) +
    52 +
    s(scale, 16) +
    48 +
    s(scale, 32) +
    48; // buttons block (approx)
  const contentTop = insets.top + (contentAreaHeight - scrollContentHeight) / 2;
  const logoTopPx = contentTop + s(scale, 24) + s(scale, 12);

  return { logoSize, logoTopPx, logoPaddingPx };
}
