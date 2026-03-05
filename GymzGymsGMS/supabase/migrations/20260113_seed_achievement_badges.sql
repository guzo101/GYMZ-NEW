-- =====================================================
-- SEED DATA: Achievement Badges
-- =====================================================

-- Clear existing badges (optional, for fresh start)
-- DELETE FROM public.achievement_badges;

-- =====================================================
-- WORKOUT BADGES
-- =====================================================

INSERT INTO public.achievement_badges (badge_name, badge_description, badge_icon, badge_category, requirement_type, requirement_value, xp_reward, tier, gradient_colors) VALUES
('First Step', 'Complete your first workout', 'foot-print', 'workout', 'workout_count', 1, 50, 'bronze', ARRAY['#06B6D4', '#3B82F6']),
('Getting Started', 'Complete 5 workouts', 'run-fast', 'workout', 'workout_count', 5, 100, 'bronze', ARRAY['#06B6D4', '#3B82F6']),
('Committed', 'Complete 10 workouts', 'dumbbell', 'workout', 'workout_count', 10, 200, 'silver', ARRAY['#3B82F6', '#8B5CF6']),
('Dedicated', 'Complete 25 workouts', 'weight-lifter', 'workout', 'workout_count', 25, 500, 'silver', ARRAY['#3B82F6', '#8B5CF6']),
('Warrior', 'Complete 50 workouts', 'arm-flex', 'workout', 'workout_count', 50, 1000, 'gold', ARRAY['#F59E0B', '#EF4444']),
('Champion', 'Complete 100 workouts', 'trophy', 'workout', 'workout_count', 100, 2500, 'gold', ARRAY['#F59E0B', '#EF4444']),
('Legend', 'Complete 250 workouts', 'crown', 'workout', 'workout_count', 250, 5000, 'platinum', ARRAY['#8B5CF6', '#EC4899']),
('Titan', 'Complete 500 workouts', 'shield-star', 'workout', 'workout_count', 500, 10000, 'diamond', ARRAY['#EC4899', '#EF4444'])
ON CONFLICT (badge_name) DO NOTHING;

-- =====================================================
-- STREAK BADGES
-- =====================================================

INSERT INTO public.achievement_badges (badge_name, badge_description, badge_icon, badge_category, requirement_type, requirement_value, xp_reward, tier, gradient_colors) VALUES
('On Fire', 'Maintain a 3-day workout streak', 'fire', 'streak', 'streak_days', 3, 100, 'bronze', ARRAY['#F59E0B', '#EF4444']),
('Unstoppable', 'Maintain a 7-day workout streak', 'fire-circle', 'streak', 'streak_days', 7, 300, 'silver', ARRAY['#F59E0B', '#EF4444']),
('Relentless', 'Maintain a 14-day workout streak', 'fire-alert', 'streak', 'streak_days', 14, 750, 'gold', ARRAY['#EF4444', '#DC2626']),
('Immortal', 'Maintain a 30-day workout streak', 'infinity', 'streak', 'streak_days', 30, 2000, 'platinum', ARRAY['#8B5CF6', '#EC4899']),
('Eternal', 'Maintain a 100-day workout streak', 'star-circle', 'streak', 'streak_days', 100, 10000, 'diamond', ARRAY['#EC4899', '#EF4444'])
ON CONFLICT (badge_name) DO NOTHING;

-- =====================================================
-- STRENGTH BADGES
-- =====================================================

INSERT INTO public.achievement_badges (badge_name, badge_description, badge_icon, badge_category, requirement_type, requirement_value, xp_reward, tier, gradient_colors) VALUES
('Lifting Beginner', 'Lift 1,000 kg total volume', 'weight', 'strength', 'weight_lifted', 1000, 200, 'bronze', ARRAY['#06B6D4', '#3B82F6']),
('Iron Mover', 'Lift 5,000 kg total volume', 'weight-kilogram', 'strength', 'weight_lifted', 5000, 500, 'silver', ARRAY['#3B82F6', '#8B5CF6']),
('Steel Crusher', 'Lift 10,000 kg total volume', 'dumbbell', 'strength', 'weight_lifted', 10000, 1500, 'gold', ARRAY['#F59E0B', '#EF4444']),
('Titan Lifter', 'Lift 25,000 kg total volume', 'arm-flex-outline', 'strength', 'weight_lifted', 25000, 5000, 'platinum', ARRAY['#8B5CF6', '#EC4899']),
('Hercules', 'Lift 50,000 kg total volume', 'medal', 'strength', 'weight_lifted', 50000, 15000, 'diamond', ARRAY['#EC4899', '#EF4444'])
ON CONFLICT (badge_name) DO NOTHING;

-- =====================================================
-- NUTRITION BADGES
-- =====================================================

