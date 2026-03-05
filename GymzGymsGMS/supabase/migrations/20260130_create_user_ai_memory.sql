-- Level 4 Autonomy: AI Memory System
-- This table stores qualitative insights to help the AI "remember" the user

CREATE TABLE IF NOT EXISTS public.user_ai_memory (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Personality & Communication
    communication_style TEXT CHECK (communication_style IN ('direct', 'supportive', 'analytical', 'enthusiastic', 'tough_love')),
    motivation_driver TEXT CHECK (motivation_driver IN ('competition', 'health', 'appearance', 'mental_clarity', 'social')),
    
    -- Inferred Preferences (Arrays of strings)
    dietary_preferences TEXT[] DEFAULT '{}', -- e.g. ['keto', 'vegan', 'sweet_tooth']
    workout_preferences TEXT[] DEFAULT '{}', -- e.g. ['cardio_hater', 'lifting_focused', 'morning_crew']
    
    -- Contextual Awareness
    last_interaction_sentiment TEXT, -- 'positive', 'neutral', 'negative', 'frustrated'
    last_interaction_date TIMESTAMPTZ,
    
    -- Qualitative Memories (Key facts the AI should mention)
    key_memories TEXT[] DEFAULT '{}', -- e.g. ["Recovering from ACL surgery", "Training for wedding in June"]
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.user_ai_memory ENABLE ROW LEVEL SECURITY;

-- Admins only (AI runs as admin usually, or service role)
CREATE POLICY "Admins can do everything on ai_memory"
    ON public.user_ai_memory
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- Trigger for updated_at
CREATE TRIGGER update_user_ai_memory_updated_at
    BEFORE UPDATE ON public.user_ai_memory
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
