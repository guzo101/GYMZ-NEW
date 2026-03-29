import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import { retentionService, RetentionEvent, UserBehaviorMetrics } from '../services/retentionService';

/**
 * Minimal retention hook used by `RetentionNudge`.
 * - Pulls the user's behavior metrics
 * - Fetches active (unacknowledged) retention events
 * - Exposes the highest priority active nudge
 */
export function useRetention() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [metrics, setMetrics] = useState<UserBehaviorMetrics | null>(null);
  const [events, setEvents] = useState<RetentionEvent[]>([]);

  const refresh = useCallback(async () => {
    if (!userId) {
      setMetrics(null);
      setEvents([]);
      return;
    }

    const [m, e] = await Promise.all([
      retentionService.getUserMetrics(userId),
      retentionService.getActiveEvents(userId),
    ]);
    setMetrics(m);
    setEvents(e);
  }, [userId]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const activeNudge = useMemo(() => {
    if (!events.length) return null;
    // `getActiveEvents` already sorts by priority asc, then triggered_at desc.
    return events[0] ?? null;
  }, [events]);

  const acknowledgeEvent = useCallback(
    async (eventId: string) => {
      await retentionService.acknowledgeEvent(eventId);
      await refresh();
    },
    [refresh]
  );

  return {
    metrics,
    activeNudge,
    acknowledgeEvent,
    refresh,
  };
}

