-- =====================================================
-- SAMPLE DATA FOR TESTING PROGRESS FEATURES
-- Run this after creating the main tables
-- =====================================================

-- Note: Replace 'YOUR_USER_ID_HERE' with actual user ID from auth.users

-- =====================================================
-- SAMPLE BODY METRICS (Weight tracking over 3 months)
-- =====================================================

-- Sample weight entries showing gradual progress
INSERT INTO public.body_metrics (user_id, date, weight, body_fat_percentage, notes) VALUES
-- Replace with your user ID
('YOUR_USER_ID_HERE', CURRENT_DATE - INTERVAL '90 days', 85.0, 25.0, 'Starting weight'),
('YOUR_USER_ID_HERE', CURRENT_DATE - INTERVAL '83 days', 84.5, 24.8, NULL),
('YOUR_USER_ID_HERE', CURRENT_DATE - INTERVAL '76 days', 84.2, 24.5, NULL),
('YOUR_USER_ID_HERE', CURRENT_DATE - INTERVAL '69 days', 83.8, 24.3, NULL),
('YOUR_USER_ID_HERE', CURRENT_DATE - INTERVAL '62 days', 83.3, 24.0, NULL),
('YOUR_USER_ID_HERE', CURRENT_DATE - INTERVAL '55 days', 82.9, 23.8, 'Feeling good!'),
('YOUR_USER_ID_HERE', CURRENT_DATE - INTERVAL '48 days', 82.5, 23.5, NULL),
('YOUR_USER_ID_HERE', CURRENT_DATE - INTERVAL '41 days', 82.0, 23.2, NULL),
('YOUR_USER_ID_HERE', CURRENT_DATE - INTERVAL '34 days', 81.6, 23.0, NULL),
('YOUR_USER_ID_HERE', CURRENT_DATE - INTERVAL '27 days', 81.2, 22.7, NULL),
('YOUR_USER_ID_HERE', CURRENT_DATE - INTERVAL '20 days', 80.8, 22.5, NULL),
('YOUR_USER_ID_HERE', CURRENT_DATE - INTERVAL '13 days', 80.4, 22.2, NULL),
('YOUR_USER_ID_HERE', CURRENT_DATE - INTERVAL '6 days', 80.0, 22.0, 'Almost there!'),
('YOUR_USER_ID_HERE', CURRENT_DATE, 79.5, 21.8, 'New personal best!')
ON CONFLICT (user_id, date) DO NOTHING;

-- =====================================================
-- SAMPLE FITNESS GOAL
-- =====================================================

INSERT INTO public.user_fitness_goals (
  user_id, 
  goal_type, 
  target_weight, 
  target_body_fat,
  target_date,
  starting_weight,
  starting_body_fat,
  starting_date,
  weekly_workout_goal,
  daily_calorie_goal,
  daily_protein_goal,
  daily_carbs_goal,
  daily_fats_goal,
  is_active
) VALUES (
  'YOUR_USER_ID_HERE',
  'weight_loss',
  75.0,
  18.0,
  CURRENT_DATE + INTERVAL '60 days',
  85.0,
  25.0,
  CURRENT_DATE - INTERVAL '90 days',
  4,
  2000,
  150,
  200,
  65,
  true
) ON CONFLICT DO NOTHING;

-- =====================================================
-- SAMPLE DAILY CALORIE SUMMARIES (Last 7 days)
-- =====================================================

