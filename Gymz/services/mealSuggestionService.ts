import { FOOD_DATABASE, FoodItem, UserGoal } from './foodDatabase';

// Re-exporting for compatibility, though we use FoodItem internally now
export type MealSuggestion = FoodItem;
export type { UserGoal };

export interface SuggestionFilters {
    remainingCalories: number;
    remainingProtein: number;
    remainingCarbs: number;
    remainingFats: number;
    mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'any';
    prioritizeProtein?: boolean;
    userGoal?: UserGoal;
}

export const mealSuggestionService = {
    /**
     * Get meal suggestions based on remaining macro targets and user goal
     */
    getSuggestions(filters: SuggestionFilters): MealSuggestion[] {
        const {
            remainingCalories,
            remainingProtein,
            mealType = 'any',
            prioritizeProtein = true,
            userGoal = 'recomp'
        } = filters;

        // 1. Filter candidates
        let candidates = FOOD_DATABASE.filter(meal => {
            // Must generally fit calories (looser buffer for bulking)
            const calorieBuffer = userGoal === 'build_muscle' ? 1.4 : 1.15;
            if (meal.calories > Math.max(remainingCalories * calorieBuffer, 200)) return false;

            // Strict meal type check
            if (mealType !== 'any' && meal.mealType !== mealType) return false;

            return true;
        });

        // Fallback: If no meals fit, try snacks
        if (candidates.length === 0) {
            candidates = FOOD_DATABASE.filter(m =>
                m.mealType === 'snack' &&
                m.calories <= Math.max(remainingCalories * 1.5, 300)
            );
        }

        // 2. Score candidates
        const scored = candidates.map(meal => {
            let score = 0;

            // A. Goal Alignment (Big Impact)
            if (meal.goalSuitability.includes(userGoal)) {
                score += 50;
            } else if (meal.goalSuitability.includes('recomp')) {
                score += 20; // Safe fallback
            }

            // B. Protein Efficiency (Protein per Calorie)
            const proteinEfficiency = meal.protein / Math.max(meal.calories, 1);
            score += proteinEfficiency * 150; // Weighted heavily

            // C. Macro Fit Bonus
            if (remainingProtein > 0 && meal.protein >= remainingProtein * 0.4) {
                score += 30;
            }

            // D. Zambian Bias
            if (meal.isZambian) {
                score += 15;
            }

            // E. Penalty for blowing budget too hard
            if (meal.calories > remainingCalories && remainingCalories > 0) {
                const overage = meal.calories - remainingCalories;
                score -= (overage / remainingCalories) * 50;
            }

            return { meal, score };
        });

        // 3. Sort and Return
        scored.sort((a, b) => b.score - a.score);
        const topResults = scored.slice(0, 80).map(s => s.meal);
        return topResults;
    },

    /**
     * Get quick protein suggestions when behind on protein
     */
    getProteinRescueMeals(proteinDeficit: number): MealSuggestion[] {
        return FOOD_DATABASE
            .filter(m => m.mealType === 'snack' && m.protein >= 15)
            .sort((a, b) => b.protein - a.protein)
            .slice(0, 4);
    },

    /**
     * Get contextual meal suggestion based on time of day
     */
    getTimeSensitiveSuggestion(remainingProtein: number): MealSuggestion | null {
        const hour = new Date().getHours();

        let mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
        if (hour < 10) mealType = 'breakfast';
        else if (hour < 14) mealType = 'lunch';
        else if (hour < 18) mealType = 'snack';
        else mealType = 'dinner';

        const candidates = FOOD_DATABASE
            .filter(m => m.mealType === mealType && m.protein >= 20)
            .sort((a, b) => b.protein - a.protein);

        return candidates[0] || null;
    },

    /**
     * Get all meals in database (for browsing)
     */
    getAllMeals(): MealSuggestion[] {
        return FOOD_DATABASE;
    },

    /**
     * Search meals by name or tag
     */
    searchMeals(query: string): MealSuggestion[] {
        const lowerQuery = query.toLowerCase();
        return FOOD_DATABASE.filter(m =>
            m.name.toLowerCase().includes(lowerQuery) ||
            m.tags.some(t => t.includes(lowerQuery))
        );
    }
};
