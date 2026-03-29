import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Dimensions, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const TUTORIAL_KEY = 'has_seen_scanner_tutorial_v2';
const SCANNER_USED_KEY = 'scanner_used_once';
const { width, height } = Dimensions.get('window');

const COLORS = {
    brandGreen: '#2A4B2A',
    brandYellow: '#F1C93B',
    accentGreen: '#10B981',
    accentBlue: '#3B82F6',
    textLight: '#F3F4F6',
    textDark: '#1F2937',
};

export const ScannerTutorial = () => {
    const [visible, setVisible] = useState(false);
    const [step, setStep] = useState(0);
    const pulseAnim = useRef(new Animated.Value(0)).current;
    const cardAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        checkTutorialStatus();
    }, []);

    useEffect(() => {
        if (visible) {
            cardAnim.setValue(0);
            Animated.timing(cardAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }).start();

            pulseAnim.setValue(0);
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1400,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 0,
                        duration: 1400,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        }
    }, [visible]);

    const checkTutorialStatus = async () => {
        const [hasSeen, hasUsed] = await Promise.all([
            AsyncStorage.getItem(TUTORIAL_KEY),
            AsyncStorage.getItem(SCANNER_USED_KEY),
        ]);

        // If the user has already used the scanner at least once,
        // never show this tutorial again.
        if (hasUsed) {
            if (!hasSeen) {
                await AsyncStorage.setItem(TUTORIAL_KEY, 'true');
            }
            return;
        }

        if (!hasSeen) {
            // Delay slightly to let camera load
            setTimeout(() => setVisible(true), 1500);
        }
    };

    const handleDismiss = async () => {
        setVisible(false);
        await AsyncStorage.setItem(TUTORIAL_KEY, 'true');
    };

    if (!visible) return null;

    return (
        <Modal transparent animationType="fade" visible={visible}>
            <View style={styles.overlay}>
                <Animated.View
                    style={[
                        styles.content,
                        {
                            opacity: cardAnim,
                            transform: [
                                {
                                    translateY: cardAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [24, 0],
                                    }),
                                },
                            ],
                        },
                    ]}
                >
                    <LinearGradient
                        colors={['#0A120A', '#111827', 'rgba(241,201,59,0.18)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.gradientCard}
                    >
                        <Animated.View
                            style={[
                                styles.iconCircle,
                                {
                                    transform: [
                                        {
                                            scale: pulseAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [1, 1.08],
                                            }),
                                        },
                                    ],
                                },
                            ]}
                        >
                            <Ionicons name="camera-outline" size={40} color={COLORS.brandGreen} />
                        </Animated.View>
                        <Text style={styles.title}>Smart Camera Tips</Text>
                        <Text style={styles.subtitle}>Three quick moves for clean scans.</Text>

                        <View style={styles.tipsContainer}>
                            <View style={styles.tipRow}>
                                <View style={styles.tipIconPill}>
                                    <Ionicons name="scan-circle" size={18} color={COLORS.accentGreen} />
                                </View>
                                <Text style={styles.tipText}>Wait for the <Text style={styles.bold}>green ring</Text>.</Text>
                            </View>
                            <View style={styles.tipRow}>
                                <View style={styles.tipIconPill}>
                                    <Ionicons name="radio-button-on" size={18} color={COLORS.brandYellow} />
                                </View>
                                <Text style={styles.tipText}><Text style={styles.bold}>Hold steady, then tap.</Text></Text>
                            </View>
                            <View style={styles.tipRow}>
                                <View style={styles.tipIconPill}>
                                    <Ionicons name="resize" size={18} color={COLORS.accentBlue} />
                                </View>
                                <Text style={styles.tipText}>Adjust <Text style={styles.bold}>portions</Text> after the scan.</Text>
                            </View>
                        </View>

                        <TouchableOpacity style={styles.button} onPress={handleDismiss} activeOpacity={0.9}>
                            <Text style={styles.buttonText}>Start Scanning</Text>
                        </TouchableOpacity>
                    </LinearGradient>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    content: {
        width: '100%',
        marginHorizontal: 24,
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    gradientCard: {
        width: '100%',
        borderRadius: 24,
        padding: 28,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(241,201,59,0.35)',
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(241,201,59,0.12)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(241,201,59,0.7)',
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: COLORS.textLight,
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: 'rgba(209,213,219,0.9)',
        textAlign: 'center',
        marginBottom: 24,
    },
    tipsContainer: {
        width: '100%',
        gap: 14,
        marginBottom: 32,
    },
    tipRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: 'rgba(15,23,42,0.85)',
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(148,163,184,0.35)',
    },
    tipIconPill: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(15,23,42,0.9)',
    },
    tipText: {
        flex: 1,
        fontSize: 14,
        color: COLORS.textLight,
        lineHeight: 21,
    },
    bold: {
        fontWeight: '700',
        color: COLORS.textLight,
    },
    button: {
        width: '100%',
        backgroundColor: COLORS.brandGreen,
        paddingVertical: 14,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 4,
    },
    buttonText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '700',
    },
});
