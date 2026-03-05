-- Migration: Create meal_scans table for advanced AI nutrition tracking
-- Date: 2026-01-15

CREATE TABLE IF NOT EXISTS public.meal_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT,
  food_name TEXT NOT NULL,
  calories INTEGER DEFAULT 0,
  protein NUMERIC DEFAULT 0,
  carbs NUMERIC DEFAULT 0,
  fat NUMERIC DEFAULT 0,
  fiber NUMERIC DEFAULT 0,
  sugar NUMERIC DEFAULT 0,
  portion_size TEXT,
  confidence_score NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.meal_scans ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own scans" ON public.meal_scans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own scans" ON public.meal_scans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own scans" ON public.meal_scans FOR DELETE USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_meal_scans_user_id ON public.meal_scans(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_scans_created_at ON public.meal_scans(created_at DESC);
