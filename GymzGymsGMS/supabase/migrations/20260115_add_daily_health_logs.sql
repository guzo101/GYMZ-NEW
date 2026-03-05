-- Migration: Create daily_health_logs table for persistent health metrics
CREATE TABLE IF NOT EXISTS public.daily_health_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  date DATE DEFAULT CURRENT_DATE NOT NULL,
  steps INTEGER DEFAULT 0,
  sleep_minutes INTEGER DEFAULT 450, -- Defaul to 7.5 hours
  active_minutes INTEGER DEFAULT 0,
  water_ml INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Index for fast lookup by user and date
CREATE INDEX idx_daily_health_logs_user_date ON public.daily_health_logs(user_id, date DESC);

-- Enable RLS
ALTER TABLE public.daily_health_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own health logs" ON public.daily_health_logs 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own health logs" ON public.daily_health_logs 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own health logs" ON public.daily_health_logs 
  FOR UPDATE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_daily_health_logs_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_daily_health_logs_updated
BEFORE UPDATE ON public.daily_health_logs
FOR EACH ROW EXECUTE FUNCTION update_daily_health_logs_timestamp();
