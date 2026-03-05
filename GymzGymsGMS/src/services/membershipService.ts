import { supabase } from "@/integrations/supabase/client";
import { subDays } from "date-fns";

/**
 * Membership Service
 * Centralizes logic for membership status management and deactivation.
 */

export async function sanitizeMembershipStatuses() {
    const now = new Date();
    const nowIso = now.toISOString();

    console.log("🔄 Starting membership status sanitization...");

    try {
        // 1. Standard cleanup for those with explicit expiry dates
        const { error: cleanup1, count: count1 } = await supabase
            .from("users")
            .update({
                membership_status: "Inactive",
                status: "Active" // Maintain login ability
            })
            .eq("role", "member")
            .eq("membership_status", "Active")
            .not("renewal_due_date", "is", null)
            .lt("renewal_due_date", nowIso);

        if (cleanup1) console.error("Standard cleanup failed:", cleanup1);
        else if (count1) console.log(`✓ Deactivated ${count1} members with expired dates.`);

        // 2. Fallback cleanup for members with NULL expiry dates
        const thirtyDaysAgo = subDays(now, 31).toISOString();
        const oneDayAgo = subDays(now, 1).toISOString();

        // Day Pass fallback cleanup: anyone who joined before today is now Inactive
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const { count: count2 } = await supabase
            .from("users")
            .update({
                membership_status: "Inactive",
                status: "Active" // Maintain login ability
            })
            .eq("role", "member")
            .eq("membership_status", "Active")
            .is("renewal_due_date", null)
            .or(`membership_type.ilike.%day%,membership_plan.ilike.%day%`)
            .lt("created_at", startOfToday);

        if (count2) console.log(`✓ Deactivated ${count2} members with missing dates (Day Pass fallback).`);

        // Standard plan fallback cleanup
        const { count: count3 } = await supabase
            .from("users")
            .update({
                membership_status: "Inactive",
                status: "Active" // Maintain login ability
            })
            .eq("role", "member")
            .eq("membership_status", "Active")
            .is("renewal_due_date", null)
            .not("membership_type", "ilike", "%day%")
            .not("membership_plan", "ilike", "%day%")
            .lt("created_at", thirtyDaysAgo);

        if (count3) console.log(`✓ Deactivated ${count3} members with missing dates (Standard fallback).`);

        console.log("✅ Membership sanitization completed.");
    } catch (e) {
        console.error("Critical error in membership sanitization:", e);
    }
}

/**
 * Validates if a member status SHOULD be active based on dates.
 * Used to prevent accidental reactivations.
 */
export function isMembershipValid(expiryDate: string | null, joinDate: string | null, type: string | null): boolean {
    const now = new Date();

    if (expiryDate) {
        return new Date(expiryDate) >= now;
    }

    // Fallback for missing dates
    if (!joinDate) return false;

    const jDate = new Date(joinDate);
    const typeLower = (type || "").toLowerCase();

    if (typeLower.includes("day")) {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return jDate >= startOfToday;
    }

    // Default 30 days
    return (now.getTime() - jDate.getTime()) < (30 * 24 * 60 * 60 * 1000);
}
