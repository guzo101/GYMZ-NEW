/**
 * Logo region coordinates for the Login screen.
 *
 * SOURCE OF TRUTH: Gymz/screens/LoginScreen.tsx
 * - DESIGN_WIDTH = 360, DESIGN_HEIGHT = 800
 * - layout.logoSize = s(64), layout.logoPadding = s(12), layout.logoToTagline = s(8)
 * - layout.scrollPaddingTop = s(insets.top + 8)
 * - ScrollView contentContainerStyle: flexGrow: 1, justifyContent: 'center'
 * - Single child View (flexGrow: 0): brandingSection then form card
 * - brandingSection: marginTop 0, marginBottom layout.brandingToForm (s(40))
 * - Logo wrapper: padding layout.logoPadding; GymzLogo size logoSize, marginBottom logoToTagline
 * - Logo is horizontally centered (brandingSection alignItems: 'center')
 *
 * Formula (design 360×800, scale=1, insets.top=50):
 * - scrollPaddingTop = 58
 * - Content block height ≈ branding (logoPadding*2 + logoSize + logoToTagline + tagline + margins + brandingToForm) + form height
 * - contentTop = (height - contentHeight)/2 + scrollPaddingTop
 * - Logo center from content top = logoPadding + logoSize/2 = 12 + 32 = 44
 * - Logo center Y (screen) = contentTop + 44 → normalized = (contentTop + 44) / height
 * - Logo top Y (screen) = contentTop + logoPadding → normalized
 * - Logo bottom Y (screen) = contentTop + logoPadding + logoSize → normalized
 * - Logo center X = 0.5 (centered)
 * - Logo left X = (width/2 - logoSize/2) / width = 0.5 - (logoSize/2)/width
 */

const DESIGN_WIDTH = 360;
const DESIGN_HEIGHT = 800;

/** Scale at design size (1:1) */
const SCALE = 1;
const s = (n: number) => Math.round(n * SCALE);

const LOGO_SIZE = s(64);
const LOGO_PADDING = s(12);
const LOGO_TO_TAGLINE = s(8);
const BRANDING_TO_FORM = s(40);
const INSETS_TOP = 50;
const SCROLL_PADDING_TOP = s(INSETS_TOP + 8);

/** Approximate content block height from LoginScreen layout (branding + form). */
const BRANDING_HEIGHT =
  LOGO_PADDING * 2 + LOGO_SIZE + LOGO_TO_TAGLINE + 22 + 8 + 12 + 20 + BRANDING_TO_FORM;
const FORM_HEIGHT_APPROX = 340;
const CONTENT_HEIGHT_APPROX = BRANDING_HEIGHT + FORM_HEIGHT_APPROX;

const CONTENT_TOP =
  (DESIGN_HEIGHT - CONTENT_HEIGHT_APPROX) / 2 + SCROLL_PADDING_TOP;
const LOGO_TOP_PX = CONTENT_TOP + LOGO_PADDING;
const LOGO_CENTER_Y_PX = CONTENT_TOP + LOGO_PADDING + LOGO_SIZE / 2;
const LOGO_BOTTOM_PX = CONTENT_TOP + LOGO_PADDING + LOGO_SIZE;

/** Normalized (0–1) logo region. Used by drama so Lily "comes from" the logo. */
export const LOGO_REGION = {
  /** Logo center X (always 0.5 on Login). */
  centerX: 0.5,
  /** Logo center Y in normalized screen space. */
  centerY: LOGO_CENTER_Y_PX / DESIGN_HEIGHT,
  /** Logo top edge Y (normalized). */
  topY: LOGO_TOP_PX / DESIGN_HEIGHT,
  /** Logo bottom edge Y (normalized). */
  bottomY: LOGO_BOTTOM_PX / DESIGN_HEIGHT,
  /** Logo left edge X (normalized). */
  leftX: (DESIGN_WIDTH / 2 - LOGO_SIZE / 2) / DESIGN_WIDTH,
  /** Logo right edge X (normalized). */
  rightX: (DESIGN_WIDTH / 2 + LOGO_SIZE / 2) / DESIGN_WIDTH,
} as const;

/**
 * Lily "behind the logo" (left side): start above logo, left of logo.
 * Peek position: just below logo top, same X, so she visibly emerges from behind the logo.
 */
export const LILY_BEHIND_LOGO = {
  /** Hidden: above logo top, left of logo. */
  hidden: {
    x: LOGO_REGION.leftX - 0.06,
    y: LOGO_REGION.topY - 0.05,
  },
  /** Peeking: just below logo top, left of logo center. */
  peek: {
    x: LOGO_REGION.leftX - 0.02,
    y: LOGO_REGION.topY + 0.03,
  },
} as const;
