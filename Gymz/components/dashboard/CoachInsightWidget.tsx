import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useCoachInsight } from '../../contexts/CoachInsightContext';
import { getCoachInsight } from './CoachInsightCard';
import { useNavigation } from '@react-navigation/native';

const SHOW_AFTER_MS = 5000; // Show widget 5s after dashboard has loaded payload

export function CoachInsightWidget() {
  const insightContext = useCoachInsight();
  const payload = insightContext?.payload ?? null;
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const [visible, setVisible] = useState(false);
  const [insight, setInsight] = useState<{ text: string; icon: string; action: { route: string; params?: any } } | null>(null);
  const slideAnim = useRef(new Animated.Value(120)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissedForPayloadRef = useRef<any>(null);

  useEffect(() => {
    if (!payload) return;
    if (dismissedForPayloadRef.current === payload) return;
    setInsight(getCoachInsight(payload));
    timerRef.current = setTimeout(() => {
      setVisible(true);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 18,
          stiffness: 120,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }, SHOW_AFTER_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [payload]);

  const handleDismiss = () => {
    dismissedForPayloadRef.current = payload;
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 120,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
    });
  };

  const handlePress = () => {
    if (insight?.action?.route) {
      handleDismiss();
      navigation.navigate(insight.action.route, insight.action.params);
    }
  };

  if (!visible || !insight) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        {
          opacity: opacityAnim,
          transform: [{ translateX: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={handlePress}
        style={[
          styles.card,
          {
            backgroundColor: isDark ? 'rgba(30,40,30,0.98)' : 'rgba(255,255,255,0.98)',
            borderColor: theme.primary + '40',
          },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: theme.primary + '25' }]}>
          <MaterialCommunityIcons name={insight.icon as any} size={18} color={theme.primary} />
        </View>
        <Text style={[styles.label, { color: theme.textMuted }]}>COACH</Text>
        <Text style={[styles.text, { color: theme.text }]} numberOfLines={2}>
          {insight.text}
        </Text>
        <TouchableOpacity
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={handleDismiss}
          style={styles.closeWrap}
        >
          <MaterialCommunityIcons name="close" size={16} color={theme.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 100,
    right: 12,
    left: 12,
    alignItems: 'flex-end',
    zIndex: 9999,
  },
  card: {
    maxWidth: 320,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 36,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  closeWrap: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 4,
  },
});
