import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Image,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { designSystem } from '../theme/designSystem';
import { useTheme } from '../hooks/useTheme';
import { ScreenHeader } from '../components/ScreenHeader';
import { DynamicBackground } from '../components/dashboard/DynamicBackground';
import { useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';
import { supabase } from '../services/supabase';
import { DataMapper } from '../utils/dataMapper';

import { stepTrackingService } from '../services/stepTrackingService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
const BUILD_DATE = process.env.EXPO_PUBLIC_BUILD_DATE;
const VERSION_DISPLAY = BUILD_DATE
  ? `Version ${APP_VERSION} (Build ${BUILD_DATE})`
  : `Version ${APP_VERSION}`;

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { user, logout, deleteAccount } = useAuth();
  const { isDark, toggleTheme, theme } = useTheme();
  const [profile, setProfile] = React.useState<any>(null);
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [sessionReminders, setSessionReminders] = React.useState(true);
  const [stepTrackingEnabled, setStepTrackingEnabled] = React.useState(true);
  const [loading, setLoading] = React.useState(true);
  const [deleteModalVisible, setDeleteModalVisible] = React.useState(false);
  const [deleteStep, setDeleteStep] = React.useState<1 | 2>(1);
  const [deleteConfirmText, setDeleteConfirmText] = React.useState('');

  React.useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('users')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (error) throw error;
      if (data) {
        const mappedData = DataMapper.fromDb<any>(data);
        setProfile(mappedData);
        setNotificationsEnabled(mappedData.notifCheckin ?? true);
        setSessionReminders(mappedData.notifSessionReminders ?? true);

        // Load step tracking state from service
        const stepEnabled = await stepTrackingService.isTrackingEnabled();
        setStepTrackingEnabled(stepEnabled);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: string, value: boolean) => {
    try {
      const { error } = await (supabase as any)
        .from('users')
        .update(DataMapper.toDb({ [key]: value }))
        .eq('id', user?.id);
      if (error) throw error;
    } catch (err) {
      console.error(`Error updating ${key}:`, err);
      Alert.alert('Error', 'Failed to save setting.');
    }
  };

  const handleToggleNotifications = (val: boolean) => {
    setNotificationsEnabled(val);
    updateSetting('notifCheckin', val);
  };

  const handleToggleReminders = (val: boolean) => {
    setSessionReminders(val);
    updateSetting('notifSessionReminders', val);
  };

  const handleToggleStepTracking = async (val: boolean) => {
    setStepTrackingEnabled(val);
    await stepTrackingService.setTrackingEnabled(val);
  };

  const styles = createStyles(theme, isDark);

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to logout?');
      if (confirmed) logout();
      return;
    }
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: logout },
      ]
    );
  };

  const openDeleteModal = () => {
    setDeleteStep(1);
    setDeleteConfirmText('');
    setDeleteModalVisible(true);
  };

  const closeDeleteModal = () => {
    setDeleteModalVisible(false);
    setDeleteStep(1);
    setDeleteConfirmText('');
  };

  const performDeletion = async () => {
    const { success, message: msg } = await deleteAccount();
    closeDeleteModal();
    if (Platform.OS === 'web') {
      alert(success ? msg : `Error: ${msg}`);
    } else {
      Alert.alert(success ? 'Account Deleted' : 'Notice', msg);
    }
  };

  const handleDeleteAccount = () => {
    if (Platform.OS === 'web') {
      const step1 = 'Before you go...\n\n' +
        '• You will lose ALL your fitness progress and workout history\n' +
        '• Your nutrition logs and meal tracking will be permanently erased\n' +
        '• Your achievements, badges, and streaks will be gone forever\n' +
        '• Your AI chat history and personalized recommendations will be deleted\n' +
        '• Your membership and subscription data will be removed\n\n' +
        'This cannot be undone. Are you sure you want to continue?';
      if (!window.confirm(step1)) return;
      const step2 = 'Final confirmation: This is your last chance. Your account and all data will be permanently deleted. Type DELETE to confirm.';
      const typed = window.prompt(step2);
      if (typed?.trim().toUpperCase() === 'DELETE') {
        deleteAccount().then(({ success, message: msg }) =>
          alert(success ? msg : `Error: ${msg}`)
        );
      }
      return;
    }
    openDeleteModal();
  };

  const handleDeleteStep1Continue = () => setDeleteStep(2);
  const handleDeleteStep2Confirm = () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      Alert.alert('Incorrect', 'Please type DELETE exactly to confirm.');
      return;
    }
    performDeletion();
  };

  const SettingsSection = ({ title, children }: any) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>
        {children}
      </View>
    </View>
  );

  const SettingItem = ({ icon, label, value, onPress, isDestructive, rightElement }: any) => (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.settingIconContainer}>
        <MaterialCommunityIcons
          name={icon}
          size={22}
          color={isDestructive ? '#EF4444' : theme.primary}
        />
      </View>
      <View style={styles.settingTextContainer}>
        <Text style={[styles.settingLabel, isDestructive && styles.destructiveText]}>{label}</Text>
        {value && <Text style={styles.settingValue}>{value}</Text>}
      </View>
      {rightElement || (onPress && (
        <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textMuted} />
      ))}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <DynamicBackground rotationType="fixed" fixedIndex={7} />
      <ScreenHeader title="Settings" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <LinearGradient
          colors={isDark ? ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)'] : ['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.02)']}
          style={styles.profileCard}
        >
          <View style={styles.avatarContainer}>
            {profile?.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} />
            ) : (
              <LinearGradient
                colors={designSystem.colors.gradients.primary}
                style={styles.avatarGradient}
              >
                <Text style={styles.avatarText}>
                  {user?.name?.substring(0, 2).toUpperCase() || 'GU'}
                </Text>
              </LinearGradient>
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile?.name || user?.name || 'User'}</Text>
            <Text style={styles.profileEmail}>{user?.email || 'email@example.com'}</Text>
            <View style={styles.badgeContainer}>
              <LinearGradient
                colors={profile?.membershipType === 'PRO' ? ['#F59E0B', '#D97706'] : ['#9CA3AF', '#4B5563']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.badge}
              >
                <MaterialCommunityIcons name={profile?.membershipType === 'PRO' ? "star" : "account"} size={12} color="#FFF" />
                <Text style={styles.badgeText}>{profile?.membershipType || 'FREE'} MEMBER</Text>
              </LinearGradient>
            </View>
          </View>
        </LinearGradient>

        <SettingsSection title="Preferences">
          <SettingItem
            icon="theme-light-dark"
            label="Dark Mode"
            rightElement={
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: '#767577', true: theme.primary }}
                thumbColor={isDark ? '#FFF' : '#f4f3f4'}
              />
            }
          />
          <View style={styles.separator} />
          <SettingItem
            icon="bell-ring-outline"
            label="Push Notifications"
            rightElement={
              <Switch
                value={notificationsEnabled}
                onValueChange={handleToggleNotifications}
                trackColor={{ false: '#374151', true: theme.primary }}
                thumbColor="#FFF"
              />
            }
          />
          <View style={styles.separator} />
          <SettingItem
            icon="calendar-clock"
            label="Session Reminders"
            rightElement={
              <Switch
                value={sessionReminders}
                onValueChange={handleToggleReminders}
                trackColor={{ false: '#374151', true: theme.primary }}
                thumbColor="#FFF"
              />
            }
          />
          <View style={styles.separator} />
          <SettingItem
            icon="shoe-print"
            label="Step Tracking"
            rightElement={
              <Switch
                value={stepTrackingEnabled}
                onValueChange={handleToggleStepTracking}
                trackColor={{ false: '#374151', true: theme.primary }}
                thumbColor="#FFF"
              />
            }
          />
        </SettingsSection>

        <SettingsSection title="Account">
          <SettingItem
            icon="account-edit-outline"
            label="Edit Profile"
            onPress={() => navigation.navigate('EditProfile')}
          />
          <View style={styles.separator} />
          <SettingItem
            icon="swap-horizontal"
            label="Switch Gym"
            onPress={() => Alert.alert("Coming Soon")}
          />
          <View style={styles.separator} />
          <SettingItem
            icon="shield-lock-outline"
            label="Privacy & Security"
            onPress={() => navigation.navigate('PrivacyPolicy')}
          />
          <View style={styles.separator} />
          <SettingItem
            icon="credit-card-outline"
            label="Subscription & Billing"
            onPress={() => navigation.navigate('Payments')}
          />
          <View style={styles.separator} />
          <SettingItem
            icon="account-remove-outline"
            label="Delete Account"
            onPress={handleDeleteAccount}
            isDestructive
          />
        </SettingsSection>

        <SettingsSection title="Support">
          <SettingItem
            icon="help-circle-outline"
            label="Help Center"
            onPress={() => navigation.navigate('HelpCenter')}
          />
          <View style={styles.separator} />
          <SettingItem
            icon="file-document-outline"
            label="Terms & Conditions"
            onPress={() => navigation.navigate('TermsOfService')}
          />
        </SettingsSection>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LinearGradient
            colors={['rgba(239, 68, 68, 0.2)', 'rgba(239, 68, 68, 0.1)']}
            style={styles.logoutGradient}
          >
            <MaterialCommunityIcons name="logout" size={20} color="#EF4444" />
            <Text style={styles.logoutText}>Log Out</Text>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.versionText}>{VERSION_DISPLAY}</Text>
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Delete Account Modal - Two-step flow with psychological friction */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeDeleteModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDark && styles.modalContentDark]}>
            {/* Step indicator */}
            <View style={styles.modalStepIndicator}>
              <View style={[styles.modalStepDot, deleteStep >= 1 && styles.modalStepDotActive]} />
              <View style={[styles.modalStepLine, deleteStep >= 2 && styles.modalStepLineActive]} />
              <View style={[styles.modalStepDot, deleteStep >= 2 && styles.modalStepDotActive]} />
            </View>
            <Text style={styles.modalStepLabel}>Step {deleteStep} of 2</Text>

            {deleteStep === 1 ? (
              <>
                <View style={styles.modalIconWrapper}>
                  <MaterialCommunityIcons name="account-alert-outline" size={56} color="#EF4444" />
                </View>
                <Text style={styles.modalTitle}>Before You Go</Text>
                <Text style={styles.modalSubtitle}>
                  Deleting your account will permanently remove all your data. You will lose:
                </Text>
                <View style={styles.painPointsList}>
                  <View style={styles.painPointRow}>
                    <MaterialCommunityIcons name="dumbbell" size={18} color={theme.textMuted} style={styles.painPointIcon} />
                    <Text style={styles.painPoint}>Fitness progress and workout history</Text>
                  </View>
                  <View style={styles.painPointRow}>
                    <MaterialCommunityIcons name="food-apple-outline" size={18} color={theme.textMuted} style={styles.painPointIcon} />
                    <Text style={styles.painPoint}>Nutrition logs and meal tracking</Text>
                  </View>
                  <View style={styles.painPointRow}>
                    <MaterialCommunityIcons name="trophy-outline" size={18} color={theme.textMuted} style={styles.painPointIcon} />
                    <Text style={styles.painPoint}>Achievements, badges, and streaks</Text>
                  </View>
                  <View style={styles.painPointRow}>
                    <MaterialCommunityIcons name="robot-outline" size={18} color={theme.textMuted} style={styles.painPointIcon} />
                    <Text style={styles.painPoint}>AI chat history and recommendations</Text>
                  </View>
                  <View style={styles.painPointRow}>
                    <MaterialCommunityIcons name="credit-card-outline" size={18} color={theme.textMuted} style={styles.painPointIcon} />
                    <Text style={styles.painPoint}>Membership and subscription data</Text>
                  </View>
                </View>
                <View style={styles.modalWarningBox}>
                  <MaterialCommunityIcons name="alert" size={18} color="#EF4444" />
                  <Text style={styles.modalWarning}>This action cannot be undone.</Text>
                </View>
                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.modalButtonSecondary} onPress={closeDeleteModal} activeOpacity={0.8}>
                    <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalButtonPrimary} onPress={handleDeleteStep1Continue} activeOpacity={0.8}>
                    <LinearGradient
                      colors={designSystem.colors.gradients.primary}
                      style={styles.modalButtonPrimaryGradient}
                    >
                      <Text style={styles.modalButtonPrimaryText}>Continue</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={styles.modalIconWrapper}>
                  <MaterialCommunityIcons name="account-remove-outline" size={56} color="#EF4444" />
                </View>
                <Text style={styles.modalTitle}>Final Confirmation</Text>
                <Text style={styles.modalSubtitle}>
                  This is your last chance. Type <Text style={styles.modalSubtitleBold}>DELETE</Text> below to permanently delete your account.
                </Text>
                <TextInput
                  style={[styles.deleteConfirmInput, isDark && styles.deleteConfirmInputDark]}
                  placeholder="Type DELETE"
                  placeholderTextColor={theme.textMuted}
                  value={deleteConfirmText}
                  onChangeText={setDeleteConfirmText}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                <View style={styles.modalButtonsStep2}>
                  <TouchableOpacity style={styles.modalButtonSecondary} onPress={() => setDeleteStep(1)} activeOpacity={0.8}>
                    <Text style={styles.modalButtonSecondaryText}>Back</Text>
                  </TouchableOpacity>
                  {deleteConfirmText.trim().toUpperCase() === 'DELETE' ? (
                    <TouchableOpacity
                      style={styles.modalButtonDestructive}
                      onPress={handleDeleteStep2Confirm}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={['#DC2626', '#B91C1C']}
                        style={styles.modalButtonDestructiveGradient}
                      >
                        <MaterialCommunityIcons name="delete-forever" size={20} color="#FFF" />
                        <Text style={styles.modalButtonDestructiveText}>Delete</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.modalButtonDestructiveDisabled}>
                      <Text style={styles.modalButtonDestructiveTextDisabled}>Delete</Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  scrollContent: {
    padding: 24,
    paddingTop: Platform.OS === 'android' ? 20 : 20, // Adjusted padding since Header handles top spacing
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
    marginBottom: 32,
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatarGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 8,
  },
  badgeContainer: {
    flexDirection: 'row',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textMuted,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionContent: {
    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.8)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'transparent',
  },
  settingIconContainer: {
    width: 32,
    alignItems: 'center',
    marginRight: 12,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: theme.text,
    fontWeight: '500',
  },
  settingValue: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 2,
  },
  destructiveText: {
    color: '#EF4444',
  },
  separator: {
    height: 1,
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    marginLeft: 60,
  },
  logoutButton: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    overflow: 'hidden',
    marginTop: 8,
  },
  logoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: 'bold',
  },
  versionText: {
    textAlign: 'center',
    color: theme.textMuted,
    fontSize: 12,
    marginTop: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
      },
      android: { elevation: 12 },
    }),
  },
  modalContentDark: {
    backgroundColor: 'rgba(28, 31, 38, 0.98)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalStepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  modalStepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
  },
  modalStepDotActive: {
    backgroundColor: theme.primary,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  modalStepLine: {
    width: 32,
    height: 2,
    backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
    marginHorizontal: 6,
  },
  modalStepLineActive: {
    backgroundColor: theme.primary,
  },
  modalStepLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textMuted,
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  modalIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 15,
    color: theme.textSecondary,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalSubtitleBold: {
    fontWeight: '700',
    color: theme.text,
  },
  painPointsList: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  painPointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  painPointIcon: {
    marginRight: 12,
  },
  painPoint: {
    flex: 1,
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
  modalWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    marginBottom: 24,
  },
  modalWarning: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  modalButtonsStep2: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  modalButtonSecondary: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
  },
  modalButtonSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  modalButtonPrimary: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  modalButtonPrimaryGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonPrimaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  modalButtonDestructive: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  modalButtonDestructiveGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  modalButtonDestructiveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  modalButtonDestructiveDisabled: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: isDark ? 'rgba(107, 114, 128, 0.35)' : 'rgba(0,0,0,0.08)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)',
  },
  modalButtonDestructiveTextDisabled: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textMuted,
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  deleteConfirmInput: {
    borderWidth: 2,
    borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    color: theme.text,
    marginBottom: 24,
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 2,
  },
  deleteConfirmInputDark: {
    borderColor: 'rgba(255,255,255,0.15)',
  },
});
