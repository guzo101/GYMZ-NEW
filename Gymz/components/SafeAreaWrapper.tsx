/**
 * SafeAreaWrapper - Ensures all content respects device safe areas
 * 
 * This component provides consistent safe area handling across all screens.
 * It prevents content from overlapping with:
 * - Status bar / notch at the top
 * - Navigation bar / gesture area at the bottom
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SafeAreaWrapperProps {
  children: React.ReactNode;
  /**
   * If true, applies safe area padding to top (default: true)
   */
  top?: boolean;
  /**
   * If true, applies safe area padding to bottom (default: true)
   */
  bottom?: boolean;
  /**
   * If true, applies safe area padding to left/right (default: false)
   */
  horizontal?: boolean;
  /**
   * Additional style to apply
   */
  style?: ViewStyle;
  /**
   * Background color for the wrapper
   */
  backgroundColor?: string;
}

export function SafeAreaWrapper({
  children,
  top = true,
  bottom = true,
  horizontal = false,
  style,
  backgroundColor,
}: SafeAreaWrapperProps) {
  const insets = useSafeAreaInsets();

  const paddingStyle: ViewStyle = {
    paddingTop: top ? insets.top : 0,
    paddingBottom: bottom ? insets.bottom : 0,
    paddingLeft: horizontal ? insets.left : 0,
    paddingRight: horizontal ? insets.right : 0,
  };

  return (
    <View
      style={[
        styles.container,
        paddingStyle,
        backgroundColor && { backgroundColor },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