INSERT INTO public.daily_calorie_summary (
  user_id, date, total_calories, total_protein, total_carbs, total_fats, 
  calorie_goal, protein_goal, carbs_goal, fats_goal, calories_burned, meal_count
) VALUES
('YOUR_USER_ID_HERE', CURRENT_DATE - INTERVAL '6 days', 1950, 145, 195, 62, 2000, 150, 200, 65, 350, 4),
('YOUR_USER_ID_HERE', CURRENT_DATE - INTERVAL '5 days', 2100, 155, 210, 68, 2000, 150, 200, 65, 400, 4),
('YOUR_USER_ID_HERE', CURRENT_DATE - INTERVAL '4 days', 1850, 140, 185, 60, 2000, 150, 200, 65, 300, 3),
('YOUR_USER_ID_HERE', CURRENT_DATE - INTERVAL '3 days', 2050, 150, 205, 65, 2000, 150, 200, 65, 380, 4),
('YOUR_USER_ID_HERE', CURRENT_DATE - INTERVAL '2 days', 1900, 148, 190, 63, 2000, 150, 200, 65, 320, 4),
('YOUR_USER_ID_HERE', CURRENT_DATE - INTERVAL '1 day', 2000, 152, 200, 64, 2000, 150, 200, 65, 360, 4),
('YOUR_USER_ID_HERE', CURRENT_DATE, 1200, 85, 120, 40, 2000, 150, 200, 65, 0, 2)
ON CONFLICT (user_id, date) DO NOTHING;

-- =====================================================
-- SAMPLE USER STREAKS
-- =====================================================

INSERT INTO public.user_streaks (
  user_id, streak_type, current_streak, longest_streak, 
  last_activity_date, streak_start_date
) VALUES
('YOUR_USER_ID_HERE', 'workout', 7, 14, CURRENT_DATE, CURRENT_DATE - INTERVAL '6 days'),
('YOUR_USER_ID_HERE', 'nutrition_log', 30, 45, CURRENT_DATE, CURRENT_DATE - INTERVAL '29 days'),
('YOUR_USER_ID_HERE', 'check_in', 5, 10, CURRENT_DATE, CURRENT_DATE - INTERVAL '4 days')
ON CONFLICT (user_id, streak_type) DO NOTHING;

-- =====================================================
-- SAMPLE EXERCISE PROGRESS
-- =====================================================

INSERT INTO public.exercise_progress (
  user_id, exercise_name, date, max_weight, total_volume, 
  total_reps, total_sets, average_reps_per_set, one_rep_max
) VALUES
-- Bench Press progression
('YOUR_USER_ID_HERE', 'Bench Press', CURRENT_DATE - INTERVAL '60 days', 60, 1800, 60, 4, 15, 75),
('YOUR_USER_ID_HERE', 'Bench Press', CURRENT_DATE - INTERVAL '45 days', 65, 1950, 60, 4, 15, 81),
('YOUR_USER_ID_HERE', 'Bench Press', CURRENT_DATE - INTERVAL '30 days', 70, 2100, 60, 4, 15, 87),
('YOUR_USER_ID_HERE', 'Bench Press', CURRENT_DATE - INTERVAL '15 days', 75, 2250, 60, 4, 15, 93),
('YOUR_USER_ID_HERE', 'Bench Press', CURRENT_DATE, 80, 2400, 60, 4, 15, 100),

-- Squat progression
('YOUR_USER_ID_HERE', 'Squat', CURRENT_DATE - INTERVAL '60 days', 80, 2400, 60, 4, 15, 100),
('YOUR_USER_ID_HERE', 'Squat', CURRENT_DATE - INTERVAL '45 days', 85, 2550, 60, 4, 15, 106),
('YOUR_USER_ID_HERE', 'Squat', CURRENT_DATE - INTERVAL '30 days', 90, 2700, 60, 4, 15, 112),
('YOUR_USER_ID_HERE', 'Squat', CURRENT_DATE - INTERVAL '15 days', 95, 2850, 60, 4, 15, 118),
('YOUR_USER_ID_HERE', 'Squat', CURRENT_DATE, 100, 3000, 60, 4, 15, 125)
ON CONFLICT (user_id, exercise_name, date) DO NOTHING;

-- =====================================================
-- SAMPLE USER LEVEL
-- =====================================================

INSERT INTO public.user_level_system (
  user_id, current_level, current_xp, total_xp, 
  xp_to_next_level, level_title
) VALUES (
  'YOUR_USER_ID_HERE',
  5,
  350,
  2850,
  500,
  'Intermediate'
) ON CONFLICT (user_id) DO UPDATE SET
  current_level = EXCLUDED.current_level,
  current_xp = EXCLUDED.current_xp,
  total_xp = EXCLUDED.total_xp,
  xp_to_next_level = EXCLUDED.xp_to_next_level,
  level_title = EXCLUDED.level_title;

