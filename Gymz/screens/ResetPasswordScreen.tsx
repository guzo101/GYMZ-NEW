import React, { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Alert,
    useWindowDimensions,
    InteractionManager,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../services/supabase";
import { designSystem as theme } from "../theme/designSystem";
import { GymzLogo } from "../components/GymzLogo";

/**
 * Reset Password Flow - Rebuilt from scratch
 * 
 * Explicit step-driven flow:
 * 1. request_code - User enters email, requests reset code
 * 2. verify_code - User enters 6-digit code from email
 * 3. set_new_password - User sets new password
 * 4. success - Success confirmation screen
 * 
 * Each step transition happens immediately on verified success condition.
 * No hidden state, no side effects, no race conditions.
 */

type ResetPasswordStep = 'request_code' | 'verify_code' | 'set_new_password' | 'success';

// Component instance counter to detect remounts
let componentInstanceId = 0;

export default function ResetPasswordScreen({ navigation, route }: any) {
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    
    // Track component instance
    const [instanceId] = useState(() => {
        componentInstanceId++;
        const id = componentInstanceId;
        console.log(`[ResetPasswordScreen] Component instance created: #${id}`);
        return id;
    });

    // SINGLE SOURCE OF TRUTH: Current step in the flow
    // CRITICAL: Initialize from route params if available (survives remounts)
    // Otherwise use email param to determine initial step
    const [step, setStep] = useState<ResetPasswordStep>(() => {
        // Check if step is persisted in route params (survives navigator remount)
        if (route.params?.step && ['request_code', 'verify_code', 'set_new_password', 'success'].includes(route.params.step)) {
            console.log(`[ResetPasswordScreen] Instance #${instanceId} - Step from route params:`, route.params.step);
            return route.params.step as ResetPasswordStep;
        }
        // Otherwise determine from email param
        const initialStep = route.params?.email ? 'verify_code' : 'request_code';
        console.log(`[ResetPasswordScreen] Instance #${instanceId} - Initial step:`, initialStep, 'route.params:', route.params);
        return initialStep;
    });

    // Form state
    const [email, setEmail] = useState(route.params?.email || "");
    const [otp, setOtp] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    
    // Force render trigger - use this to force React to re-render if needed
    const [renderTrigger, setRenderTrigger] = useState(0);
    
    // Ref to track step value directly (bypasses React state for debugging)
    const stepRef = useRef<ResetPasswordStep>(step);
    
    // Keep ref in sync with state
    useEffect(() => {
        stepRef.current = step;
        console.log(`[ResetPasswordScreen] Instance #${instanceId} stepRef updated to:`, step);
    }, [step, instanceId]);
    
    // CRITICAL: Listen for route param changes (handles remounts)
    useEffect(() => {
        if (route.params?.step && route.params.step !== step) {
            const paramStep = route.params.step as ResetPasswordStep;
            console.log(`[ResetPasswordScreen] Instance #${instanceId} Route params changed - restoring step:`, paramStep);
            setStep(paramStep);
            stepRef.current = paramStep;
        }
    }, [route.params?.step, instanceId]);

    // Action state - one loading/error per action
    const [requestLoading, setRequestLoading] = useState(false);
    const [requestError, setRequestError] = useState("");
    
    const [verifyLoading, setVerifyLoading] = useState(false);
    const [verifyError, setVerifyError] = useState("");
    
    const [updateLoading, setUpdateLoading] = useState(false);
    const [updateError, setUpdateError] = useState("");

    // Initialize: Check session for deep link flow
    // This ONLY runs on mount and ONLY if starting from request_code
    useEffect(() => {
        const initialStep = route.params?.email ? 'verify_code' : 'request_code';
        console.log('[ResetPasswordScreen] Mount effect - initialStep:', initialStep, 'route.params?.email:', route.params?.email);
        
        // Only check session if we're starting fresh (request_code step)
        if (initialStep === 'request_code') {
            const checkSession = async () => {
                const { data: { session } } = await supabase.auth.getSession();
                console.log('[ResetPasswordScreen] Initial session check:', { hasSession: !!session });
                if (session) {
                    // Session exists - user came from deep link, go directly to set_new_password
                    console.log('[ResetPasswordScreen] Session found on mount, moving to set_new_password');
                    // Persist in navigation params to survive remounts
                    navigation.setParams({ step: 'set_new_password' });
                    setStep('set_new_password');
                }
            };
            checkSession();
        }
    }, []); // Run once on mount only - DO NOT add step to deps

    // Debug logging - track ALL state changes
    useEffect(() => {
        console.log(`[ResetPasswordScreen] Instance #${instanceId} ===== STEP CHANGED =====`);
        console.log(`[ResetPasswordScreen] Instance #${instanceId} New step:`, step);
        console.log(`[ResetPasswordScreen] Instance #${instanceId} Current loading states:`, { requestLoading, verifyLoading, updateLoading });
        console.log(`[ResetPasswordScreen] Instance #${instanceId} Current errors:`, { requestError, verifyError, updateError });
        console.log(`[ResetPasswordScreen] Instance #${instanceId} Will render step:`, step);
    }, [step, requestLoading, verifyLoading, updateLoading, requestError, verifyError, updateError, instanceId]);
    
    // Track component mount/unmount
    const isMountedRef = useRef(true);
    useEffect(() => {
        console.log(`[ResetPasswordScreen] Instance #${instanceId} MOUNTED`);
        isMountedRef.current = true;
        return () => {
            console.log(`[ResetPasswordScreen] Instance #${instanceId} UNMOUNTED`);
            isMountedRef.current = false;
        };
    }, [instanceId]);

    /**
     * Step 1: Request Reset Code
     * User enters email, we send reset code
     * On success: Move to verify_code immediately
     */
    const handleRequestCode = async () => {
        if (!email.trim()) {
            setRequestError("Email is required.");
            return;
        }

        setRequestLoading(true);
        setRequestError("");

        try {
            console.log('[ResetPasswordScreen] Requesting reset code for:', email);
            
            const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                redirectTo: 'gymz://reset-password'
            });

            if (error) {
                console.error('[ResetPasswordScreen] Reset code request error:', error);
                throw error;
            }

            console.log('[ResetPasswordScreen] Reset code requested successfully');
            console.log('[ResetPasswordScreen] Transitioning: request_code -> verify_code');
            
            // SUCCESS: Move to verify_code immediately
            // Persist in navigation params to survive remounts
            navigation.setParams({ step: 'verify_code', email: email.trim() });
            setStep('verify_code');
            setRequestError("");
        } catch (err) {
            console.error('[ResetPasswordScreen] Request code failed:', err);
            setRequestError(err instanceof Error ? err.message : "Failed to send reset code.");
        } finally {
            setRequestLoading(false);
        }
    };

    /**
     * Step 2: Verify Code
     * User enters 6-digit code
     * On success: Move to set_new_password immediately
     */
    const handleVerifyCode = async () => {
        if (!email.trim() || !otp.trim()) {
            setVerifyError("Email and code are required.");
            return;
        }

        setVerifyLoading(true);
        setVerifyError("");

        try {
            console.log('[ResetPasswordScreen] Verifying code...', { email, codeLength: otp.length });
            
            // CRITICAL: Set global flag to prevent useAuth from interfering with recovery session
            (global as any).__inPasswordReset = true;
            
            const { data, error } = await supabase.auth.verifyOtp({
                email: email.trim(),
                token: otp.trim(),
                type: 'recovery',
            });

            if (error) {
                console.error('[ResetPasswordScreen] Code verification error:', error);
                throw error;
            }

            console.log('[ResetPasswordScreen] Code verified successfully:', { userId: data?.user?.id });

            // Verify session was established
            const { data: { session } } = await supabase.auth.getSession();
            
            if (!session) {
                // Wait briefly for session to propagate, then check again
                await new Promise(resolve => setTimeout(resolve, 500));
                const { data: { session: retrySession } } = await supabase.auth.getSession();
                
                if (!retrySession) {
                    throw new Error("Session could not be established. Please try again.");
                }
            }

            console.log(`[ResetPasswordScreen] Instance #${instanceId} Session confirmed`);
            console.log(`[ResetPasswordScreen] Instance #${instanceId} ===== TRANSITIONING =====`);
            console.log(`[ResetPasswordScreen] Instance #${instanceId} Current step BEFORE setStep:`, step);
            console.log(`[ResetPasswordScreen] Instance #${instanceId} Calling setStep("set_new_password") NOW`);
            
            // CRITICAL: Clear loading FIRST, then set step
            // This ensures the UI is ready to render the new step
            setVerifyLoading(false);
            setVerifyError("");
            setOtp(""); // Clear code field
            
            // SUCCESS: Move to set_new_password immediately
            console.log(`[ResetPasswordScreen] Instance #${instanceId} About to update step to set_new_password`);
            console.log(`[ResetPasswordScreen] Instance #${instanceId} Component mounted:`, isMountedRef.current);
            
            // CRITICAL FIX: Component may unmount due to navigator remount when user state changes
            // Persist step in navigation params so it survives remounts
            console.log(`[ResetPasswordScreen] Instance #${instanceId} About to update step to set_new_password`);
            console.log(`[ResetPasswordScreen] Instance #${instanceId} Component mounted:`, isMountedRef.current);
            
            // CRITICAL: Update navigation params FIRST - this persists across remounts
            navigation.setParams({ step: 'set_new_password', email: email.trim() });
            console.log(`[ResetPasswordScreen] Instance #${instanceId} Navigation params updated with step: set_new_password`);
            
            // Update ref immediately
            stepRef.current = 'set_new_password';
            console.log(`[ResetPasswordScreen] Instance #${instanceId} stepRef.current = set_new_password`);
            
            // Clear loading and errors
            setVerifyLoading(false);
            setVerifyError("");
            setOtp("");
            
            // Update state - even if component unmounts, params will restore it
            setStep('set_new_password');
            setRenderTrigger(prev => prev + 1);
            
            console.log(`[ResetPasswordScreen] Instance #${instanceId} State updated: step='set_new_password'`);
            console.log(`[ResetPasswordScreen] Instance #${instanceId} If component remounts, step will be restored from navigation params`);
            
            // Also try using flushSync if available (React 18+)
            // But for now, let's use a state update trigger
        } catch (err) {
            console.error('[ResetPasswordScreen] Verify code failed:', err);
            setVerifyError(err instanceof Error ? err.message : "Invalid or expired code.");
            setVerifyLoading(false); // Clear loading on error
        }
        // Note: Loading is cleared in success path BEFORE setStep
    };

    /**
     * Step 3: Set New Password
     * User enters and confirms new password
     * On success: Move to success immediately
     */
    const handleSetNewPassword = async () => {
        if (password !== confirmPassword) {
            setUpdateError("Passwords do not match.");
            return;
        }
        if (password.length < 6) {
            setUpdateError("Password must be at least 6 characters.");
            return;
        }

        setUpdateLoading(true);
        setUpdateError("");

        try {
            console.log('[ResetPasswordScreen] Updating password...');
            
            // Verify we have a session
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new Error("No active session. Please verify your code again.");
            }
            console.log('[ResetPasswordScreen] Session exists:', { 
                userId: session.user?.id, 
                email: session.user?.email,
                expiresAt: session.expires_at 
            });
            
            const { error } = await supabase.auth.updateUser({
                password: password,
            });

            if (error) {
                console.error('[ResetPasswordScreen] Password update error:', error);
                // Check if it's the "password must be different" error
                if (error.message?.includes('different from the old password')) {
                    // This shouldn't happen during recovery - session might not be recovery type
                    console.error('[ResetPasswordScreen] CRITICAL: Password update rejected - session may not be recovery type');
                    console.error('[ResetPasswordScreen] Session details:', { 
                        hasSession: !!session,
                        userId: session?.user?.id 
                    });
                    throw new Error("Password reset session expired or invalid. Please request a new reset code.");
                }
                throw error;
            }

            console.log('[ResetPasswordScreen] Password updated successfully');
            console.log('[ResetPasswordScreen] Transitioning: set_new_password -> success');
            
            // Clear password reset flag - recovery session is no longer needed
            (global as any).__inPasswordReset = false;
            
            // SUCCESS: Move to success immediately
            // Persist in navigation params
            navigation.setParams({ step: 'success' });
            setStep('success');
            setUpdateError("");
        } catch (err) {
            console.error('[ResetPasswordScreen] Set password failed:', err);
            setUpdateError(err instanceof Error ? err.message : "Unable to update password.");
        } finally {
            setUpdateLoading(false);
        }
    };

    /**
     * Handle Back to Login
     * Signs out and navigates to login
     */
    const handleBackToLogin = async () => {
        // Clear password reset flag
        (global as any).__inPasswordReset = false;
        await supabase.auth.signOut();
        navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
        });
    };

    const maxWidth = Math.min(width - 48, 500);

    // Render based on step - explicit, deterministic
    if (step === 'success') {
        return (
            <View style={styles.container}>
                <LinearGradient
                    colors={['#050B05', '#0A120A', '#080F08']}
                    style={styles.backgroundGradient}
                />
                <View style={styles.successContainer}>
                    <View style={styles.successIcon}>
                        <Text style={styles.successIconText}>✓</Text>
                    </View>
                    <Text style={styles.title}>Password Updated</Text>
                    <Text style={styles.subtitle}>You can now log in with your new password.</Text>
                    <TouchableOpacity
                        style={styles.button}
                        onPress={handleBackToLogin}
                    >
                        <LinearGradient
                            colors={['#2A4B2A', '#F1C93B']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.buttonGradient}
                        >
                            <Text style={styles.buttonText}>Back to Login</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.container}
                keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
            >
                <LinearGradient
                    colors={['#050B05', '#0A120A', '#080F08']}
                    style={styles.backgroundGradient}
                />

                <View style={styles.decorativeBlob1} />
                <View style={styles.decorativeBlob2} />

                <ScrollView
                    contentContainerStyle={[
                        styles.scrollContent,
                        {
                            paddingHorizontal: 24,
                            paddingTop: insets.top + 8,
                            paddingBottom: Math.max(insets.bottom, 12),
                        }
                    ]}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={{ maxWidth, alignSelf: 'center', width: '100%' }}>
                        <View style={styles.header}>
                            <GymzLogo
                                size={80}
                                imageStyle={styles.logoImage}
                            />
                        </View>

                        <View style={styles.formCard} key={`reset-password-form-${step}`}>
                            <View style={styles.formHeader}>
                                <Text style={styles.formTitle}>
                                    {step === 'request_code' && "Reset Password"}
                                    {step === 'verify_code' && "Verify Code"}
                                    {step === 'set_new_password' && "Set New Password"}
                                </Text>
                                <Text style={styles.formSubtitle}>
                                    {step === 'request_code' && "Enter your email to receive a reset code."}
                                    {step === 'verify_code' && "Enter the 6-digit code from your email."}
                                    {step === 'set_new_password' && "Create a secure password for your account."}
                                </Text>
                            </View>

                            <View style={styles.formContent}>
                                {/* RENDER DEBUG */}
                                {(() => {
                                    const currentStep = step;
                                    const refStep = stepRef.current;
                                    console.log(`[ResetPasswordScreen] Instance #${instanceId} ===== RENDER =====`);
                                    console.log(`[ResetPasswordScreen] Instance #${instanceId} RENDER - step state:`, currentStep);
                                    console.log(`[ResetPasswordScreen] Instance #${instanceId} RENDER - stepRef.current:`, refStep);
                                    console.log(`[ResetPasswordScreen] Instance #${instanceId} RENDER - renderTrigger:`, renderTrigger);
                                    console.log(`[ResetPasswordScreen] Instance #${instanceId} RENDER - Will show:`, 
                                        currentStep === 'request_code' ? 'REQUEST_CODE form' :
                                        currentStep === 'verify_code' ? 'VERIFY_CODE form' :
                                        currentStep === 'set_new_password' ? 'SET_NEW_PASSWORD form' :
                                        'UNKNOWN'
                                    );
                                    console.log(`[ResetPasswordScreen] Instance #${instanceId} RENDER - Loading states:`, { verifyLoading, updateLoading });
                                    console.log(`[ResetPasswordScreen] Instance #${instanceId} RENDER - step === 'set_new_password':`, currentStep === 'set_new_password');
                                    return null;
                                })()}
                                
                                {/* STEP 1: Request Code */}
                                {step === 'request_code' && (
                                    <>
                                        <View style={styles.inputGroup}>
                                            <Text style={styles.label}>Email Address</Text>
                                            <View style={styles.inputWrapper}>
                                                <MaterialCommunityIcons
                                                    name="email-outline"
                                                    size={22}
                                                    color="#2A4B2A"
                                                    style={styles.inputIcon}
                                                />
                                                <TextInput
                                                    style={styles.input}
                                                    placeholder="name@example.com"
                                                    placeholderTextColor="rgba(255, 255, 255, 0.3)"
                                                    keyboardType="email-address"
                                                    autoCapitalize="none"
                                                    value={email}
                                                    onChangeText={(text) => {
                                                        setEmail(text);
                                                        setRequestError("");
                                                    }}
                                                    editable={!requestLoading}
                                                />
                                            </View>
                                        </View>

                                        {requestError ? (
                                            <Text style={styles.errorText}>{requestError}</Text>
                                        ) : null}

                                        <TouchableOpacity
                                            style={[styles.button, requestLoading && styles.buttonDisabled]}
                                            onPress={handleRequestCode}
                                            disabled={requestLoading}
                                        >
                                            <LinearGradient
                                                colors={['#2A4B2A', '#F1C93B']}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 0 }}
                                                style={styles.buttonGradient}
                                            >
                                                {requestLoading ? (
                                                    <ActivityIndicator color="#fff" />
                                                ) : (
                                                    <Text style={styles.buttonText}>Send Reset Code</Text>
                                                )}
                                            </LinearGradient>
                                        </TouchableOpacity>
                                    </>
                                )}

                                {/* STEP 2: Verify Code */}
                                {(() => {
                                    const shouldShowVerify = step === 'verify_code';
                                    if (shouldShowVerify) {
                                        console.log(`[ResetPasswordScreen] Instance #${instanceId} RENDERING VERIFY_CODE form`);
                                    }
                                    return shouldShowVerify;
                                })() && (
                                    <>
                                        <View style={styles.inputGroup}>
                                            <Text style={styles.label}>Email Address</Text>
                                            <View style={styles.inputWrapper}>
                                                <MaterialCommunityIcons
                                                    name="email-outline"
                                                    size={22}
                                                    color="#2A4B2A"
                                                    style={styles.inputIcon}
                                                />
                                                <TextInput
                                                    style={styles.input}
                                                    placeholder="name@example.com"
                                                    placeholderTextColor="rgba(255, 255, 255, 0.3)"
                                                    keyboardType="email-address"
                                                    autoCapitalize="none"
                                                    value={email}
                                                    onChangeText={(text) => {
                                                        setEmail(text);
                                                        setVerifyError("");
                                                    }}
                                                    editable={!verifyLoading}
                                                />
                                            </View>
                                        </View>

                                        <View style={styles.inputGroup}>
                                            <Text style={styles.label}>6-Digit Code</Text>
                                            <View style={styles.inputWrapper}>
                                                <MaterialCommunityIcons
                                                    name="lock-outline"
                                                    size={22}
                                                    color="#2A4B2A"
                                                    style={styles.inputIcon}
                                                />
                                                <TextInput
                                                    style={[styles.input, styles.otpInput]}
                                                    placeholder="123456"
                                                    placeholderTextColor="rgba(255, 255, 255, 0.3)"
                                                    keyboardType="number-pad"
                                                    maxLength={6}
                                                    value={otp}
                                                    onChangeText={(text) => {
                                                        setOtp(text);
                                                        setVerifyError("");
                                                    }}
                                                    editable={!verifyLoading}
                                                />
                                            </View>
                                        </View>

                                        {verifyError ? (
                                            <Text style={styles.errorText}>{verifyError}</Text>
                                        ) : null}

                                        <TouchableOpacity
                                            style={[styles.button, verifyLoading && styles.buttonDisabled]}
                                            onPress={handleVerifyCode}
                                            disabled={verifyLoading}
                                        >
                                            <LinearGradient
                                                colors={['#2A4B2A', '#F1C93B']}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 0 }}
                                                style={styles.buttonGradient}
                                            >
                                                {verifyLoading ? (
                                                    <ActivityIndicator color="#fff" />
                                                ) : (
                                                    <Text style={styles.buttonText}>Verify Code</Text>
                                                )}
                                            </LinearGradient>
                                        </TouchableOpacity>
                                    </>
                                )}

                                {/* STEP 3: Set New Password */}
                                {(() => {
                                    const shouldShowSetPassword = step === 'set_new_password';
                                    if (shouldShowSetPassword) {
                                        console.log(`[ResetPasswordScreen] Instance #${instanceId} RENDERING SET_NEW_PASSWORD form`);
                                    } else {
                                        console.log(`[ResetPasswordScreen] Instance #${instanceId} NOT rendering set_new_password - step is:`, step);
                                    }
                                    return shouldShowSetPassword;
                                })() && (
                                    <>
                                        <View style={styles.inputGroup}>
                                            <Text style={styles.label}>New Password</Text>
                                            <View style={styles.inputWrapper}>
                                                <MaterialCommunityIcons
                                                    name="lock-outline"
                                                    size={22}
                                                    color="#2A4B2A"
                                                    style={styles.inputIcon}
                                                />
                                                <TextInput
                                                    style={styles.input}
                                                    placeholder="••••••••"
                                                    placeholderTextColor="rgba(255, 255, 255, 0.3)"
                                                    secureTextEntry={!showPassword}
                                                    value={password}
                                                    onChangeText={(text) => {
                                                        setPassword(text);
                                                        setUpdateError("");
                                                    }}
                                                    editable={!updateLoading}
                                                />
                                                <TouchableOpacity
                                                    onPress={() => setShowPassword(!showPassword)}
                                                    style={styles.eyeIcon}
                                                >
                                                    <MaterialCommunityIcons
                                                        name={showPassword ? 'eye' : 'eye-off'}
                                                        size={22}
                                                        color="#2A4B2A"
                                                    />
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        <View style={styles.inputGroup}>
                                            <Text style={styles.label}>Confirm New Password</Text>
                                            <View style={styles.inputWrapper}>
                                                <MaterialCommunityIcons
                                                    name="lock-outline"
                                                    size={22}
                                                    color="#2A4B2A"
                                                    style={styles.inputIcon}
                                                />
                                                <TextInput
                                                    style={styles.input}
                                                    placeholder="••••••••"
                                                    placeholderTextColor="rgba(255, 255, 255, 0.3)"
                                                    secureTextEntry={!showConfirmPassword}
                                                    value={confirmPassword}
                                                    onChangeText={(text) => {
                                                        setConfirmPassword(text);
                                                        setUpdateError("");
                                                    }}
                                                    editable={!updateLoading}
                                                />
                                                <TouchableOpacity
                                                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                                    style={styles.eyeIcon}
                                                >
                                                    <MaterialCommunityIcons
                                                        name={showConfirmPassword ? 'eye' : 'eye-off'}
                                                        size={22}
                                                        color="#2A4B2A"
                                                    />
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        {updateError ? (
                                            <Text style={styles.errorText}>{updateError}</Text>
                                        ) : null}

                                        <TouchableOpacity
                                            style={[styles.button, updateLoading && styles.buttonDisabled]}
                                            onPress={handleSetNewPassword}
                                            disabled={updateLoading}
                                        >
                                            <LinearGradient
                                                colors={['#2A4B2A', '#F1C93B']}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 0 }}
                                                style={styles.buttonGradient}
                                            >
                                                {updateLoading ? (
                                                    <ActivityIndicator color="#fff" />
                                                ) : (
                                                    <Text style={styles.buttonText}>Reset Password</Text>
                                                )}
                                            </LinearGradient>
                                        </TouchableOpacity>
                                    </>
                                )}

                                <TouchableOpacity
                                    style={styles.backButton}
                                    onPress={handleBackToLogin}
                                >
                                    <Text style={styles.backButtonText}>Back to Login</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
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
        width: '100%',
    },
    backgroundGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    decorativeBlob1: {
        position: 'absolute',
        width: 400,
        height: 400,
        borderRadius: 200,
        backgroundColor: 'rgba(42, 75, 42, 0.08)',
        top: -150,
        right: -150,
    },
    decorativeBlob2: {
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: 'rgba(241, 201, 59, 0.06)',
        bottom: -100,
        left: -100,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: "center",
    },
    header: {
        alignItems: "center",
        marginBottom: 32,
    },
    logoImage: {
        marginBottom: 8,
    },
    formCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        width: '100%',
        padding: 24,
    },
    formHeader: {
        marginBottom: 24,
    },
    formTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#FFF',
        marginBottom: 8,
    },
    formSubtitle: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.5)',
        lineHeight: 18,
    },
    formContent: {
        gap: 20,
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.6)',
        marginLeft: 2,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderWidth: 1,
        borderColor: 'rgba(42, 75, 42, 0.2)',
        borderRadius: 14,
        paddingHorizontal: 14,
        height: 50,
        position: 'relative',
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#FFF',
        height: '100%',
        paddingRight: 16,
        backgroundColor: 'transparent',
        ...(Platform.OS === 'web'
            ? { width: '100%', maxWidth: '100%' } as any
            : {}),
    },
    otpInput: {
        fontSize: 24,
        textAlign: "center",
        letterSpacing: 8,
        fontWeight: "bold",
    },
    eyeIcon: {
        position: 'absolute',
        right: 8,
        height: '100%',
        justifyContent: 'center',
        padding: 8,
    },
    button: {
        borderRadius: 14,
        overflow: 'hidden',
        elevation: 5,
        shadowColor: '#2A4B2A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        marginTop: 8,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonGradient: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    buttonText: {
        color: '#FFF',
        fontSize: 17,
        fontWeight: 'bold',
    },
    errorText: {
        color: '#FF4B4B',
        fontSize: 13,
        textAlign: 'center',
    },
    backButton: {
        marginTop: 24,
        alignItems: "center",
    },
    backButtonText: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 14,
        fontWeight: "500",
    },
    successContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        paddingHorizontal: 32,
        width: '100%',
    },
    successIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: "rgba(76, 175, 80, 0.1)",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 24,
    },
    successIconText: {
        fontSize: 40,
        color: "#4CAF50",
    },
    title: {
        fontSize: 26,
        fontWeight: "bold",
        color: '#FFF',
        marginTop: 20,
        textAlign: "center",
        paddingHorizontal: 20,
        maxWidth: '100%',
    },
    subtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.5)',
        marginTop: 8,
        textAlign: "center",
    },
});
