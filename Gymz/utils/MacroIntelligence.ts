
export interface MacroData {
    protein: number;
    carbs: number;
    fats: number;
    calories: number;
}

export interface MacroGoals {
    protein: number;
    carbs: number;
    fats: number;
    calories: number;
}

export type Momentum = 'Weak' | 'Controlled' | 'Escalating' | 'Stable';
export type MacroStatus = 'On Track' | 'Under Protein' | 'Carb Heavy' | 'Fat Overshoot' | 'Balanced' | 'Falling Behind';

export interface IntelligenceLayer {
    status: MacroStatus;
    summary: {
        protein: { goal: number; actual: number; direction: 'Rising' | 'Flat' | 'Falling' };
        carbs: { goal: number; actual: number; direction: 'Rising' | 'Flat' | 'Falling' };
        fats: { goal: number; actual: number; direction: 'Rising' | 'Flat' | 'Falling' };
    };
    momentum: {
        protein: Momentum;
        carbs: Momentum;
        fats: Momentum;
    };
    recommendation: string;
}

export class MacroIntelligence {
    /**
     * Determines the primary status based on actual vs goals
     */
    static calculateStatus(actual: MacroData, goals: MacroGoals): MacroStatus {
        const pRatio = actual.protein / (goals.protein || 1);
        const cRatio = actual.carbs / (goals.carbs || 1);
        const fRatio = actual.fats / (goals.fats || 1);

        if (pRatio < 0.8) return 'Under Protein';
        if (cRatio > 1.2) return 'Carb Heavy';
        if (fRatio > 1.2) return 'Fat Overshoot';
        if (pRatio >= 0.9 && cRatio <= 1.1 && fRatio <= 1.1) return 'Balanced';
        if (pRatio >= 0.8) return 'On Track';

        return 'Falling Behind';
    }

    /**
     * Calculates momentum based on 7-day slope
     * A simple linear regression slope would be ideal, but we'll use start vs end for now
     */
    static calculateMomentum(history: MacroData[]): Momentum {
        if (history.length < 3) return 'Stable';

        const first = history[0];
        const last = history[history.length - 1];

        // Use average of first 3 and last 3 for stability if enough data
        const startAvg = history.slice(0, 3).reduce((acc, curr) => acc + curr.protein + curr.carbs + curr.fats, 0) / 3;
        const endAvg = history.slice(-3).reduce((acc, curr) => acc + curr.protein + curr.carbs + curr.fats, 0) / 3;

        const diff = (endAvg - startAvg) / startAvg;

        if (diff > 0.1) return 'Escalating';
        if (diff < -0.1) return 'Weak';
        return 'Controlled';
    }

    static getSpecificMomentum(history: number[]): Momentum {
        if (history.length < 3) return 'Stable';
        const start = history.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
        const end = history.slice(-3).reduce((a, b) => a + b, 0) / 3;
        const diff = (end - start) / (start || 1);

        if (diff > 0.1) return 'Escalating';
        if (diff < -0.1) return 'Weak';
        return 'Controlled';
    }

    static getDirection(history: number[]): 'Rising' | 'Flat' | 'Falling' {
        if (history.length < 2) return 'Flat';
        const last = history[history.length - 1];
        const prev = history[history.length - 2];

        if (last > prev * 1.05) return 'Rising';
        if (last < prev * 0.95) return 'Falling';
        return 'Flat';
    }

    /**
     * Generates a punchy recommendation
     */
    static generateRecommendation(status: MacroStatus, actual: MacroData, goals: MacroGoals): string {
        switch (status) {
            case 'Under Protein':
                return 'Increase protein intake slightly to close gap';
            case 'Carb Heavy':
                return 'Carbs trending above goal, monitor next 3 days';
            case 'Fat Overshoot':
                return 'Fat intake is high; prioritize leaner sources';
            case 'Balanced':
                return 'Perfect alignment. Maintain current intake.';
            case 'On Track':
                return 'On track. Keep following the plan.';
            case 'Falling Behind':
                return 'Consistency is slipping. Reset your focus today.';
            default:
                return 'Stay consistent with your logging.';
        }
    }

    /**
     * Maps behavior labels
     */
    static getBehaviorLabel(range: string): string {
        switch (range) {
            case 'week': return 'Recent Behavior';
            case 'month': return 'Consistency Window';
            default: return 'Long-Term Pattern';
        }
    }
}
