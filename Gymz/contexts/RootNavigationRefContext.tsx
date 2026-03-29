import React, { createContext, useContext } from 'react';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RootNavigationRef = NavigationContainerRefWithCurrent<any> | null;

const RootNavigationRefContext = createContext<RootNavigationRef>(null);

export function useRootNavigationRef() {
  return useContext(RootNavigationRefContext);
}

export const RootNavigationRefProvider = RootNavigationRefContext.Provider;
