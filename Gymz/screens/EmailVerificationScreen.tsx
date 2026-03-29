import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { dashboardService } from '../services/dashboardService';
import { DataMapper } from '../utils/dataMapper';

export default function EmailVerificationScreen({ route, navigation }: any) {
    const { email, password } = route.params || {};
    const { login } = useAuth();
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [error, setError] = useState('');
    const inputRefs = useRef<Array<TextInput | null>>([]);

    useEffect(() => {
        // Auto-focus first input
        if (inputRefs.current[0]) {
            inputRefs.current[0].focus();
        }
    }, []);

    const handleCodeChange = (text: string, index: number) => {
        // Only allow numbers
        if (text && !/^\d+$/.test(text)) return;

        const newCode = [...code];
        newCode[index] = text;
        setCode(newCode);
        setError('');

        // Auto-advance to next input
        if (text && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto-verify when all 6 digits are entered
        if (newCode.every(digit => digit !== '') && !loading) {
            handleVerify(newCode.join(''));
        }
    };

    const handleKeyPress = (e: any, index: number) => {
        // Handle backspace
        if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleVerify = async (verificationCode?: string) => {
        const finalCode = verificationCode || code.join('');

        if (finalCode.length !== 6) {
            setError('Please enter the complete 6-digit code');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Verify OTP with Supabase
            const { data, error: verifyError } = await supabase.auth.verifyOtp({
                email,
                token: finalCode,
                type: 'signup',
            });

            if (verifyError) throw verifyError;

            if (data.user) {
                // Fetch user profile
                const { data: userData } = await (supabase as any)
                    .from('users')
                    .select('*')
                    .eq('id', data.user.id)
                    .maybeSingle();

                if (userData) {
                    // PRE-ARM DASHBOARD CACHE (non-blocking) — must not block login.
                    void dashboardService.preArmDashboard(userData.id);
                    const mapped = DataMapper.fromDb<any>(userData);

                    // Auto-login
                    login({
                        id: mapped.id,
                        email: mapped.email,
                        name: mapped.name,
                        role: mapped.role || 'member',
                        status: mapped.status || 'active',
                        membershipStatus: mapped.membershipStatus || 'Pending',
                        avatarUrl: mapped.avatarUrl,
                        phone: mapped.phone,
                        uniqueId: mapped.uniqueId,
                        isCalibrated: false // Force them to phase 2
                    } as any);

                    Alert.alert(
                        '🎉 Welcome to Gymz!',
                        'Your account has been verified successfully.',
                        [{ text: 'Get Started', onPress: () => navigation.navigate('GymSelection') }]
                    );
                } else {
                    throw new Error('Profile not found. Please contact support.');
                }
            }
        } catch (err: any) {
            console.error('Verification error:', err);
            const msg = (err.message || '').toLowerCase();
            const isNetworkError = /failed to fetch|network request failed|timeout|connection refused/i.test(msg);
            setError(isNetworkError ? 'Please check your connection and try again.' : (err.message || 'Invalid code. Please try again.'));
            setCode(['', '', '', '', '', '']);
            inputRefs.current[0]?.focus();
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (!email) {
            Alert.alert('Error', 'Email address is missing. Please go back and try signing up again.');
            return;
        }

        setResending(true);
        setError('');
        console.log('[Verification] Attempting to resend signup OTP to:', email.trim());

        try {
            // Primary Method: Official Resend API
            const { error: resendError } = await supabase.auth.resend({
                type: 'signup',
                email: email.trim(),
            });

            if (resendError) {
                console.log('[Verification] Primary resend failed, trying fallback...', resendError.message);

                // Fallback Method: Supabase allows "re-signing up" an unconfirmed user to trigger a resend
                if (!password) {
                    throw new Error('Verification session expired. Please sign up again.');
                }
                const { error: fallbackError } = await supabase.auth.signUp({
                    email: email.trim(),
                    password: password,
                });

                if (fallbackError) throw fallbackError;
            }

            console.log('[Verification] Resend successful via primary or fallback');
            Alert.alert('Code Sent', 'A verification code has been sent to your email. Please check your inbox and spam folder.');
            setCode(['', '', '', '', '', '']);
            if (inputRefs.current[0]) inputRefs.current[0].focus();

        } catch (err: any) {
            console.error('[Verification] All resend attempts failed:', err);
            Alert.alert(
                'Could Not Send Code',
                err.message || 'We encountered an error sending the code. Please try again in a few minutes.'
            );
        } finally {
            setResending(false);
        }
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#0A120A', '#1B241B', '#080F08']}
                style={styles.background}
            />

            <View style={styles.glow1} pointerEvents="none" />
            <View style={styles.glow2} pointerEvents="none" />

            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <MaterialCommunityIcons name="arrow-left" size={28} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* Icon */}
                <View style={styles.iconContainer}>
                    <LinearGradient
                        colors={['#2A4B2A', '#F1C93B']}
                        style={styles.iconGradient}
                    >
                        <MaterialCommunityIcons name="email-check-outline" size={50} color="#fff" />
                    </LinearGradient>
                </View>

                {/* Title */}
                <Text style={styles.title}>Check Your Email</Text>
                <Text style={styles.subtitle}>
                    We've sent a 6-digit code to{'\n'}
                    <Text style={styles.email}>{email}</Text>
                </Text>

                {/* Code Inputs */}
                <View style={styles.codeContainer}>
                    {code.map((digit, index) => (
                        <TextInput
                            key={index}
                            ref={(ref) => { inputRefs.current[index] = ref; }}
                            style={[
                                styles.codeInput,
                                digit && styles.codeInputFilled,
                            ]}
                            value={digit}
                            onChangeText={(text) => handleCodeChange(text, index)}
                            onKeyPress={(e) => handleKeyPress(e, index)}
                            keyboardType="number-pad"
                            maxLength={1}
                            selectTextOnFocus
                            editable={!loading}
                        />
                    ))}
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                {/* Loading Indicator */}
                {loading && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="small" color="#2A4B2A" />
                        <Text style={styles.loadingText}>Verifying...</Text>
                    </View>
                )}

                {/* Verify Button */}
                <TouchableOpacity
                    style={styles.verifyBtn}
                    onPress={() => handleVerify()}
                    disabled={loading || code.some(d => !d)}
                >
                    <LinearGradient
                        colors={['#2A4B2A', '#F1C93B']}
                        style={styles.verifyBtnGradient}
                    >
                        <Text style={styles.verifyBtnText}>Verify Email</Text>
                    </LinearGradient>
                </TouchableOpacity>

                {/* Resend */}
                <View style={styles.resendContainer}>
                    <Text style={styles.resendLabel}>Didn't receive a code? </Text>
                    <TouchableOpacity onPress={handleResend} disabled={resending}>
                        <Text style={[styles.resendBtn, resending && styles.resendBtnDisabled]}>
                            {resending ? 'Sending...' : 'Resend'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Help Text */}
                <Text style={styles.helpText}>
                    Check your spam folder if you don't see the email
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#050B05',
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
    content: {
        flex: 1,
        paddingHorizontal: 25,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
    },
    header: {
        marginBottom: 40,
    },
    backBtn: {
        width: 50,
        height: 50,
        borderRadius: 15,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignSelf: 'center',
        marginBottom: 30,
    },
    iconGradient: {
        flex: 1,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.6)',
        textAlign: 'center',
        marginBottom: 40,
        lineHeight: 24,
    },
    email: {
        color: '#fff',
        fontWeight: '600',
    },
    codeContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
        marginBottom: 20,
    },
    codeInput: {
        width: 50,
        height: 60,
        borderRadius: 12,
        backgroundColor: 'rgba(10, 18, 10, 0.8)',
        borderWidth: 2,
        borderColor: 'rgba(42, 75, 42, 0.3)',
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        ...Platform.select({
            web: {
                outlineStyle: 'none',
            } as any
        })
    },
    codeInputFilled: {
        borderColor: '#2A4B2A',
        backgroundColor: 'rgba(42, 75, 42, 0.1)',
    },
    errorText: {
        color: '#FF4B4B',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 15,
    },
    loadingContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        marginBottom: 15,
    },
    loadingText: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 14,
    },
    verifyBtn: {
        borderRadius: 16,
        overflow: 'hidden',
        marginTop: 10,
    },
    verifyBtnGradient: {
        paddingVertical: 18,
        alignItems: 'center',
    },
    verifyBtnText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    resendContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 25,
    },
    resendLabel: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 14,
    },
    resendBtn: {
        color: '#F1C93B',
        fontSize: 14,
        fontWeight: 'bold',
    },
    resendBtnDisabled: {
        opacity: 0.5,
    },
    helpText: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 15,
    },
});
