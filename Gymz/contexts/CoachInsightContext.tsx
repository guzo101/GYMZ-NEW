import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { CoachInsightPayload } from '../components/dashboard/CoachInsightCard';

interface CoachInsightContextValue {
  /** Set when dashboard (or any screen) has loaded insight data. Widget shows after delay. */
  payload: CoachInsightPayload | null;
  setPayload: (p: CoachInsightPayload | null) => void;
}

const CoachInsightContext = createContext<CoachInsightContextValue | null>(null);

export function CoachInsightProvider({ children }: { children: ReactNode }) {
  const [payload, setPayloadState] = useState<CoachInsightPayload | null>(null);
  const setPayload = useCallback((p: CoachInsightPayload | null) => {
    setPayloadState(p);
  }, []);
  return (
    <CoachInsightContext.Provider value={{ payload, setPayload }}>
      {children}
    </CoachInsightContext.Provider>
  );
}

export function useCoachInsight() {
  const ctx = useContext(CoachInsightContext);
  return ctx;
}
