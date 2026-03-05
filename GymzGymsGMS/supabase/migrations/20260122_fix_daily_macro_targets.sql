-- Ensure daily_macro_targets exists
CREATE TABLE IF NOT EXISTS public.daily_macro_targets (
  target_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_calorie_goal NUMERIC NOT NULL,
  protein_goal NUMERIC DEFAULT 0,
  carbs_goal NUMERIC DEFAULT 0,
  fats_goal NUMERIC DEFAULT 0,
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (user_id, date)
);

-- Enable RLS
ALTER TABLE public.daily_macro_targets ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT ALL ON TABLE public.daily_macro_targets TO authenticated;
GRANT ALL ON TABLE public.daily_macro_targets TO service_role;

-- Policies
CREATE POLICY "Users can view own macro targets" ON public.daily_macro_targets
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own macro targets" ON public.daily_macro_targets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own macro targets" ON public.daily_macro_targets
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own macro targets" ON public.daily_macro_targets
    FOR DELETE USING (auth.uid() = user_id);
