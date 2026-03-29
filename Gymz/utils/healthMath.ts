/**
 * Health Mathematics Utility
 * Provides scientifically grounded formulas for health metrics.
 */

/**
 * Calculates BMI (Body Mass Index)
 * Formula: weight (kg) / [height (m)]^2
 */
export const calculateBMI = (weightKg: number, heightCm: number): number | null => {
    const w = Number(weightKg);
    const h = Number(heightCm);
    if (!w || !h || h <= 0 || isNaN(w) || isNaN(h)) return null;
    const heightM = h / 100;
    return Math.round((w / (heightM * heightM)) * 10) / 10;
};

/**
 * Returns BMI Category based on WHO standards
 */
export const getBMICategory = (bmi: number): string => {
    const b = Number(bmi);
    if (isNaN(b) || b <= 0) return 'Unknown';
    if (b < 18.5) return 'Underweight';
    if (b < 25) return 'Normal';
    if (b < 30) return 'Overweight';
    return 'Obese';
};

/**
 * MET (Metabolic Equivalent of Task) values for common intensities
 */
export const MET_VALUES = {
    LOW: 3.5,      // Walking, light stretching
    MODERATE: 6.0, // Brisk walking, light cycling, steady cardio
    HIGH: 8.5,     // Running, heavy lifting, HIIT
    EXTREME: 11.0  // Sprinting, competitive sports
};

/**
 * Calculates Calorie Burn using MET formula
 * Formula: Calories = MET * weight (kg) * (duration_minutes / 60)
 */
export const calculateCalorieBurn = (
    intensity: keyof typeof MET_VALUES = 'MODERATE',
    weightKg: number = 0,
    durationMinutes: number = 0
): number => {
    const met = MET_VALUES[intensity] || MET_VALUES.MODERATE;
    const w = Number(weightKg);
    const d = Number(durationMinutes);
    if (!w || !d) return 0;
    const hours = d / 60;
    const result = Math.round(met * w * hours);
    return isNaN(result) ? 0 : result;
};

/**
 * Calculates BMR (Basal Metabolic Rate) using Mifflin-St Jeor Equation
 */
export const calculateBMR = (
    weightKg: number,
    heightCm: number,
    age: number,
    gender: 'male' | 'female'
): number => {
    const w = Number(weightKg);
    const h = Number(heightCm);
    const a = Number(age);
    if (!w || !h || !a) return 0;
    const g = gender === 'female' ? 'female' : 'male';

    // Mifflin-St Jeor Formula
    const base = (10 * w) + (6.25 * h) - (5 * a);
    const result = g === 'male' ? base + 5 : base - 161;
    return isNaN(result) ? 0 : result;
};

/**
 * Activity Multipliers for TDEE (Total Daily Energy Expenditure)
 */
export const ACTIVITY_MULTIPLIERS = {
    SEDENTARY: 1.2,          // Little or no exercise
    LIGHTLY_ACTIVE: 1.375,   // Light exercise 1-3 days/week
    MODERATELY_ACTIVE: 1.55, // Moderate exercise 3-5 days/week
    VERY_ACTIVE: 1.725,      // Hard exercise 6-7 days/week
    EXTREMELY_ACTIVE: 1.9    // Very hard exercise/physical job
};

/**
 * Calculates TDEE based on BMR and Activity Level
 */
export const calculateTDEE = (bmr: number, activityLevel: keyof typeof ACTIVITY_MULTIPLIERS = 'MODERATELY_ACTIVE'): number => {
    const b = Number(bmr);
    if (!b) return 0;
    const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] || ACTIVITY_MULTIPLIERS.MODERATELY_ACTIVE;
    const result = Math.round(b * multiplier);
    return isNaN(result) ? 0 : result;
};

/**
 * Calculates Macro Split based on Goal and Calories
 */
export const calculateMacroSplit = (
    calories: number,
    goalId: string,
    weightKg: number
): { protein: number; carbs: number; fat: number } => {
    const cal = Number(calories);
    const w = Number(weightKg);
    if (!cal || !w) return { protein: 0, carbs: 0, fat: 0 };

    let proteinPct = 0.3;
    let fatPct = 0.25;
    let carbsPct = 0.45;

    // Adjust based on goal (Canonicalized IDs)
    if (goalId === 'build_muscle' || goalId === 'muscle_gain') {
        proteinPct = 0.35;
        carbsPct = 0.45;
        fatPct = 0.20;
    } else if (goalId === 'lose_weight' || goalId === 'weight_loss') {
        proteinPct = 0.40;
        carbsPct = 0.35;
        fatPct = 0.25;
    } else if (goalId === 'endurance') {
        proteinPct = 0.20;
        carbsPct = 0.60;
        fatPct = 0.20;
    }

    const protein = Math.round((cal * proteinPct) / 4);
    const carbs = Math.round((cal * carbsPct) / 4);
    const fat = Math.round((cal * fatPct) / 9);

    return {
        protein: isNaN(protein) ? 0 : protein,
        carbs: isNaN(carbs) ? 0 : carbs,
        fat: isNaN(fat) ? 0 : fat
    };
};

/**
 * Standardizes Fitness Goal Inputs for App-Wide Consistency
 */
export const canonicalizeGoal = (goalStr: string): 'build_muscle' | 'lose_weight' | 'recomp' | 'endurance' => {
    if (!goalStr) return 'recomp';
    const cleaned = goalStr.toLowerCase().trim();

    // Match common keywords robustly
    if (cleaned.includes('muscle') || cleaned.includes('build') || cleaned.includes('bulk')) return 'build_muscle';
    if (cleaned.includes('lose') || cleaned.includes('weight') || cleaned.includes('cut')) return 'lose_weight';
    if (cleaned.includes('toning') || cleaned.includes('recomp') || cleaned.includes('maintain')) return 'recomp';
    if (cleaned.includes('endurance') || cleaned.includes('run') || cleaned.includes('cardio')) return 'endurance';

    // Default Fallback
    return 'recomp';
};
