-- Create water_logs table
CREATE TABLE IF NOT EXISTS public.water_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    amount INTEGER NOT NULL DEFAULT 1,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.water_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own water logs" ON public.water_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own water logs" ON public.water_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own water logs" ON public.water_logs
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own water logs" ON public.water_logs
    FOR DELETE USING (auth.uid() = user_id);

-- Create index for faster querying by user and date
CREATE INDEX IF NOT EXISTS water_logs_user_date_idx ON public.water_logs (user_id, date);
