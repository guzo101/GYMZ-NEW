export type OfferHighlight = {
  title: string;
  description: string;
  priceLabel: string;
  ctaLabel: string;
  perks: string[];
};

export type FacilityHighlight = {
  name: string;
  detail: string;
  icon: string;
};

export type CommunityMetric = {
  label: string;
  value: string;
  helper: string;
};

export type Testimonial = {
  name: string;
  role: string;
  quote: string;
};

export const offerHighlights: OfferHighlight[] = [
  {
    title: "Single location",
    description: "Launch at one gym with core operations.",
    priceLabel: "Scope on call",
    ctaLabel: "Book demo",
    perks: ["Core setup", "Owner/coach/member workflows", "Go-live support"],
  },
  {
    title: "Growing operator",
    description: "Scale operations without adding chaos.",
    priceLabel: "Scope on call",
    ctaLabel: "Book demo",
    perks: ["Team onboarding", "Useful reporting", "Phased rollout"],
  },
  {
    title: "Multiple branches",
    description: "One view across all locations.",
    priceLabel: "Scope on call",
    ctaLabel: "Book demo",
    perks: ["Multi-site configuration", "Central oversight", "Branch-by-branch deployment"],
  },
  {
    title: "Connected equipment",
    description: "Optional machine data where compatible.",
    priceLabel: "Site-dependent",
    ctaLabel: "Book demo",
    perks: ["Compatibility check", "Retrofit planning", "Data your coaches can use"],
  },
  {
    title: "Larger chains",
    description: "Custom rollout for larger operators.",
    priceLabel: "Custom",
    ctaLabel: "Book demo",
    perks: ["Tailored implementation", "Priority support", "Account planning"],
  },
];

export const facilityHighlights: FacilityHighlight[] = [
  { name: "Strength Floor", detail: "Racks, platforms and heavy dumbbells for real strength work.", icon: "Dumbbell" },
  { name: "Conditioning Zone", detail: "Sleds, bikes and rowers built for hard finishers.", icon: "Sparkles" },
  { name: "Work & Recharge", detail: "Wi‑Fi, coffee bar and space to plug in between sets.", icon: "Monitor" },
  { name: "Outdoor Sessions", detail: "Bootcamps and runs when the weather’s right.", icon: "Sun" },
];

export const communityMetrics: CommunityMetric[] = [
  { label: "Payments & renewals", value: "One place", helper: "see who is current" },
  { label: "Attendance", value: "Visible", helper: "spot drop-off early" },
  { label: "At-risk members", value: "Earlier", helper: "act sooner" },
  { label: "Nutrition support", value: "Your brand", helper: "inside your ecosystem" },
];

/** Value pillars (not customer testimonials—replace with verified quotes when available). */
export const testimonials: Testimonial[] = [
  {
    name: "Owner",
    role: "Revenue & clarity",
    quote: "Know who is paid, active, and at risk in one view.",
  },
  {
    name: "Coach",
    role: "Time & delivery",
    quote: "Less admin, more coaching time.",
  },
  {
    name: "Member",
    role: "Daily habit",
    quote: "Guidance tied to the gym they joined.",
  },
];

export const contactChannels = [
  {
    label: "Website",
    detail: "gymzandnutrition.com",
    helper: "Official site",
  },
  {
    label: "Call",
    detail: "+260 960 613 290",
    helper: "Quick response",
  },
  {
    label: "Email",
    detail: "support@gymzandnutrition.com",
    helper: "Reply within a few minutes",
  },
];