-- =====================================================
-- SAMPLE BADGE PROGRESS
-- =====================================================

-- First, get some badge IDs (you'll need to run this after badges are seeded)
DO $$
DECLARE
  v_user_id UUID := 'YOUR_USER_ID_HERE';
  v_badge_id UUID;
BEGIN
  -- Unlock "First Step" badge
  SELECT id INTO v_badge_id FROM public.achievement_badges WHERE badge_name = 'First Step' LIMIT 1;
  IF v_badge_id IS NOT NULL THEN
    INSERT INTO public.user_badge_progress (user_id, badge_id, current_progress, is_unlocked, unlocked_at)
    VALUES (v_user_id, v_badge_id, 1, true, CURRENT_DATE - INTERVAL '80 days')
    ON CONFLICT (user_id, badge_id) DO NOTHING;
  END IF;

  -- Unlock "Getting Started" badge
  SELECT id INTO v_badge_id FROM public.achievement_badges WHERE badge_name = 'Getting Started' LIMIT 1;
  IF v_badge_id IS NOT NULL THEN
    INSERT INTO public.user_badge_progress (user_id, badge_id, current_progress, is_unlocked, unlocked_at)
    VALUES (v_user_id, v_badge_id, 5, true, CURRENT_DATE - INTERVAL '60 days')
    ON CONFLICT (user_id, badge_id) DO NOTHING;
  END IF;

  -- Unlock "Committed" badge
  SELECT id INTO v_badge_id FROM public.achievement_badges WHERE badge_name = 'Committed' LIMIT 1;
  IF v_badge_id IS NOT NULL THEN
    INSERT INTO public.user_badge_progress (user_id, badge_id, current_progress, is_unlocked, unlocked_at)
    VALUES (v_user_id, v_badge_id, 10, true, CURRENT_DATE - INTERVAL '40 days')
    ON CONFLICT (user_id, badge_id) DO NOTHING;
  END IF;

  -- Progress towards "Dedicated" badge (not unlocked yet)
  SELECT id INTO v_badge_id FROM public.achievement_badges WHERE badge_name = 'Dedicated' LIMIT 1;
  IF v_badge_id IS NOT NULL THEN
    INSERT INTO public.user_badge_progress (user_id, badge_id, current_progress, is_unlocked, unlocked_at)
    VALUES (v_user_id, v_badge_id, 18, false, NULL)
    ON CONFLICT (user_id, badge_id) DO NOTHING;
  END IF;

  -- Unlock "On Fire" streak badge
  SELECT id INTO v_badge_id FROM public.achievement_badges WHERE badge_name = 'On Fire' LIMIT 1;
  IF v_badge_id IS NOT NULL THEN
    INSERT INTO public.user_badge_progress (user_id, badge_id, current_progress, is_unlocked, unlocked_at)
    VALUES (v_user_id, v_badge_id, 3, true, CURRENT_DATE - INTERVAL '20 days')
    ON CONFLICT (user_id, badge_id) DO NOTHING;
  END IF;

  -- Progress towards "Unstoppable" badge
  SELECT id INTO v_badge_id FROM public.achievement_badges WHERE badge_name = 'Unstoppable' LIMIT 1;
  IF v_badge_id IS NOT NULL THEN
    INSERT INTO public.user_badge_progress (user_id, badge_id, current_progress, is_unlocked, unlocked_at)
    VALUES (v_user_id, v_badge_id, 7, true, CURRENT_DATE - INTERVAL '1 day')
    ON CONFLICT (user_id, badge_id) DO NOTHING;
  END IF;
END $$;

-- =====================================================
-- INSTRUCTIONS
-- =====================================================

-- To use this sample data:
-- 1. Get your user ID from Supabase auth.users table
-- 2. Replace all instances of 'YOUR_USER_ID_HERE' with your actual user ID
-- 3. Run this script in Supabase SQL Editor
-- 4. Refresh your Progress screen to see the data!

-- Example query to get your user ID:
-- SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';
