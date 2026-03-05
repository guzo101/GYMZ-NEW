import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const db = {
  from: (...args: any[]) => (supabase as any).from(...args),
};

export function useTheme() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // For all users, use a consistent premium theme based on primary and secondary colors
  const themeClasses = {
    gradient: 'from-primary via-primary to-secondary',
    gradientLight: 'from-primary/10 via-primary/5 to-secondary/10',
    cardGradient: 'from-primary/5 to-transparent',
    borderColor: 'border-primary/20',
    textAccent: 'text-primary',
    bgAccent: 'bg-primary',
    iconBg: 'bg-gradient-to-br from-primary to-secondary',
    statsGradient: 'from-primary via-primary to-secondary',
    headerBg: 'bg-gradient-to-r from-primary via-primary to-secondary',
    hoverBg: 'hover:bg-primary/10',
  };

  return {
    themeClasses,
    isFemale: false,
    isMember: user?.role === 'member',
    loading: false,
  };
}






