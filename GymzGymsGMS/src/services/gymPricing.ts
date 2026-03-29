import { supabase } from "@/integrations/supabase/client";

export type GymPlan = {
  id: string;
  planName: string;
  price: number;
  currency: string;
  durationLabel: string;
  accessModeScope: "gym_access" | "event_access" | "both";
  gymInclusions: string[];
};

export type AccessModeScope = "gym_access" | "event_access";

export const PLATFORM_BENEFITS = [
  "Full gym access",
  "Coach feature",
  "Food scanner",
  "Full equipment access",
  "Nutrition tracker",
];

const getDurationLabel = (planType?: string, durationDays?: number | null) => {
  if (durationDays && durationDays > 0) {
    return `${durationDays} day${durationDays === 1 ? "" : "s"}`;
  }
  switch (planType) {
    case "daily":
      return "1 Day";
    case "weekly":
      return "1 Week";
    case "monthly":
      return "1 Month";
    case "3_months":
      return "3 Months";
    case "6_months":
      return "6 Months";
    case "annual":
      return "12 Months";
    default:
      return "Custom";
  }
};

export const getMonthsFromPlan = (plan: { planType?: string; durationDays?: number | null }) => {
  if (plan.planType === "daily" || plan.durationDays === 1) return 0.033;
  if (plan.durationDays && plan.durationDays > 0) return Number((plan.durationDays / 30).toFixed(3));
  return 1;
};

const buildInclusions = (raw: any): string[] => {
  const custom = Array.isArray(raw.custom_inclusions)
    ? raw.custom_inclusions.map((v: unknown) => String(v).trim()).filter(Boolean)
    : [];

  const derived = [
    raw.includes_classes ? "Classes included" : null,
    raw.includes_trainer ? "Trainer included" : null,
    raw.access_hours_note ? String(raw.access_hours_note).trim() : null,
  ].filter(Boolean) as string[];

  return [...derived, ...custom];
};

const resolveAccessModeScope = (raw: unknown): "gym_access" | "event_access" | "both" => {
  if (raw === "event_access" || raw === "both") return raw;
  return "gym_access";
};

const isPlanVisibleForPath = (
  planScope: "gym_access" | "event_access" | "both",
  selectedPath?: AccessModeScope | null
) => {
  if (!selectedPath) return true;
  return planScope === "both" || planScope === selectedPath;
};

export async function fetchGymPlans(
  gymId?: string | null,
  selectedPath?: AccessModeScope | null
): Promise<GymPlan[]> {
  if (!gymId) return [];

  const { data, error } = await (supabase as any)
    .from("gym_membership_plans")
    .select("*")
    .eq("gym_id", gymId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[GymPricing] Failed to fetch gym plans:", error);
    return [];
  }

  return (data || [])
    .map((row: any) => {
      const price = Number(row.price);
      const name = String(row.plan_name || "").trim();
      if (!name || !Number.isFinite(price) || price <= 0) return null;
      const accessModeScope = resolveAccessModeScope(row.access_mode_scope);
      if (!isPlanVisibleForPath(accessModeScope, selectedPath)) return null;
      return {
        id: row.id,
        planName: name,
        price,
        currency: row.currency || "ZMW",
        durationLabel: getDurationLabel(row.plan_type, row.duration_days),
        accessModeScope,
        gymInclusions: buildInclusions(row),
      } as GymPlan;
    })
    .filter(Boolean) as GymPlan[];
}