INSERT INTO public.achievement_badges (badge_name, badge_description, badge_icon, badge_category, requirement_type, requirement_value, xp_reward, tier, gradient_colors) VALUES
('Calorie Tracker', 'Log calories for 1 day', 'food-apple', 'nutrition', 'calories_logged', 1, 50, 'bronze', ARRAY['#10B981', '#06B6D4']),
('Nutrition Aware', 'Log calories for 7 days', 'nutrition', 'nutrition', 'calories_logged', 7, 200, 'silver', ARRAY['#10B981', '#06B6D4']),
('Diet Master', 'Log calories for 30 days', 'food-variant', 'nutrition', 'calories_logged', 30, 1000, 'gold', ARRAY['#10B981', '#3B82F6']),
('Macro Guru', 'Log calories for 90 days', 'chart-pie', 'nutrition', 'calories_logged', 90, 3000, 'platinum', ARRAY['#3B82F6', '#8B5CF6']),
('Nutrition Legend', 'Log calories for 365 days', 'food-turkey', 'nutrition', 'calories_logged', 365, 10000, 'diamond', ARRAY['#8B5CF6', '#EC4899'])
ON CONFLICT (badge_name) DO NOTHING;

-- =====================================================
-- SOCIAL/CLASS BADGES
-- =====================================================

INSERT INTO public.achievement_badges (badge_name, badge_description, badge_icon, badge_category, requirement_type, requirement_value, xp_reward, tier, gradient_colors) VALUES
('Class Rookie', 'Attend 1 gym class', 'account-group', 'social', 'classes_attended', 1, 50, 'bronze', ARRAY['#06B6D4', '#3B82F6']),
('Social Butterfly', 'Attend 10 gym classes', 'account-multiple', 'social', 'classes_attended', 10, 300, 'silver', ARRAY['#3B82F6', '#8B5CF6']),
('Community Member', 'Attend 25 gym classes', 'human-greeting', 'social', 'classes_attended', 25, 750, 'gold', ARRAY['#F59E0B', '#EF4444']),
('Class Enthusiast', 'Attend 50 gym classes', 'account-star', 'social', 'classes_attended', 50, 2000, 'platinum', ARRAY['#8B5CF6', '#EC4899']),
('Class Legend', 'Attend 100 gym classes', 'star-face', 'social', 'classes_attended', 100, 5000, 'diamond', ARRAY['#EC4899', '#EF4444'])
ON CONFLICT (badge_name) DO NOTHING;

-- =====================================================
-- MILESTONE BADGES
-- =====================================================

INSERT INTO public.achievement_badges (badge_name, badge_description, badge_icon, badge_category, requirement_type, requirement_value, xp_reward, tier, gradient_colors) VALUES
('Early Bird', 'Complete a workout before 7 AM', 'weather-sunset-up', 'milestone', 'workout_count', 1, 100, 'bronze', ARRAY['#F59E0B', '#F97316']),
('Night Owl', 'Complete a workout after 9 PM', 'weather-night', 'milestone', 'workout_count', 1, 100, 'bronze', ARRAY['#3B82F6', '#8B5CF6']),
('Weekend Warrior', 'Complete 10 weekend workouts', 'calendar-weekend', 'milestone', 'workout_count', 10, 500, 'silver', ARRAY['#06B6D4', '#3B82F6']),
('Consistency King', 'Work out every day for a week', 'calendar-check', 'milestone', 'consistency', 7, 1000, 'gold', ARRAY['#10B981', '#06B6D4']),
('Perfect Month', 'Work out every day for a month', 'calendar-star', 'milestone', 'consistency', 30, 5000, 'platinum', ARRAY['#8B5CF6', '#EC4899'])
ON CONFLICT (badge_name) DO NOTHING;

-- =====================================================
-- PERSONAL RECORD BADGES
-- =====================================================

INSERT INTO public.achievement_badges (badge_name, badge_description, badge_icon, badge_category, requirement_type, requirement_value, xp_reward, tier, gradient_colors) VALUES
('First PR', 'Set your first personal record', 'star-outline', 'strength', 'personal_record', 1, 100, 'bronze', ARRAY['#F59E0B', '#EF4444']),
('PR Hunter', 'Set 5 personal records', 'star-half-full', 'strength', 'personal_record', 5, 500, 'silver', ARRAY['#F59E0B', '#EF4444']),
('Record Breaker', 'Set 10 personal records', 'star', 'strength', 'personal_record', 10, 1500, 'gold', ARRAY['#EF4444', '#DC2626']),
('PR Machine', 'Set 25 personal records', 'star-four-points', 'strength', 'personal_record', 25, 5000, 'platinum', ARRAY['#8B5CF6', '#EC4899']),
('Limitless', 'Set 50 personal records', 'star-shooting', 'strength', 'personal_record', 50, 15000, 'diamond', ARRAY['#EC4899', '#EF4444'])
ON CONFLICT (badge_name) DO NOTHING;
