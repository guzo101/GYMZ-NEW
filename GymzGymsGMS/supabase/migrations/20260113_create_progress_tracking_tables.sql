-- =====================================================
-- PHASE 1: Body Metrics & Goals Tracking
-- =====================================================

-- Table: body_metrics
-- Purpose: Track weight and body measurements over time
CREATE TABLE IF NOT EXISTS public.body_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  weight NUMERIC NOT NULL, -- in kg
  body_fat_percentage NUMERIC, -- optional, percentage
  muscle_mass NUMERIC, -- optional, in kg
  waist_circumference NUMERIC, -- optional, in cm
  chest_circumference NUMERIC, -- optional, in cm
  arm_circumference NUMERIC, -- optional, in cm
  hip_circumference NUMERIC, -- optional, in cm
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_body_metrics_user_date ON public.body_metrics(user_id, date DESC);

-- Table: user_fitness_goals
-- Purpose: Store user's fitness goals and targets
CREATE TABLE IF NOT EXISTS public.user_fitness_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  goal_type TEXT CHECK (goal_type IN ('weight_loss', 'weight_gain', 'muscle_gain', 'maintenance', 'endurance', 'strength')) NOT NULL,
  target_weight NUMERIC, -- in kg
  target_body_fat NUMERIC, -- percentage
  target_date DATE,
  starting_weight NUMERIC,
  starting_body_fat NUMERIC,
  starting_date DATE DEFAULT CURRENT_DATE,
  weekly_workout_goal INTEGER DEFAULT 3, -- target workouts per week
  daily_calorie_goal NUMERIC DEFAULT 2000,
  daily_protein_goal NUMERIC DEFAULT 150,
  daily_carbs_goal NUMERIC DEFAULT 200,
  daily_fats_goal NUMERIC DEFAULT 65,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_fitness_goals_active ON public.user_fitness_goals(user_id, is_active);

-- Table: daily_calorie_summary
-- Purpose: Pre-calculated daily nutrition summaries for fast queries
CREATE TABLE IF NOT EXISTS public.daily_calorie_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  total_calories NUMERIC DEFAULT 0,
  total_protein NUMERIC DEFAULT 0,
  total_carbs NUMERIC DEFAULT 0,
  total_fats NUMERIC DEFAULT 0,
  total_fiber NUMERIC DEFAULT 0,
  calorie_goal NUMERIC NOT NULL DEFAULT 2000,
  protein_goal NUMERIC DEFAULT 150,
  carbs_goal NUMERIC DEFAULT 200,
  fats_goal NUMERIC DEFAULT 65,
  calories_burned NUMERIC DEFAULT 0, -- from workouts
  net_calories NUMERIC GENERATED ALWAYS AS (total_calories - calories_burned) STORED,
  meal_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_daily_calorie_summary_user_date ON public.daily_calorie_summary(user_id, date DESC);

-- =====================================================
-- PHASE 2: Enhanced Tracking
-- =====================================================

-- Table: user_streaks
-- Purpose: Track various user streaks for gamification
CREATE TABLE IF NOT EXISTS public.user_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  streak_type TEXT CHECK (streak_type IN ('workout', 'nutrition_log', 'check_in', 'water_intake', 'class_attendance')) NOT NULL,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_activity_date DATE,
  streak_start_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, streak_type)
);

CREATE INDEX idx_user_streaks_user ON public.user_streaks(user_id);

-- Table: exercise_progress
-- Purpose: Track progress for specific exercises over time
CREATE TABLE IF NOT EXISTS public.exercise_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  exercise_name TEXT NOT NULL,
  date DATE NOT NULL,
  max_weight NUMERIC, -- heaviest single set in kg
  total_volume NUMERIC, -- sets × reps × weight
  total_reps INTEGER,
  total_sets INTEGER,
  average_reps_per_set NUMERIC,
  one_rep_max NUMERIC, -- calculated 1RM
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, exercise_name, date)
);

CREATE INDEX idx_exercise_progress_user_exercise ON public.exercise_progress(user_id, exercise_name, date DESC);

