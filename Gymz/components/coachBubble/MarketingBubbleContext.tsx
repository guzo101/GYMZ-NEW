/**
 * Context for screens to communicate with the marketing bubble.
 * Allows screens to trigger behaviors like input focus, form progress, errors, etc.
 */

import React, { createContext, useContext, useRef, ReactNode } from 'react';

export interface MarketingBubbleContextValue {
  setFocusedInput: (input: 'email' | 'password' | 'name' | 'confirmPassword' | null) => void;
  setFormProgress: (progress: number) => void;
  setHasError: (hasError: boolean) => void;
  setIsTyping: (isTyping: boolean) => void;
  triggerCelebration: () => void;
}

const MarketingBubbleContext = createContext<{
  registerCallbacks: (callbacks: MarketingBubbleContextValue) => void;
} | null>(null);

export function MarketingBubbleProvider({ children }: { children: ReactNode }) {
  const callbacksRef = useRef<MarketingBubbleContextValue | null>(null);

  const registerCallbacks = (callbacks: MarketingBubbleContextValue) => {
    callbacksRef.current = callbacks;
  };

  const value = {
    registerCallbacks,
    getCallbacks: () => callbacksRef.current,
  };

  return (
    <MarketingBubbleContext.Provider value={value as any}>
      {children}
    </MarketingBubbleContext.Provider>
  );
}

export function useMarketingBubble() {
  const context = useContext(MarketingBubbleContext);
  if (!context) {
    // Return no-op functions if context is not available (not in marketing mode)
    return {
      setFocusedInput: () => {},
      setFormProgress: () => {},
      setHasError: () => {},
      setIsTyping: () => {},
      triggerCelebration: () => {},
    };
  }
  
  // Get current callbacks from the bubble component
  const getCallbacks = (context as any).getCallbacks;
  const callbacks = getCallbacks?.() || {
    setFocusedInput: () => {},
    setFormProgress: () => {},
    setHasError: () => {},
    setIsTyping: () => {},
    triggerCelebration: () => {},
  };
  
  return callbacks;
}

export function useMarketingBubbleRegistration() {
  const context = useContext(MarketingBubbleContext);
  return context?.registerCallbacks || (() => {});
}
