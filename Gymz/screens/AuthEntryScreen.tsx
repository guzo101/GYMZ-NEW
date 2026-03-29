import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { GymzLogo } from '../components/GymzLogo';
import { useDramaBridge } from '../components/coachBubble/drama/DramaBridgeContext';
import { useTheme } from '../hooks/useTheme';
import { designSystem } from '../theme/designSystem';
import { getAuthLogoLayout, getScale, SPACE } from '../utils/authScreenLogoLayout';

export default function AuthEntryScreen({ navigation }: any) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  useTheme(); // keep provider subscription
  // Auth entry always uses the app default bright theme (no dark/system override)
  const theme = designSystem.colors.light;
  const isDark = false;
  const { setCurrentScreen } = useDramaBridge();

  const scale = getScale(width, height);
  const s = (n: number) => Math.round(n * scale);
  const authLogo = getAuthLogoLayout(width, height, insets);
  const paddingH = s(SPACE.lg);
  const paddingTop = s(SPACE.lg);
  const paddingBottom = s(SPACE.md);
  const logoSize = authLogo.logoSize;
  const taglineMarginTop = s(SPACE.xs);
  const poweredByMarginTop = s(SPACE.sm);
  const buttonsMarginTop = s(SPACE.xxl);
  const buttonGap = s(SPACE.md);
  const browseGymsMarginTop = s(SPACE.xl);

  useEffect(() => {
    setCurrentScreen('AuthEntry');
    return () => setCurrentScreen(null);
  }, [setCurrentScreen]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={
          isDark
            ? ['#020402', '#040704', '#030503']
            : [
                theme.primaryLight || '#E8EFE8',
                '#D0DDD0',
                theme.background || '#F8FAFC',
              ]
        }
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.decorativeBlob1} />
      <View style={styles.decorativeBlob2} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: paddingH,
            paddingTop,
            paddingBottom,
            flexGrow: 1,
            justifyContent: 'center',
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandingSection}>
          <View style={{ padding: authLogo.logoPaddingPx }}>
            <GymzLogo
              size={logoSize}
              imageStyle={{ width: logoSize, height: logoSize, marginBottom: s(SPACE.xs) } as any}
            />
          </View>
          <Text
            style={[styles.tagline, { marginTop: taglineMarginTop, color: theme.primary }]}
            numberOfLines={1}
          >
            Results start with what you eat. Track it.
          </Text>
          <View style={[styles.poweredByRow, { marginTop: poweredByMarginTop }]}>
            <Text
              style={[
                styles.poweredBy,
                { color: isDark ? 'rgba(255, 255, 255, 0.3)' : theme.textMuted },
              ]}
              numberOfLines={1}
            >
              Powered by AI ✨
            </Text>
          </View>
        </View>

        <View style={[styles.buttonsBlock, { marginTop: buttonsMarginTop }]}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={isDark ? ['#1A2E1A', '#C5A028'] : ['#2A4B2A', '#F1C93B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryButtonGradient}
            >
              <Text style={styles.primaryButtonText}>Log in</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.secondaryButton,
              {
                marginTop: buttonGap,
                borderColor: theme.primary,
                backgroundColor: theme.backgroundCard || (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.9)'),
              },
            ]}
            onPress={() => navigation.navigate('Signup')}
            activeOpacity={0.85}
          >
            <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>
              Create an account
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tertiaryLink, { marginTop: browseGymsMarginTop }]}
            onPress={() => navigation.navigate('GymSelection')}
          >
            <Text style={[styles.tertiaryLinkText, { color: theme.textMuted }]}>
              Browse Gyms
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  decorativeBlob1: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(42, 75, 42, 0.04)',
    top: -150,
    right: -150,
  },
  decorativeBlob2: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(197, 160, 40, 0.03)',
    bottom: -100,
    left: -100,
  },
  scrollContent: {
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    minWidth: 0,
  },
  brandingSection: {
    alignItems: 'center',
  },
  tagline: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'System', android: 'SamsungOne', default: 'System' }),
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 22,
  },
  poweredByRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  poweredBy: {
    fontSize: 12,
    fontWeight: '500',
    fontStyle: 'italic',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    letterSpacing: 1,
  },
  buttonsBlock: {
    width: '100%',
    alignSelf: 'center',
  },
  primaryButton: {
    borderRadius: 14,
    overflow: 'hidden',
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#2A4B2A',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 10,
        }
      : Platform.OS === 'android'
        ? { elevation: 5 }
        : { boxShadow: '0px 0px 8px rgba(42, 75, 42, 0.3)' } as any),
  },
  primaryButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: 'bold',
  },
  secondaryButton: {
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  tertiaryLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  tertiaryLinkText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
