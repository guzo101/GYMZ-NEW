import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { recordWebsitePageView } from "../lib/recordWebsitePageView";

/**
 * Records route changes on the marketing site for OAC analytics (no UI).
 */
export function WebsiteTrafficRecorder() {
  const location = useLocation();
  const lastSentRef = useRef<{ key: string; at: number } | null>(null);

  useEffect(() => {
    const path = `${location.pathname}${location.search || ""}`;
    const now = Date.now();
    const prev = lastSentRef.current;
    if (prev && prev.key === path && now - prev.at < 1500) return;
    lastSentRef.current = { key: path, at: now };
    void recordWebsitePageView(path);
  }, [location.pathname, location.search]);

  return null;
}
