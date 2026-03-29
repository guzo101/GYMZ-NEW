import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * Handles gymz:// deep links (e.g. password reset from Supabase email).
 * When user clicks the link in their email, the OS opens the app with the URL.
 * We parse the hash (access_token, refresh_token) and set the Supabase session.
 */
export function DeepLinkHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.onDeepLink) return;

    electronAPI.onDeepLink((url: string) => {
      try {
        if (!url.startsWith("gymz://")) return;
        const parsed = new URL(url);
        const hash = parsed.hash?.slice(1);
        if (!hash) return;

        const params = new URLSearchParams(hash);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        const type = params.get("type");

        if (accessToken && refreshToken && type === "recovery") {
          supabase.auth
            .setSession({ access_token: accessToken, refresh_token: refreshToken })
            .then(() => {
              navigate("/reset-password", { replace: true });
            })
            .catch((err) => {
              console.error("Deep link: failed to set session", err);
            });
        }
      } catch (err) {
        console.error("Deep link: failed to parse URL", url, err);
      }
    });
  }, [navigate]);

  return null;
}