-- Table: class_attendance_summary
-- Purpose: Monthly class attendance tracking
CREATE TABLE IF NOT EXISTS public.class_attendance_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  month DATE NOT NULL, -- first day of month
  total_classes_attended INTEGER DEFAULT 0,
  total_classes_booked INTEGER DEFAULT 0,
  attendance_rate NUMERIC GENERATED ALWAYS AS (
    CASE WHEN total_classes_booked > 0 
    THEN (total_classes_attended::NUMERIC / total_classes_booked) * 100 
    ELSE 0 END
  ) STORED,
  favorite_class_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month)
);

CREATE INDEX idx_class_attendance_user_month ON public.class_attendance_summary(user_id, month DESC);

-- Table: weekly_progress_summary
-- Purpose: Weekly summaries for quick trend analysis
CREATE TABLE IF NOT EXISTS public.weekly_progress_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  week_start_date DATE NOT NULL, -- Monday of the week
  total_workouts INTEGER DEFAULT 0,
  total_workout_duration INTEGER DEFAULT 0, -- in minutes
  avg_daily_calories NUMERIC DEFAULT 0,
  avg_weight NUMERIC,
  total_calories_logged INTEGER DEFAULT 0,
  total_classes_attended INTEGER DEFAULT 0,
  total_xp_earned INTEGER DEFAULT 0,
  total_volume_lifted NUMERIC DEFAULT 0, -- total kg lifted
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_start_date)
);

CREATE INDEX idx_weekly_summary_user_week ON public.weekly_progress_summary(user_id, week_start_date DESC);

-- =====================================================
-- PHASE 3: Gamification & Achievements
-- =====================================================

-- Table: achievement_badges
-- Purpose: Define all available badges and their requirements
CREATE TABLE IF NOT EXISTS public.achievement_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_name TEXT UNIQUE NOT NULL,
  badge_description TEXT,
  badge_icon TEXT NOT NULL, -- MaterialCommunityIcons name
  badge_category TEXT CHECK (badge_category IN ('workout', 'nutrition', 'streak', 'social', 'milestone', 'strength')) NOT NULL,
  requirement_type TEXT CHECK (requirement_type IN ('workout_count', 'streak_days', 'weight_lifted', 'calories_logged', 'classes_attended', 'personal_record', 'consistency')) NOT NULL,
  requirement_value INTEGER NOT NULL,
  xp_reward INTEGER DEFAULT 100,
  tier TEXT CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')) DEFAULT 'bronze',
  gradient_colors TEXT[] DEFAULT ARRAY['#06B6D4', '#3B82F6'], -- for badge display
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: user_badge_progress
-- Purpose: Track user progress towards badges
CREATE TABLE IF NOT EXISTS public.user_badge_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  badge_id UUID REFERENCES public.achievement_badges(id) ON DELETE CASCADE NOT NULL,
  current_progress INTEGER DEFAULT 0,
  is_unlocked BOOLEAN DEFAULT FALSE,
  unlocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

CREATE INDEX idx_user_badge_progress_user ON public.user_badge_progress(user_id, is_unlocked);
CREATE INDEX idx_user_badge_progress_unlocked ON public.user_badge_progress(user_id, unlocked_at DESC) WHERE is_unlocked = TRUE;

