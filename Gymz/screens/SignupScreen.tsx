import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { designSystem } from '../theme/designSystem';
import { DataMapper } from '../utils/dataMapper';

export default function SignupScreen({ navigation, route }: any) {
    const { login, beginAuthOperation, endAuthOperation } = useAuth();
    const { gymId: initialGymId } = route.params || {};
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Form State
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [agreed, setAgreed] = useState(false);
    const [marketingConsent, setMarketingConsent] = useState(true);

    const [error, setError] = useState('');

    // Auth screens always use the app default bright theme
    const brightTheme = designSystem.colors.light;

    const SIGNUP_TIMEOUT_MS = 30000; // 30s - signup + profile polling can take longer than login

    const handleSignup = async () => {
        console.log('[Signup] handleSignup triggered');
        setError('');

        if (!firstName || !lastName || !email || !password || !confirmPassword || !agreed) {
            setError('Please fill in all required fields.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        beginAuthOperation();
        setLoading(true);

        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Signup timed out. Please check your connection and try again.')), SIGNUP_TIMEOUT_MS)
        );

        try {
            const signupProcess = async () => {
            console.log('[Signup] Step 1: signUp');
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: email.trim(),
                password,
                options: {
                    emailRedirectTo: undefined, // Don't use magic link
                    data: DataMapper.toDb({
                        firstName: firstName,
                        lastName: lastName,
                        name: `${firstName} ${lastName}`.trim(),
                        gymId: initialGymId || null, // Pass the gymId picked from "Browse Gyms" or null for neutral onboarding
                        marketingConsent: marketingConsent,
                        marketingConsentDate: marketingConsent ? new Date().toISOString() : null,
                    })
                }
            });

            if (authError) {
              console.error('[Signup] authError:', authError);
              throw authError;
            }
            console.log('[Signup] Step 2: auth OK, user id:', authData?.user?.id);

            if (authData.user && authData.user.id) {
                if (!authData.session) {
                    setLoading(false);
                    endAuthOperation(); // Clear — we're not calling login()

                    const navigateToVerification = () => {
                        navigation.navigate('EmailVerification', {
                            email: email.trim(),
                            password,
                        });
                    };

                    if (Platform.OS === 'web') {
                        // On web, just go. Alerts are often blocked or annoying.
                        navigateToVerification();
                    } else {
                        Alert.alert(
                            'Confirm Email',
                            'We have sent a 6-digit verification code to your email. Please enter it on the next screen to continue.',
                            [{ text: 'OK', onPress: navigateToVerification }]
                        );
                    }
                    return;
                }

                const userId = authData.user.id;
                const userEmail = email.trim();

                // 2. VERIFY: Wait for database trigger to create the public.users record
                let verifiedUser = null;
                let attempts = 0;
                let lastPollError: string | null = null;

                while (!verifiedUser && attempts < 10) {
                    const { data, error } = await (supabase as any)
                        .from('users')
                        .select('*')
                        .eq('id', userId)
                        .maybeSingle();

                    if (data) {
                        verifiedUser = DataMapper.fromDb(data);
                        break;
                    }
                    if (error) {
                        lastPollError = error.message || String(error);
                        const isNetworkError = /failed to fetch|network request failed|timeout|connection refused/i.test(lastPollError ?? '');
                        if (isNetworkError) {
                            throw new Error('Please check your connection and try again.');
                        }
                        // RLS or other DB error - surface it
                        throw new Error(lastPollError ?? 'Profile verification failed.');
                    }
                    await new Promise(r => setTimeout(r, 1000));
                    attempts++;
                }

                if (!verifiedUser) {
                    throw new Error(lastPollError ?? 'Your profile is being created. Please try logging in in a moment.');
                }

                console.log('[Signup] User successfully verified:', verifiedUser.id);

                await login({
                    id: verifiedUser.id,
                    email: verifiedUser.email,
                    name: verifiedUser.name,
                    firstName: verifiedUser.firstName,
                    lastName: verifiedUser.lastName,
                    role: verifiedUser.role,
                    status: verifiedUser.status || 'active',
                    membershipStatus: verifiedUser.membershipStatus || 'New',
                    avatarUrl: verifiedUser.avatarUrl,
                    phone: verifiedUser.phone,
                    uniqueId: verifiedUser.uniqueId,
                    isCalibrated: false
                } as any);
            }
            };

            await Promise.race([signupProcess(), timeoutPromise]);
        } catch (error: any) {
            console.error('[Signup Error]', error);
            endAuthOperation();
            const msg = (error.message || '').toLowerCase();
            const isAccountExists =
                msg.includes('already registered') ||
                msg.includes('user already exists') ||
                msg.includes('already exists') ||
                msg.includes('email already') ||
                (error?.code && String(error.code).toLowerCase().includes('already'));

            if (isAccountExists) {
                navigation.navigate('Login', {
                    email: email.trim(),
                    password,
                    fromDuplicateSignup: true,
                });
            } else {
                const isNetworkError = /failed to fetch|network request failed|timeout|connection refused|check your connection/i.test(msg);
                const displayMsg = isNetworkError
                    ? 'Please check your connection and try again.'
                    : (error.message || 'An unexpected error occurred during signup.');
                setError(displayMsg);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: brightTheme.background }]}>
            <LinearGradient
                colors={designSystem.colors.gradients.backgroundLight}
                style={styles.background}
            />

            {/* Decorative Blobs */}
            <View style={[styles.glow1, { backgroundColor: 'rgba(42, 75, 42, 0.12)' }]} pointerEvents="none" />
            <View style={[styles.glow2, { backgroundColor: 'rgba(241, 201, 59, 0.08)' }]} pointerEvents="none" />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView 
                    contentContainerStyle={[styles.scrollContent, { paddingTop: Platform.OS === 'ios' ? 24 : 16, paddingBottom: 24 }]} 
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: brightTheme.backgroundInput, borderColor: brightTheme.border }]}>
                            <MaterialCommunityIcons name="arrow-left" size={28} color={brightTheme.text} />
                        </TouchableOpacity>
                        <View style={styles.headerTextContainer}>
                            <Text style={[styles.title, { color: brightTheme.text }]} numberOfLines={1} adjustsFontSizeToFit>Create Account</Text>
                            <Text style={[styles.subtitle, { color: brightTheme.textMuted }]} numberOfLines={1}>Start your fitness transformation</Text>
                        </View>
                    </View>

                    {/* Form */}
                    <View style={styles.formContainer}>
                        <View style={styles.inputGroup}>
                            <Text style={[styles.inputLabel, { color: brightTheme.textSecondary }]}>About You</Text>
                            <View style={styles.nameRow}>
                                <View style={[styles.nameInputWrapper, { backgroundColor: brightTheme.backgroundInput, borderColor: brightTheme.border }]}>
                                    <MaterialCommunityIcons 
                                        name="account-outline" 
                                        size={20} 
                                        color={brightTheme.primary} 
                                        style={styles.fieldIcon} 
                                    />
                                    <TextInput
                                        style={[styles.nameInput, { color: brightTheme.text }]}
                                        placeholder="First Name"
                                        placeholderTextColor={brightTheme.textMuted}
                                        value={firstName}
                                        onChangeText={setFirstName}
                                        textAlign="left"
                                        returnKeyType="next"
                                        autoCorrect={false}
                                    />
                                </View>
                                <View style={[styles.nameInputWrapper, { backgroundColor: brightTheme.backgroundInput, borderColor: brightTheme.border }]}>
                                    <MaterialCommunityIcons 
                                        name="account-outline" 
                                        size={20} 
                                        color={brightTheme.primary} 
                                        style={styles.fieldIcon} 
                                    />
                                    <TextInput
                                        style={[styles.nameInput, { color: brightTheme.text }]}
                                        placeholder="Last Name"
                                        placeholderTextColor={brightTheme.textMuted}
                                        value={lastName}
                                        onChangeText={setLastName}
                                        textAlign="left"
                                        returnKeyType="done"
                                        autoCorrect={false}
                                    />
                                </View>
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={[styles.inputLabel, { color: brightTheme.textSecondary }]}>Credentials</Text>
                            <View style={[styles.fieldWrapper, { backgroundColor: brightTheme.backgroundInput, borderColor: brightTheme.border }]}>
                                <MaterialCommunityIcons name="email-outline" size={20} color={brightTheme.primary} style={styles.fieldIcon} />
                                <TextInput
                                    style={[styles.input, { color: brightTheme.text }]}
                                    placeholder="Email Address"
                                    placeholderTextColor={brightTheme.textMuted}
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <View style={[styles.fieldWrapper, { backgroundColor: brightTheme.backgroundInput, borderColor: brightTheme.border }]}>
                                <MaterialCommunityIcons name="lock-outline" size={20} color={brightTheme.primary} style={styles.fieldIcon} />
                                <TextInput
                                    style={[styles.input, { flex: 1, color: brightTheme.text }]}
                                    placeholder="Password"
                                    placeholderTextColor={brightTheme.textMuted}
                                    secureTextEntry={!showPassword}
                                    value={password}
                                    onChangeText={setPassword}
                                />
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                                    <MaterialCommunityIcons name={showPassword ? "eye" : "eye-off"} size={22} color={brightTheme.primary} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <View style={[styles.fieldWrapper, { backgroundColor: brightTheme.backgroundInput, borderColor: brightTheme.border }]}>
                                <MaterialCommunityIcons name="lock-check-outline" size={20} color={brightTheme.primary} style={styles.fieldIcon} />
                                <TextInput
                                    style={[styles.input, { color: brightTheme.text }]}
                                    placeholder="Confirm Password"
                                    placeholderTextColor={brightTheme.textMuted}
                                    secureTextEntry={!showPassword}
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                />
                            </View>
                        </View>


                        <TouchableOpacity
                            style={styles.checkboxWrapper}
                            onPress={() => setMarketingConsent(!marketingConsent)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.checkbox, { borderColor: brightTheme.primary }, marketingConsent && { backgroundColor: brightTheme.primary }]}>
                                {marketingConsent && <MaterialCommunityIcons name="check" size={20} color="#fff" />}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.checkboxLabel, { color: brightTheme.textSecondary }]}>
                                    ✨ Yes! Send me <Text style={[styles.highlight, { color: brightTheme.accent }]}>exclusive discounts, promotions & special offers</Text>
                                </Text>
                                <Text style={[styles.checkboxSubtext, { color: brightTheme.textMuted }]}>
                                    Get early access to deals and never miss a limited-time offer
                                </Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.checkboxWrapper, { marginTop: 12 }]}
                            onPress={() => setAgreed(!agreed)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.checkbox, { borderColor: brightTheme.primary }, agreed && { backgroundColor: brightTheme.primary }]}>
                                {agreed && <MaterialCommunityIcons name="check" size={20} color="#fff" />}
                            </View>
                            <Text style={[styles.checkboxLabel, { color: brightTheme.textSecondary }]}>
                                I agree to the <Text style={[styles.highlight, { color: brightTheme.accent }]}>Terms & Conditions</Text>
                            </Text>
                        </TouchableOpacity>

                        {error ? (
                            <View style={[styles.errorContainer, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                                <MaterialCommunityIcons name="alert-circle-outline" size={20} color={brightTheme.error} />
                                <Text style={[styles.errorText, { color: brightTheme.error }]}>{error}</Text>
                            </View>
                        ) : null}

                        <TouchableOpacity
                            style={styles.submitBtn}
                            onPress={handleSignup}
                            disabled={loading}
                        >
                            <LinearGradient
                                colors={['#2A4B2A', '#F1C93B']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.submitBtnGradient}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <>
                                        <Text style={styles.submitBtnText}>Create Account</Text>
                                        <MaterialCommunityIcons name="arrow-right" size={22} color="#fff" />
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.footer}>
                            <Text style={[styles.footerText, { color: brightTheme.textMuted }]}>
                                Already have an account? <Text style={{ color: brightTheme.accent, fontWeight: 'bold' }}>Log in</Text>
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#050B05',
    },
    keyboardView: {
        flex: 1,
    },
    background: {
        ...StyleSheet.absoluteFillObject,
    },
    glow1: {
        position: 'absolute',
        width: 600,
        height: 600,
        borderRadius: 300,
        backgroundColor: 'rgba(42, 75, 42, 0.15)',
        top: -200,
        left: -200,
        zIndex: -1,
    },
    glow2: {
        position: 'absolute',
        width: 500,
        height: 500,
        borderRadius: 250,
        backgroundColor: 'rgba(241, 190, 50, 0.08)', // Refined for better web rendering
        bottom: -100,
        right: -100,
        zIndex: -1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 35,
    },
    backBtn: {
        width: 50,
        height: 50,
        borderRadius: 15,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    headerTextContainer: {
        flex: 1,
    },
    title: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#fff',
        letterSpacing: 0.5,
    },
    subtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.5)',
        marginTop: 2,
    },
    formContainer: {
        gap: 18,
    },
    inputGroup: {
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.7)',
        marginBottom: 8,
        marginLeft: 4,
    },
    nameRow: {
        flexDirection: 'row',
        gap: 8,
    },
    nameInputWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(10, 18, 10, 0.8)',
        borderWidth: 1,
        borderColor: 'rgba(42, 75, 42, 0.2)',
        borderRadius: 16,
        height: 60,
        overflow: 'hidden',
        position: 'relative',
        minWidth: 0,
    },
    nameInput: {
        flex: 1,
        height: '100%',
        color: '#fff',
        fontSize: 16,
        paddingHorizontal: 16,
        paddingLeft: 44,
        textAlignVertical: 'center',
        includeFontPadding: false,
        ...Platform.select({
            web: {
                outlineStyle: 'none',
                boxSizing: 'border-box',
                border: 'none',
                background: 'transparent',
            } as any,
            android: {
                textAlignVertical: 'center',
            }
        })
    },
    fieldWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(10, 18, 10, 0.8)',
        borderWidth: 1,
        borderColor: 'rgba(42, 75, 42, 0.2)',
        borderRadius: 16,
        paddingLeft: 16,
        height: 60,
        overflow: 'hidden',
    },
    fieldIcon: {
        position: 'absolute',
        left: 12,
        zIndex: 1,
    },
    input: {
        flex: 1,
        height: '100%',
        color: '#fff',
        fontSize: 16,
        paddingRight: 16,
        paddingLeft: 32,
        textAlignVertical: 'center',
        includeFontPadding: false,
        ...Platform.select({
            web: {
                outlineStyle: 'none',
                boxSizing: 'border-box',
                border: 'none',
                background: 'transparent',
            } as any,
            android: {
                textAlignVertical: 'center',
            }
        })
    },
    eyeIcon: {
        position: 'absolute',
        right: 12,
        padding: 8,
        zIndex: 10,
    },
    checkboxWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 5,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderWidth: 2,
        borderColor: '#2A4B2A',
        borderRadius: 6,
        marginRight: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxChecked: {
        backgroundColor: '#2A4B2A',
    },
    checkboxLabel: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 14,
        lineHeight: 20,
    },
    checkboxSubtext: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 11,
        marginLeft: 34,
        marginTop: 2,
        lineHeight: 16,
    },
    highlight: {
        color: '#F1C93B',
        fontWeight: 'bold',
    },
    submitBtn: {
        marginTop: 15,
        height: 65,
        borderRadius: 18,
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#2A4B2A',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3,
                shadowRadius: 10,
            },
            android: {
                elevation: 6,
            },
        }),
    },
    submitBtnGradient: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
    },
    submitBtnText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    footer: {
        marginTop: 15,
        alignItems: 'center',
        paddingBottom: 20,
    },
    footerText: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 14,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 75, 75, 0.1)',
        padding: 12,
        borderRadius: 12,
        marginBottom: 10,
        gap: 8,
    },
    errorText: {
        color: '#FF4B4B',
        fontSize: 14,
        flex: 1,
    },
});
