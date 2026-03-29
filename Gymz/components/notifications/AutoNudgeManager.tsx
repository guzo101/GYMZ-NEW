import React, { useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { autoNudgeService } from '../../services/autoNudgeService';

/**
 * AutoNudgeManager Component
 * Background manager that handles scheduling for the 5x daily personality nudges.
 * Watches user profile for gender changes to ensure the library is correctly indexed.
 */
export const AutoNudgeManager: React.FC = () => {
  const { user } = useAuth();
  const lastGender = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const gender = (user as any)?.gender ?? null;
    if (gender === lastGender.current) return;

    console.log('[AutoNudgeManager] User gender changed or loaded:', gender);
    lastGender.current = gender || null;

    autoNudgeService
      .initAutoNudges(gender)
      .catch((e) => console.warn('[AutoNudgeManager] initAutoNudges failed:', e));
  }, [user?.id, (user as any)?.gender]);

  return null;
};
