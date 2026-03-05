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
    title: "Day Pass",
    description: "Perfect for travelers or those who want to try us out with no commitment.",
    priceLabel: "Configured per gym",
    ctaLabel: "Get a pass",
    perks: ["Full gym access", "Locker access", "No signup fees"],
  },
  {
    title: "Basic Membership",
    description: "All-access training for individuals looking for a consistent routine and results.",
    priceLabel: "Configured per gym",
    ctaLabel: "Get started",
    perks: ["Unlimited gym access", "Standard equipment", "Basic tracking"],
  },
  {
    title: "Couple Membership",
    description: "Train together and stay motivated with our discounted partner plan.",
    priceLabel: "Configured per gym",
    ctaLabel: "Join as a couple",
    perks: ["Access for 2 people", "Unlimited classes", "1 Guest pass / month"],
  },
  {
    title: "Family Membership",
    description: "The ultimate fitness plan for the whole family (up to 5 members).",
    priceLabel: "Configured per gym",
    ctaLabel: "Register family",
    perks: ["Access for 5 members", "Family dashboard", "Priority booking"],
  },
  {
    title: "Corporate Plans",
    description: "Tailored packages for teams that want healthier staff and better energy.",
    priceLabel: "Custom",
    ctaLabel: "Book a walkthrough",
    perks: ["Flexible group rates", "Onboarding support", "Usage reports"],
  },
];

export const facilityHighlights: FacilityHighlight[] = [
  { name: "Strength Floor", detail: "Racks, platforms and heavy dumbbells for real strength work.", icon: "Dumbbell" },
  { name: "Conditioning Zone", detail: "Sleds, bikes and rowers built for hard finishers.", icon: "Sparkles" },
  { name: "Work & Recharge", detail: "Wi‑Fi, coffee bar and space to plug in between sets.", icon: "Monitor" },
  { name: "Outdoor Sessions", detail: "Bootcamps and runs when the weather’s right.", icon: "Sun" },
];

export const communityMetrics: CommunityMetric[] = [
  { label: "Average Member Stay", value: "18+ mo", helper: "members that actually stick" },
  { label: "Sessions / Month", value: "12.4", helper: "per active member" },
  { label: "Coach Ratio", value: "1:8", helper: "you won’t get lost in the crowd" },
  { label: "Check‑In Time", value: "< 60s", helper: "front desk system, no chaos" },
];

export const testimonials: Testimonial[] = [
  {
    name: "Mwaba",
    role: "Member",
    quote: "I dropped 9kg in 12 weeks and actually know what to do when I walk in.",
  },
  {
    name: "Thandi",
    role: "Busy professional",
    quote: "The plan is simple, the sessions are hard, and I’m in and out in under an hour.",
  },
  {
    name: "Zuri Health",
    role: "Corporate partner",
    quote: "Our team shows up more, complains less and the reports are clear.",
  },
];

export const contactChannels = [
  {
    label: "Visit",
    detail: "Plot 21, Acacia Park, Lusaka",
    helper: "Open daily • 5am – 10pm",
  },
  {
    label: "Call",
    detail: "+260 97 000 0000",
    helper: "Front desk replies fast",
  },
  {
    label: "Email",
    detail: "support.gymz@gmail.com",
    helper: "Replies within 1 business hour",
  },
];