-- Table: user_level_system
-- Purpose: Track user XP and level
CREATE TABLE IF NOT EXISTS public.user_level_system (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  current_level INTEGER DEFAULT 1,
  current_xp INTEGER DEFAULT 0,
  total_xp INTEGER DEFAULT 0,
  xp_to_next_level INTEGER DEFAULT 100,
  level_title TEXT DEFAULT 'Beginner', -- Beginner, Intermediate, Advanced, Elite, Legend
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_level_system_user ON public.user_level_system(user_id);

-- =====================================================
-- TRIGGERS FOR AUTO-UPDATES
-- =====================================================

-- Trigger: Update body_metrics timestamp
CREATE OR REPLACE FUNCTION update_body_metrics_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_body_metrics_updated ON public.body_metrics;
CREATE TRIGGER trg_body_metrics_updated
BEFORE UPDATE ON public.body_metrics
FOR EACH ROW EXECUTE FUNCTION update_body_metrics_timestamp();

-- Trigger: Update user_fitness_goals timestamp
CREATE OR REPLACE FUNCTION update_fitness_goals_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fitness_goals_updated ON public.user_fitness_goals;
CREATE TRIGGER trg_fitness_goals_updated
BEFORE UPDATE ON public.user_fitness_goals
FOR EACH ROW EXECUTE FUNCTION update_fitness_goals_timestamp();

-- Trigger: Update daily_calorie_summary timestamp
CREATE OR REPLACE FUNCTION update_calorie_summary_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calorie_summary_updated ON public.daily_calorie_summary;
CREATE TRIGGER trg_calorie_summary_updated
BEFORE UPDATE ON public.daily_calorie_summary
FOR EACH ROW EXECUTE FUNCTION update_calorie_summary_timestamp();

-- Trigger: Update user_streaks timestamp
CREATE OR REPLACE FUNCTION update_user_streaks_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_streaks_updated ON public.user_streaks;
CREATE TRIGGER trg_user_streaks_updated
BEFORE UPDATE ON public.user_streaks
FOR EACH ROW EXECUTE FUNCTION update_user_streaks_timestamp();

-- Trigger: Update user_badge_progress timestamp
CREATE OR REPLACE FUNCTION update_badge_progress_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_badge_progress_updated ON public.user_badge_progress;
CREATE TRIGGER trg_badge_progress_updated
BEFORE UPDATE ON public.user_badge_progress
FOR EACH ROW EXECUTE FUNCTION update_badge_progress_timestamp();

-- Trigger: Update user_level_system timestamp
CREATE OR REPLACE FUNCTION update_user_level_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_level_updated ON public.user_level_system;
CREATE TRIGGER trg_user_level_updated
BEFORE UPDATE ON public.user_level_system
FOR EACH ROW EXECUTE FUNCTION update_user_level_timestamp();

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE public.body_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_fitness_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_calorie_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_attendance_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_progress_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievement_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badge_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_level_system ENABLE ROW LEVEL SECURITY;

-- Policies for body_metrics
CREATE POLICY "Users can view own body metrics" ON public.body_metrics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own body metrics" ON public.body_metrics FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own body metrics" ON public.body_metrics FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own body metrics" ON public.body_metrics FOR DELETE USING (auth.uid() = user_id);

-- Policies for user_fitness_goals
CREATE POLICY "Users can view own goals" ON public.user_fitness_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals" ON public.user_fitness_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON public.user_fitness_goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON public.user_fitness_goals FOR DELETE USING (auth.uid() = user_id);

-- Policies for daily_calorie_summary
CREATE POLICY "Users can view own calorie summary" ON public.daily_calorie_summary FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own calorie summary" ON public.daily_calorie_summary FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own calorie summary" ON public.daily_calorie_summary FOR UPDATE USING (auth.uid() = user_id);

-- Policies for user_streaks
CREATE POLICY "Users can view own streaks" ON public.user_streaks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own streaks" ON public.user_streaks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own streaks" ON public.user_streaks FOR UPDATE USING (auth.uid() = user_id);

-- Policies for exercise_progress
CREATE POLICY "Users can view own exercise progress" ON public.exercise_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own exercise progress" ON public.exercise_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own exercise progress" ON public.exercise_progress FOR UPDATE USING (auth.uid() = user_id);

-- Policies for class_attendance_summary
CREATE POLICY "Users can view own class attendance" ON public.class_attendance_summary FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own class attendance" ON public.class_attendance_summary FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own class attendance" ON public.class_attendance_summary FOR UPDATE USING (auth.uid() = user_id);

-- Policies for weekly_progress_summary
CREATE POLICY "Users can view own weekly summary" ON public.weekly_progress_summary FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own weekly summary" ON public.weekly_progress_summary FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own weekly summary" ON public.weekly_progress_summary FOR UPDATE USING (auth.uid() = user_id);

-- Policies for achievement_badges (public read)
CREATE POLICY "Anyone can view badges" ON public.achievement_badges FOR SELECT USING (true);

-- Policies for user_badge_progress
CREATE POLICY "Users can view own badge progress" ON public.user_badge_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own badge progress" ON public.user_badge_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own badge progress" ON public.user_badge_progress FOR UPDATE USING (auth.uid() = user_id);

-- Policies for user_level_system
CREATE POLICY "Users can view own level" ON public.user_level_system FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own level" ON public.user_level_system FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own level" ON public.user_level_system FOR UPDATE USING (auth.uid() = user_id);
