/**
 * DualBubbleOverlay
 *
 * Renders Tyson + Lily using the Drama Director.
 * Sits absolutely above the entire navigation stack (rendered outside NavigationContainer).
 *
 * - Listens to the DramaBridgeContext for screen events.
 * - Fires `triggerDrama('screenEnter', currentScreen)` when screen changes.
 * - Forwards input events (password focus, typing, errors) from screens.
 *
 * Usage: Replace the pre-auth <AICoachBubble marketingMode={true}> with this.
 */

import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../../hooks/useTheme';
import { useDramaDirector } from './useDramaDirector';
import { BubbleActor } from './BubbleActor';
import { loginScripts } from './scripts/loginScripts';
import { signupScripts, gymSelectionScripts } from './scripts/signupScripts';
import { TYSON_CONFIG, LILY_CONFIG } from './types';
import { useDramaBridge } from './DramaBridgeContext';
import { lighten } from '../BubbleContainer';

// Combine all scripts
const ALL_SCRIPTS = [...loginScripts, ...signupScripts, ...gymSelectionScripts];

// ─── Component ────────────────────────────────────────────────────────────────

export const DualBubbleOverlay: React.FC = () => {
  const { theme } = useTheme();
  const { currentScreen, lastEvent, logoBounds } = useDramaBridge();
  const { tysonAnims, lilyAnims, state, triggerDrama } = useDramaDirector(ALL_SCRIPTS, logoBounds);
  const tysonBrandColor = lighten(theme.primary, 0.25);
  const lilyBrandColor = theme.accent;
  const lastScreenRef = useRef<string | null>(null);
  const hasTriggeredInitialRef = useRef(false);

  // Fire screenEnter when screen changes. On Login, prefer to wait for logo bounds so Lily uses measured logo position.
  useEffect(() => {
    if (!currentScreen) return;

    const screenChanged = currentScreen !== lastScreenRef.current;
    if (screenChanged) {
      lastScreenRef.current = currentScreen;
      hasTriggeredInitialRef.current = false;
    }

    if (currentScreen !== 'Login') {
      if (screenChanged) {
        hasTriggeredInitialRef.current = true;
        triggerDrama('screenEnter', currentScreen);
      }
      return;
    }

    if (hasTriggeredInitialRef.current) return;
    if (logoBounds) {
      hasTriggeredInitialRef.current = true;
      triggerDrama('screenEnter', 'Login');
      return;
    }
    const t = setTimeout(() => {
      if (lastScreenRef.current !== 'Login' || hasTriggeredInitialRef.current) return;
      hasTriggeredInitialRef.current = true;
      triggerDrama('screenEnter', 'Login');
    }, 400);
    return () => clearTimeout(t);
  }, [currentScreen, logoBounds, triggerDrama]);

  // Fallback: if no screen has registered, fire Login intro after layout is ready.
  // Delay so useWindowDimensions() has real values (avoids 0,0 and stuck/invisible drama).
  useEffect(() => {
    if (hasTriggeredInitialRef.current) return;
    const t = setTimeout(() => {
      if (hasTriggeredInitialRef.current) return;
      hasTriggeredInitialRef.current = true;
      lastScreenRef.current = 'Login';
      triggerDrama('screenEnter', 'Login');
    }, 350);
    return () => clearTimeout(t);
  }, [triggerDrama]);

  // Forward input events from screens
  useEffect(() => {
    if (!lastEvent) return;
    triggerDrama(lastEvent.trigger, lastEvent.screen);
  }, [lastEvent, triggerDrama]);

  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'visible' }]} pointerEvents="none">
      <BubbleActor
        gender={TYSON_CONFIG.gender}
        brandColor={tysonBrandColor}
        anims={tysonAnims}
        state={state.tyson}
        characterName={TYSON_CONFIG.name}
      />
      <BubbleActor
        gender={LILY_CONFIG.gender}
        brandColor={lilyBrandColor}
        anims={lilyAnims}
        state={state.lily}
        characterName={LILY_CONFIG.name}
      />
    </View>
  );
};
