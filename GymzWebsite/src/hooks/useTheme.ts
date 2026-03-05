import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const db = {
  from: (...args: any[]) => (supabase as any).from(...args),
};

export function useTheme() {
  const { user } = useAuth();
  const [userGender, setUserGender] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    // Fetch user gender from database
    (async () => {
      try {
        const { data, error } = await db
          .from("users")
          .select("gender")
          .eq("id", user.id)
          .single();

        if (!error && data) {
          setUserGender(data.gender || null);
        }
      } catch (err) {
        console.warn("Failed to fetch user gender", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  // Determine if user is female
  const isFemale = userGender?.toLowerCase() === 'female' || userGender?.toLowerCase() === 'f';

  // For admin/staff, use a professional neutral theme
  // For members, use gender-based theme
  const isMember = user?.role === 'member';

  const themeClasses = {
    gradient: 'from-primary to-primary/80',
    gradientLight: 'from-primary/10 to-transparent',
    cardGradient: 'from-primary/5 to-transparent',
    borderColor: 'border-primary/20',
    textAccent: 'text-secondary',
    bgAccent: 'bg-primary',
    iconBg: 'bg-gradient-to-br from-primary to-secondary',
    statsGradient: 'from-primary via-primary/90 to-primary/80',
    headerBg: 'bg-gradient-to-r from-primary to-primary/90',
    hoverBg: 'hover:bg-primary/90',
  };

  return {
    themeClasses,
    isFemale: isMember ? isFemale : false,
    isMember,
    loading,
  };
}






