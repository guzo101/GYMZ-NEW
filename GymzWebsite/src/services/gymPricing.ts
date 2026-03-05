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

const durationLabel = (planType?: string, durationDays?: number | null) => {
  if (durationDays && durationDays > 0) return `${durationDays} day${durationDays === 1 ? "" : "s"}`;
  if (planType === "daily") return "1 Day";
  if (planType === "weekly") return "1 Week";
  if (planType === "monthly") return "1 Month";
  if (planType === "3_months") return "3 Months";
  if (planType === "6_months") return "6 Months";
  if (planType === "annual") return "12 Months";
  return "Custom";
};

const resolveAccessModeScope = (raw: unknown): "gym_access" | "event_access" | "both" => {
  if (raw === "event_access" || raw === "both") return raw;
  return "gym_access";
};

const isPlanVisibleForPath = (
  planScope: "gym_access" | "event_access" | "both",
  selectedPath?: AccessModeScope | null
) => {
  if (!selectedPath) return false;
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
    console.error("[WebsitePricing] Failed to fetch plans:", error);
    return [];
  }

  return (data || [])
    .map((row: any) => {
      const price = Number(row.price);
      const planName = String(row.plan_name || "").trim();
      if (!planName || !Number.isFinite(price) || price <= 0) return null;
      const accessModeScope = resolveAccessModeScope(row.access_mode_scope);
      if (!isPlanVisibleForPath(accessModeScope, selectedPath)) return null;
      const gymInclusions = [
        row.includes_classes ? "Classes included" : null,
        row.includes_trainer ? "Trainer included" : null,
        row.access_hours_note ? String(row.access_hours_note).trim() : null,
        ...(Array.isArray(row.custom_inclusions) ? row.custom_inclusions.map((v: unknown) => String(v).trim()).filter(Boolean) : []),
      ].filter(Boolean) as string[];
      return {
        id: row.id,
        planName,
        price,
        currency: row.currency || "ZMW",
        durationLabel: durationLabel(row.plan_type, row.duration_days),
        accessModeScope,
        gymInclusions,
      } as GymPlan;
    })
    .filter(Boolean) as GymPlan[];
}
