import { supabase } from './supabase';
import { DataMapper } from '../utils/dataMapper';

export const PLATFORM_BENEFITS = [
    'Full gym access',
    'Coach feature',
    'Food scanner',
    'Full equipment access',
    'Nutrition tracker',
];

export type GymPricingPlan = {
    id: string;
    planName: string;
    planType: string;
    price: number;
    currency: string;
    durationDays: number | null;
    accessModeScope: 'gym_access' | 'event_access' | 'both';
    gymInclusions: string[];
};

export type AccessModeScope = 'gym_access' | 'event_access';

const resolveAccessModeScope = (raw: unknown): 'gym_access' | 'event_access' | 'both' => {
    if (raw === 'event_access' || raw === 'both') return raw;
    return 'gym_access';
};

const isPlanVisibleForPath = (
    planScope: 'gym_access' | 'event_access' | 'both',
    selectedPath?: AccessModeScope | null
) => {
    if (!selectedPath) return false;
    return planScope === 'both' || planScope === selectedPath;
};

const toPositiveNumber = (value: unknown): number | null => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const planTypeLabel = (planType?: string) => {
    switch (planType) {
        case 'daily':
            return 'Daily';
        case 'weekly':
            return 'Weekly';
        case 'monthly':
            return 'Monthly';
        case '3_months':
            return '3 Months';
        case '6_months':
            return '6 Months';
        case 'annual':
            return 'Annual';
        default:
            return 'Plan';
    }
};

export const buildGymInclusions = (rawPlan: any): string[] => {
    const custom = Array.isArray(rawPlan.customInclusions)
        ? rawPlan.customInclusions.map((v: unknown) => String(v).trim()).filter(Boolean)
        : [];

    const derived = [
        rawPlan.includesClasses ? 'Classes included' : null,
        rawPlan.includesTrainer ? 'Trainer included' : null,
        rawPlan.accessHoursNote ? String(rawPlan.accessHoursNote).trim() : null,
    ].filter(Boolean) as string[];

    return [...derived, ...custom];
};

export const fetchGymPricingPlans = async (
    gymId?: string | null,
    selectedPath?: AccessModeScope | null
): Promise<GymPricingPlan[]> => {
    if (!gymId) {
        console.warn('[PricingPlans] No gymId provided — cannot fetch plans');
        return [];
    }

    const { data, error } = await (supabase as any)
        .from('gym_membership_plans')
        .select('*')
        .eq('gym_id', gymId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

    if (error) {
        console.error('[PricingPlans] Fetch error:', error?.message || error, { gymId, selectedPath });
        return [];
    }

    const raw = data || [];
    const mapped = DataMapper.fromDb<any[]>(raw);
    const filtered = mapped
        .map((plan: any) => {
            const price = toPositiveNumber(plan.price);
            const name = String(plan.planName || plan.plan_name || '').trim();
            if (!price || !name) return null;
            const accessModeScope = resolveAccessModeScope(plan.accessModeScope ?? plan.access_mode_scope);
            if (!isPlanVisibleForPath(accessModeScope, selectedPath)) return null;

            return {
                id: String(plan.id),
                planName: name,
                planType: String(plan.planType || plan.plan_type || 'custom'),
                price,
                currency: String(plan.currency || 'ZMW'),
                durationDays: plan.durationDays ?? plan.duration_days ? Number(plan.durationDays ?? plan.duration_days) : null,
                accessModeScope,
                gymInclusions: buildGymInclusions(plan),
            } as GymPricingPlan;
        })
        .filter(Boolean) as GymPricingPlan[];

    if (raw.length > 0 && filtered.length === 0) {
        console.warn('[PricingPlans] Plans filtered out:', {
            gymId,
            selectedPath,
            rawCount: raw.length,
            rawScopes: raw.map((p: any) => p.access_mode_scope ?? p.accessModeScope),
        });
    }
    return filtered;
};

export const getPlanSubtitle = (plan: GymPricingPlan): string => {
    if (plan.durationDays && plan.durationDays > 0) {
        return `${plan.durationDays} day${plan.durationDays === 1 ? '' : 's'}`;
    }
    return planTypeLabel(plan.planType);
};

export const getMonthsFromPlan = (plan: GymPricingPlan): number => {
    if (plan.planType === 'daily' || plan.durationDays === 1) return 0.033;
    if (plan.durationDays && plan.durationDays > 0) {
        return Number((plan.durationDays / 30).toFixed(3));
    }
    return 1;
};
