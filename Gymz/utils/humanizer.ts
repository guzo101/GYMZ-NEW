/**
 * Humanizer utility to clean up robotic AI strings for the Gymz UI.
 */
export const humanizeGoal = (goalStr: string): string => {
    if (!goalStr) return "your fitness journey";

    // Check if it's the robotic "Muscle: Xkg, Endurance: Ymin" format
    const muscleMatch = goalStr.match(/Muscle:\s*(\d+)kg/i);
    const enduranceMatch = goalStr.match(/Endurance:\s*(\d+)min/i);

    if (muscleMatch && enduranceMatch) {
        return `building ${muscleMatch[1]}kg of muscle and improving endurance`;
    }

    if (muscleMatch) return `adding ${muscleMatch[1]}kg of muscle`;
    if (enduranceMatch) return `improving your endurance by ${enduranceMatch[1]} mins`;

    // Generic cleanup
    return goalStr
        .replace(/Joined with goal:/i, '')
        .replace(/Focused on goal:/i, '')
        .trim()
        .toLowerCase();
};

export const humanizePersonality = (personality: string): string => {
    const map: Record<string, string> = {
        'Determined': 'determined athlete',
        'Athlete': 'athlete',
        'Encouraging': 'teammate',
        'Direct': 'dedicated fighter',
    };
    return map[personality] || personality.toLowerCase();
};

export const humanizeStreak = (days: number): string => {
    if (days === 0) return "your very first day";
    if (days === 1) return "Day 1";
    return `${days} days in a row`;
};
