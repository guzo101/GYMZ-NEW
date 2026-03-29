import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DataMapper } from "@/utils/dataMapper";

interface User {
  id: string;
  uniqueId?: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
  phone?: string | null;
  goal?: string | null;
  membershipStatus?: string | null;
  gymId?: string | null;
  accessMode?: string | null;
}

interface AuthContextProps {
  user: User | null;
  loading: boolean;
  login: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string, email: string) => {
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Profile fetch timed out (5s)")), 5000)
      );

      const { data, error } = await Promise.race([
        supabase.from("users").select("*").eq("id", userId).maybeSingle(),
        timeoutPromise
      ]) as any;

      if (error) {
        console.error("Error fetching profile:", error);
        return null;
      }

      if (data) {
        const d = DataMapper.fromDb<any>(data);

        // Self-heal: resolve gymId from gym_contacts if missing for admin/staff
        let resolvedGymId = d.gymId;
        if (!resolvedGymId && (d.role === 'admin' || d.role === 'staff')) {
          try {
            const { data: contact } = await supabase
              .from("gym_contacts")
              .select("gym_id")
              .eq("email", d.email)
              .eq("is_active", true)
              .limit(1)
              .maybeSingle();
            if (contact?.gym_id) {
              resolvedGymId = contact.gym_id;
              // Auto-patch the database so this lookup doesn't repeat
              await supabase.from("users").update({ gym_id: contact.gym_id }).eq("id", d.id);
              console.log("[Auth] Self-healed gymId from gym_contacts:", resolvedGymId);
            }
          } catch (healError) {
            console.warn("[Auth] gym_contacts self-heal failed:", healError);
          }
        }

        return {
          id: d.id,
          uniqueId: d.uniqueId,
          name: d.name || d.firstName || email.split('@')[0],
          email: d.email,
          role: d.role || "member",
          avatarUrl: d.avatarUrl,
          phone: d.phone,
          goal: d.goal || d.primaryObjective,
          membershipStatus: d.membershipStatus,
          gymId: resolvedGymId,
          accessMode: d.accessMode,
        };
      }
      return null;
    } catch (err) {
      console.error("fetchProfile error or timeout:", err);
      return null;
    }
  };

  // Build user from session metadata (no network). Used for instant restore and fallback.
  function userFromSession(session: { user: any }): User {
    const u = session.user;
    return {
      id: u.id,
      name: u.user_metadata?.name || u.user_metadata?.first_name || u.email?.split('@')[0] || "",
      email: u.email || "",
      role: u.user_metadata?.role || "member",
      avatarUrl: u.user_metadata?.avatar_url ?? null,
      gymId: u.user_metadata?.gym_id ?? null,
      accessMode: u.user_metadata?.access_mode ?? null,
    };
  }

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        setLoading(true);
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (session?.user) {
          // Session-first: enter app immediately with session metadata (no network wait)
          const metadataUser = userFromSession(session);
          if (mounted) {
            setUser(metadataUser);
            setLoading(false);
          }
          // Fetch full profile in background; update user when done
          fetchProfile(session.user.id, session.user.email || "").then((profile) => {
            if (!mounted) return;
            setUser(profile ?? metadataUser);
          });
        } else {
          if (mounted) {
            setUser(null);
            setLoading(false);
          }
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
      }
    }

    initializeAuth();

    // Safety timeout: ensure loading is false after 10 seconds max
    const safetyTimeout = setTimeout(() => {
      if (mounted) {
        console.warn("[Auth] Safety timeout triggered - forcing loading to false");
        setLoading(false);
      }
    }, 10000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[Auth] Event: ${event}`);

      if (session?.user) {
        const metadataUser = userFromSession(session);
        if (mounted) {
          setUser(metadataUser);
          setLoading(false);
        }
        fetchProfile(session.user.id, session.user.email || "").then((profile) => {
          if (!mounted) return;
          setUser(profile ?? metadataUser);
        });
      } else {
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
      }
    });

    // Security Watcher: If an admin is logged in without a gymId, log a warning
    if (user && (user.role === 'admin' || user.role === 'staff') && !user.gymId) {
      console.error("[Security] Admin logged in without gymId scoping!");
    }

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const login = (u: User) => {
    setUser(u);
    setLoading(false); // User is resolved - don't block on onAuthStateChange's fetchProfile
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
