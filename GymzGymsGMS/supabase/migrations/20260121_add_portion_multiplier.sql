-- Add portion_multiplier to meal_scans to track user adjustments
ALTER TABLE public.meal_scans 
ADD COLUMN IF NOT EXISTS portion_multiplier NUMERIC DEFAULT 1.0;
