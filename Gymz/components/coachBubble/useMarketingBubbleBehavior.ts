/**
 * Hook to manage marketing bubble behaviors based on current screen and user interactions.
 * Detects screen context and provides appropriate behaviors, phrases, and animations.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  getLoginPhrase,
  getSignupPhrase,
  getGymSelectionPhrase,
  getAccessModePhrase,
  getSubscriptionPhrase,
  getCalibrationPhrase,
  getTransitionPhrase,
} from './marketingPhrases';

export type MarketingScreen =
  | 'Login'
  | 'Signup'
  | 'GymSelection'
  | 'AccessModeSelection'
  | 'SubscriptionPlans'
  | 'HealthMetrics'
  | 'EmailVerification'
  | 'ResetPassword';

export interface MarketingBehaviorState {
  screen: MarketingScreen | null;
  speechText: string | null;
  expression: 'curious' | 'excited' | 'encouraging' | 'celebrating' | 'privacy' | 'idle';
  shouldPeek: boolean;
  shouldRunAway: boolean;
  shouldCelebrate: boolean;
  shouldGuide: boolean;
  guideTarget: { x: number; y: number } | null;
  animationType: 'peek' | 'slide' | 'bounce' | 'celebration' | 'runAway' | null;
  fromEdge: 'top' | 'right' | 'left' | 'bottom' | null;
}

export interface MarketingInteractionState {
  focusedInput: 'email' | 'password' | 'name' | 'confirmPassword' | null;
  formProgress: number; // 0-1
  hasError: boolean;
  isTyping: boolean;
  lastInteractionTime: number;
}

export function useMarketingBubbleBehavior(
  marketingMode: boolean,
  navigationRef?: any,
  externalState?: {
    focusedInput?: MarketingInteractionState['focusedInput'];
    formProgress?: number;
    hasError?: boolean;
    isTyping?: boolean;
    shouldCelebrate?: boolean;
  }
): {
  behaviorState: MarketingBehaviorState;
  interactionState: MarketingInteractionState;
  setFocusedInput: (input: MarketingInteractionState['focusedInput']) => void;
  setFormProgress: (progress: number) => void;
  setHasError: (hasError: boolean) => void;
  setIsTyping: (isTyping: boolean) => void;
  triggerCelebration: () => void;
  triggerScreenTransition: (newScreen: MarketingScreen) => void;
} {
  // In marketing mode, use navigationRef instead of useNavigation hook
  // Create a navigation-like object from the ref
  const navigation = marketingMode && navigationRef ? {
    getState: () => {
      try {
        return navigationRef.getState();
      } catch (error) {
        return null;
      }
    },
    addListener: (event: string, callback: () => void) => {
      // NavigationContainer ref doesn't have addListener, so we'll poll instead
      return () => {}; // No-op cleanup
    },
  } : null;
  const [behaviorState, setBehaviorState] = useState<MarketingBehaviorState>({
    screen: null,
    speechText: null,
    expression: 'idle',
    shouldPeek: false,
    shouldRunAway: false,
    shouldCelebrate: false,
    shouldGuide: false,
    guideTarget: null,
    animationType: null,
    fromEdge: null,
  });

  const [interactionState, setInteractionState] = useState<MarketingInteractionState>({
    focusedInput: externalState?.focusedInput ?? null,
    formProgress: externalState?.formProgress ?? 0,
    hasError: externalState?.hasError ?? false,
    isTyping: externalState?.isTyping ?? false,
    lastInteractionTime: Date.now(),
  });

  // Sync external state changes
  useEffect(() => {
    if (externalState) {
      setInteractionState(prev => ({
        ...prev,
        focusedInput: externalState.focusedInput ?? prev.focusedInput,
        formProgress: externalState.formProgress ?? prev.formProgress,
        hasError: externalState.hasError ?? prev.hasError,
        isTyping: externalState.isTyping ?? prev.isTyping,
        lastInteractionTime: Date.now(),
      }));
    }
  }, [externalState?.focusedInput, externalState?.formProgress, externalState?.hasError, externalState?.isTyping]);

  // Handle external celebration trigger - will be handled below after triggerCelebration is defined

  const previousScreenRef = useRef<MarketingScreen | null>(null);
  const peekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect current screen using navigation ref
  const detectScreen = useCallback((): MarketingScreen | null => {
    if (!marketingMode || !navigationRef) return null;
    
    try {
      if (!navigationRef.isReady()) return null;
      
      const state = navigationRef.getState();
      if (!state || !state.routes || state.routes.length === 0) return null;
      
      // Get the current route from navigation state
      const currentRoute = state.routes[state.index ?? state.routes.length - 1];
      const routeName = currentRoute?.name as string;
      
      const validScreens: MarketingScreen[] = [
        'Login',
        'Signup',
        'GymSelection',
        'AccessModeSelection',
        'SubscriptionPlans',
        'HealthMetrics',
        'EmailVerification',
        'ResetPassword',
      ];
      
      if (validScreens.includes(routeName as MarketingScreen)) {
        return routeName as MarketingScreen;
      }
      
      return null;
    } catch (error) {
      // Navigation state not available yet
      return null;
    }
  }, [marketingMode, navigationRef]);

  // Initialize screen behavior
  const initializeScreenBehavior = useCallback((screen: MarketingScreen) => {
    const isNewScreen = previousScreenRef.current !== screen;
    previousScreenRef.current = screen;

    // Clear previous timers
    if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
    if (speechTimerRef.current) clearTimeout(speechTimerRef.current);

    let speechText: string | null = null;
    let animationType: MarketingBehaviorState['animationType'] = null;
    let fromEdge: MarketingBehaviorState['fromEdge'] = null;
    let expression: MarketingBehaviorState['expression'] = 'idle';

    switch (screen) {
      case 'Login':
        speechText = getLoginPhrase('initialPeek');
        animationType = 'peek';
        fromEdge = 'top';
        expression = 'curious';
        // Delay peek by 1.5s
        peekTimerRef.current = setTimeout(() => {
          setBehaviorState((prev) => ({
            ...prev,
            shouldPeek: true,
            speechText,
            animationType,
            fromEdge,
            expression,
          }));
        }, 1500);
        break;

      case 'Signup':
        speechText = getSignupPhrase('initialEntrance');
        animationType = 'slide';
        fromEdge = 'left';
        expression = 'excited';
        setBehaviorState({
          screen,
          speechText,
          expression,
          shouldPeek: false,
          shouldRunAway: false,
          shouldCelebrate: false,
          shouldGuide: false,
          guideTarget: null,
          animationType,
          fromEdge,
        });
        break;

      case 'GymSelection':
        speechText = getGymSelectionPhrase('initialEntrance');
        animationType = 'slide';
        fromEdge = 'bottom';
        expression = 'excited';
        setBehaviorState({
          screen,
          speechText,
          expression,
          shouldPeek: false,
          shouldRunAway: false,
          shouldCelebrate: false,
          shouldGuide: false,
          guideTarget: null,
          animationType,
          fromEdge,
        });
        break;

      case 'AccessModeSelection':
        speechText = getAccessModePhrase('initialPeek');
        animationType = 'peek';
        fromEdge = 'right';
        expression = 'curious';
        setBehaviorState({
          screen,
          speechText,
          expression,
          shouldPeek: true,
          shouldRunAway: false,
          shouldCelebrate: false,
          shouldGuide: false,
          guideTarget: null,
          animationType,
          fromEdge,
        });
        break;

      case 'SubscriptionPlans':
        speechText = getSubscriptionPhrase('initialEntrance');
        animationType = 'slide';
        fromEdge = 'left';
        expression = 'encouraging';
        setBehaviorState({
          screen,
          speechText,
          expression,
          shouldPeek: false,
          shouldRunAway: false,
          shouldCelebrate: false,
          shouldGuide: false,
          guideTarget: null,
          animationType,
          fromEdge,
        });
        break;

      case 'HealthMetrics':
        speechText = getCalibrationPhrase('initialGrandEntrance');
        animationType = 'celebration';
        fromEdge = 'bottom';
        expression = 'excited';
        setBehaviorState({
          screen,
          speechText,
          expression,
          shouldPeek: false,
          shouldRunAway: false,
          shouldCelebrate: true,
          shouldGuide: false,
          guideTarget: null,
          animationType,
          fromEdge,
        });
        break;

      default:
        setBehaviorState({
          screen,
          speechText: null,
          expression: 'idle',
          shouldPeek: false,
          shouldRunAway: false,
          shouldCelebrate: false,
          shouldGuide: false,
          guideTarget: null,
          animationType: null,
          fromEdge: null,
        });
    }

    // Auto-hide speech after 5 seconds
    if (speechText) {
      speechTimerRef.current = setTimeout(() => {
        setBehaviorState((prev) => ({ ...prev, speechText: null }));
      }, 5000);
    }
  }, []);

  // Handle screen changes - poll navigation state periodically
  useEffect(() => {
    if (!marketingMode || !navigationRef?.current) return;

    // Check initial screen
    const checkScreen = () => {
      const currentScreen = detectScreen();
      if (currentScreen && currentScreen !== behaviorState.screen) {
        initializeScreenBehavior(currentScreen);
      }
    };

    // Initial check
    checkScreen();

    // Poll for screen changes (since we can't use navigation listeners outside navigator)
    const intervalId = setInterval(checkScreen, 500);

    return () => {
      clearInterval(intervalId);
    };
  }, [marketingMode, navigationRef, detectScreen, behaviorState.screen, initializeScreenBehavior]);

  // Handle password input (privacy mode)
  useEffect(() => {
    if (!marketingMode) return;

    if (interactionState.focusedInput === 'password' || interactionState.focusedInput === 'confirmPassword') {
      setBehaviorState((prev) => ({
        ...prev,
        shouldRunAway: true,
        expression: 'privacy',
        speechText: getLoginPhrase('passwordTyping'),
        animationType: 'runAway',
      }));

      // Return to normal after a delay
      const timer = setTimeout(() => {
        setBehaviorState((prev) => ({
          ...prev,
          shouldRunAway: false,
          expression: prev.screen === 'Login' ? 'curious' : 'encouraging',
          animationType: null,
        }));
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [interactionState.focusedInput, marketingMode]);

  // Handle form errors
  useEffect(() => {
    if (!marketingMode) return;

    if (interactionState.hasError) {
      const errorPhrase =
        behaviorState.screen === 'Login'
          ? getLoginPhrase('formError')
          : getSignupPhrase('validationError');

      setBehaviorState((prev) => ({
        ...prev,
        speechText: errorPhrase,
        expression: 'encouraging',
      }));
    }
  }, [interactionState.hasError, behaviorState.screen, marketingMode]);

  // Handle form progress milestones (Signup)
  useEffect(() => {
    if (!marketingMode || behaviorState.screen !== 'Signup') return;

    const progress = interactionState.formProgress;
    if (progress >= 0.25 && progress < 0.5) {
      setBehaviorState((prev) => ({
        ...prev,
        speechText: getSignupPhrase('progressMilestones'),
        expression: 'encouraging',
      }));
    } else if (progress >= 0.5 && progress < 0.75) {
      setBehaviorState((prev) => ({
        ...prev,
        speechText: getSignupPhrase('progressMilestones'),
        expression: 'encouraging',
      }));
    } else if (progress >= 0.75 && progress < 1) {
      setBehaviorState((prev) => ({
        ...prev,
        speechText: getSignupPhrase('progressMilestones'),
        expression: 'excited',
      }));
    } else if (progress >= 1) {
      setBehaviorState((prev) => ({
        ...prev,
        speechText: getSignupPhrase('formComplete'),
        expression: 'celebrating',
        shouldCelebrate: true,
      }));
    }
  }, [interactionState.formProgress, behaviorState.screen, marketingMode]);

  // Handle inactivity
  useEffect(() => {
    if (!marketingMode) return;

    const checkInactivity = () => {
      const timeSinceInteraction = Date.now() - interactionState.lastInteractionTime;
      if (timeSinceInteraction > 5000 && behaviorState.speechText === null) {
        const inactivityPhrase =
          behaviorState.screen === 'Login'
            ? getLoginPhrase('inactivity')
            : getSignupPhrase('formComplete');

        setBehaviorState((prev) => ({
          ...prev,
          speechText: inactivityPhrase,
          expression: 'encouraging',
        }));
      }
    };

    inactivityTimerRef.current = setTimeout(checkInactivity, 5000);
    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [interactionState.lastInteractionTime, behaviorState.screen, behaviorState.speechText, marketingMode]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
    };
  }, []);

  // Public API
  const setFocusedInput = useCallback((input: MarketingInteractionState['focusedInput']) => {
    setInteractionState((prev) => ({
      ...prev,
      focusedInput: input,
      isTyping: input !== null,
      lastInteractionTime: Date.now(),
    }));
  }, []);

  const setFormProgress = useCallback((progress: number) => {
    setInteractionState((prev) => ({
      ...prev,
      formProgress: Math.max(0, Math.min(1, progress)),
      lastInteractionTime: Date.now(),
    }));
  }, []);

  const setHasError = useCallback((hasError: boolean) => {
    setInteractionState((prev) => ({
      ...prev,
      hasError,
      lastInteractionTime: Date.now(),
    }));
  }, []);

  const setIsTyping = useCallback((isTyping: boolean) => {
    setInteractionState((prev) => ({
      ...prev,
      isTyping,
      lastInteractionTime: Date.now(),
    }));
  }, []);

  const triggerCelebration = useCallback(() => {
    setBehaviorState((prev) => ({
      ...prev,
      shouldCelebrate: true,
      expression: 'celebrating',
      animationType: 'celebration',
    }));
  }, []);

  // Handle external celebration trigger
  useEffect(() => {
    if (externalState?.shouldCelebrate) {
      triggerCelebration();
    }
  }, [externalState?.shouldCelebrate, triggerCelebration]);

  const triggerScreenTransition = useCallback((newScreen: MarketingScreen) => {
    const transitionPhrase = getTransitionPhrase('screenChange');
    setBehaviorState((prev) => ({
      ...prev,
      speechText: transitionPhrase,
      expression: 'excited',
    }));
    initializeScreenBehavior(newScreen);
  }, [initializeScreenBehavior]);

  return {
    behaviorState,
    interactionState,
    setFocusedInput,
    setFormProgress,
    setHasError,
    setIsTyping,
    triggerCelebration,
    triggerScreenTransition,
  };
}
