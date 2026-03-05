-- Final Audit: Verify Medical-Grade Calculations are Live & Accurate
SELECT 
    u.email,
    u.calculated_bmi as bmi,
    u.scientific_weight_basis as basis,
    u.calculated_bmr as bmr,
    u.calculated_tdee as tdee,
    g.goal_type,
    g.daily_calorie_goal as cal_goal,
    g.daily_protein_goal as pro_g,
    g.daily_carbs_goal as carb_g,
    g.daily_fats_goal as fat_g
FROM public.users u
LEFT JOIN public.user_fitness_goals g ON u.id = g.user_id AND g.is_active = true
WHERE u.weight IS NOT NULL
ORDER BY u.updated_at DESC
LIMIT 5;
