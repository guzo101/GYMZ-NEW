import React, { useState, useMemo, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    SafeAreaView,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Dimensions,
    ScrollView,
    Pressable,
    Modal
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScreenHeader } from '../components/ScreenHeader';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import { useTheme } from '../hooks/useTheme';
import { useNavigation } from '@react-navigation/native';
import { nutritionService } from '../services/nutritionService';
import { progressService } from '../services/progressService';
import { DataMapper } from '../utils/dataMapper';
import { setCalibrationCompleted } from '../services/membershipGate';
import { TERMS_AND_CONDITIONS } from '../constants/termsAndConditions';

const { width } = Dimensions.get('window');
const PADDING = 20; // Increased padding slightly for better framing
const SPACING = 12; // Gap between columns
const COL_WIDTH = (width - (PADDING * 2) - SPACING) / 2; // EXACT CALCULATED WIDTH

const FITNESS_GOALS = [
    { id: 'lose_weight', label: 'Lose Weight', icon: 'scale-bathroom' },
    { id: 'build_muscle', label: 'Build Muscle', icon: 'arm-flex' },
    { id: 'recomp', label: 'Toning', icon: 'human-handsup' },
    { id: 'endurance', label: 'Endurance', icon: 'run' },
];

export default function OnboardingMetricsScreen({ route }: any) {
    const { isHardGate } = route?.params || {};
    const { user, refreshUser, mergeUserData, logout, hasGymMapping } = useAuth();
    const { theme } = useTheme();
    const navigation = useNavigation<any>();
    const [loading, setLoading] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // SECURITY GATE: Only allow calibration when gym is set. AccessGate routes here only when approved.
    useEffect(() => {
        if (!user) return;
        if (!hasGymMapping) {
            console.warn('[HealthMetrics] SECURITY: Gym path not selected — blocking calibration');
            navigation.reset({ index: 0, routes: [{ name: 'GymSelection' }] });
            return;
        }
    }, [user, hasGymMapping, navigation]);

    // Units
    const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('cm');
    const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');

    // Data States
    const [height, setHeight] = useState(user?.height?.toString() || '');
    const [weight, setWeight] = useState(user?.weight?.toString() || '');
    const [targetWeight, setTargetWeight] = useState(user?.targetWeight?.toString() || '');
    const [age, setAge] = useState(user?.age?.toString() || '');
    const [gender, setGender] = useState<'male' | 'female'>(user?.gender as any || 'male');
    const [goal, setGoal] = useState(user?.goal || FITNESS_GOALS[0].id);

    // Registration details (below AI calibration)
    const [phone, setPhone] = useState(user?.phone || '');
    const [profession, setProfession] = useState('');
    const [nrcOrPassport, setNrcOrPassport] = useState('');
    const [nationality, setNationality] = useState('');
    const [termsConsent, setTermsConsent] = useState(false);
    const [termsModalVisible, setTermsModalVisible] = useState(false);

    // Display Specifics
    const [heightFt, setHeightFt] = useState('');
    const [heightIn, setHeightIn] = useState('');
    const [weightDisp, setWeightDisp] = useState('');
    const [targetWeightDisp, setTargetWeightDisp] = useState('');

    // --- LOGIC: ID SYNC ---
    useEffect(() => {
        if (user && user.gymId && !user.uniqueId) {
            console.log('[HealthMetrics] ID missing but gym set. Proactively syncing...');
            refreshUser();
        }
    }, [user?.gymId, user?.uniqueId]);

    // Pre-fill phone from user profile when available
    useEffect(() => {
        if (user?.phone && !phone) setPhone(user.phone);
    }, [user?.phone]);

    // --- LOGIC: CONVERSION ---
    useEffect(() => {
        const cm = parseFloat(height);
        if (!isNaN(cm) && cm > 0) {
            const totalIn = cm / 2.54;
            setHeightFt(Math.floor(totalIn / 12).toString());
            setHeightIn(Math.round(totalIn % 12).toString());
        } else {
            setHeightFt('');
            setHeightIn('');
        }
    }, [height]);

    const onCmChange = (v: string) => setHeight(v);
    const onFtChange = (f: string, i: string) => {
        setHeightFt(f); setHeightIn(i);
        const ft = parseFloat(f) || 0; const inc = parseFloat(i) || 0;
        if (f || i) setHeight((((ft * 12) + inc) * 2.54).toFixed(1));
        else setHeight('');
    };

    useEffect(() => {
        if (!weight || isNaN(parseFloat(weight))) {
            setWeightDisp('');
            return;
        }
        if (weightUnit === 'kg') setWeightDisp(weight);
        else setWeightDisp((parseFloat(weight) * 2.20462).toFixed(1));
    }, [weight, weightUnit]);

    useEffect(() => {
        if (!targetWeight || isNaN(parseFloat(targetWeight))) {
            setTargetWeightDisp('');
            return;
        }
        if (weightUnit === 'kg') setTargetWeightDisp(targetWeight);
        else setTargetWeightDisp((parseFloat(targetWeight) * 2.20462).toFixed(1));
    }, [targetWeight, weightUnit]);

    const onWeightChange = (v: string) => {
        setWeightDisp(v);
        if (!v || v.trim() === '') {
            setWeight('');
            return;
        }
        if (weightUnit === 'kg') setWeight(v);
        else {
            const val = parseFloat(v);
            if (!isNaN(val)) setWeight((val / 2.20462).toFixed(1));
            else setWeight('');
        }
    };

    const onTargetChange = (v: string) => {
        setTargetWeightDisp(v);
        if (!v || v.trim() === '') {
            setTargetWeight('');
            return;
        }
        if (weightUnit === 'kg') setTargetWeight(v);
        else {
            const val = parseFloat(v);
            if (!isNaN(val)) setTargetWeight((val / 2.20462).toFixed(1));
            else setTargetWeight('');
        }
    };

    // --- LOGIC: RECOMMENDATIONS ---
    const thresholds = useMemo(() => {
        const a = parseInt(age) || 25; const isM = gender === 'male';
        if (a >= 65) return { min: 22.0, max: 27.0, idealBmi: isM ? 24.8 : 24.2 };
        return { min: 18.5, max: 25.0, idealBmi: isM ? 22.2 : 21.2 };
    }, [age, gender]);

    const bmi = useMemo(() => {
        const h = parseFloat(height?.toString().replace(/[^0-9.]/g, '')), w = parseFloat(weight?.toString().replace(/[^0-9.]/g, ''));
        if (!h || !w || h < 40 || w < 20 || isNaN(h) || isNaN(w)) return null;
        return (w / ((h / 100) * (h / 100))).toFixed(1);
    }, [height, weight]);

    const bmiClass = useMemo(() => {
        if (!bmi) return null; const b = parseFloat(bmi), { min, max } = thresholds;
        if (b < min) return { label: 'Low', color: '#FFB74D' };
        if (b <= max) return { label: 'Ideal', color: '#4CAF50' };
        if (b < max + 5) return { label: 'High', color: '#FF9800' };
        return { label: 'Very High', color: '#F44336' };
    }, [bmi, thresholds]);

    const recommendation = useMemo(() => {
        const h = parseFloat(height?.toString().replace(/[^0-9.]/g, '')), w = parseFloat(weight?.toString().replace(/[^0-9.]/g, '')), isM = gender === 'male';
        if (!h || !w || !bmi || isNaN(h) || isNaN(w)) return null;
        const hM = h / 100, idealW = Math.round(thresholds.idealBmi * (hM * hM));
        const diff = Math.abs(w - idealW);
        const lossRate = isM ? 0.6 : 0.45;
        let timeframe = 0, action: 'Lose' | 'Gain' | 'Maintain' = 'Maintain';

        if (w > idealW + 1) { timeframe = Math.ceil(diff / lossRate / 4.3); action = "Lose"; }
        else if (w < idealW - 1) { timeframe = Math.ceil(diff / 0.3 / 4.3); action = "Gain"; }
        else return { idealW: w, timeframe: 0, str: `BMI ${bmi} optimal.`, action: 'Maintain' };

        const wDisplay = weightUnit === 'kg' ? idealW + 'kg' : Math.round(idealW * 2.20462) + 'lbs';
        return { idealW, timeframe, action, str: `${action} to ${wDisplay} in ~${timeframe} mo.` };
    }, [height, weight, bmi, thresholds, gender, weightUnit]);

    // --- LOGIC: AUTOMATIC UPDATE ---
    // Automatically apply recommendations when they change (gender/age/height/weight change)
    useEffect(() => {
        if (recommendation && recommendation.idealW) {
            setTargetWeight(recommendation.idealW.toString());
            // Also update the goal based on the action
            if (recommendation.action === 'Lose') setGoal('lose_weight');
            else if (recommendation.action === 'Gain') setGoal('build_muscle');
            else if (recommendation.action === 'Maintain') setGoal('recomp');
        }
    }, [recommendation?.idealW, recommendation?.action]);

    const handleSave = async () => {
        if (loading) return;

        if (!user || !user.id) {
            console.error('[HealthMetrics] No user found in context');
            Alert.alert('Error', 'Session lost. Please log in again.');
            return;
        }

        if (!hasGymMapping) {
            console.error('[HealthMetrics] SECURITY: Gym path not set — save blocked');
            Alert.alert('Setup Incomplete', 'Please complete gym selection first.');
            return;
        }

        // Validate required fields
        const parsedHeight = parseFloat(height);
        const parsedWeight = parseFloat(weight);
        const parsedTargetWeight = parseFloat(targetWeight);
        const parsedAge = parseInt(age);

        if (!parsedHeight || isNaN(parsedHeight) || parsedHeight < 40) {
            Alert.alert('Validation Error', 'Please enter a valid height (minimum 40cm).');
            return;
        }

        if (!parsedWeight || isNaN(parsedWeight) || parsedWeight < 20) {
            Alert.alert('Validation Error', 'Please enter a valid weight (minimum 20kg).');
            return;
        }

        if (!parsedTargetWeight || isNaN(parsedTargetWeight) || parsedTargetWeight < 20) {
            Alert.alert('Validation Error', 'Please enter a valid target weight (minimum 20kg).');
            return;
        }

        if (!parsedAge || isNaN(parsedAge) || parsedAge < 10 || parsedAge > 120) {
            Alert.alert('Validation Error', 'Please enter a valid age (10-120 years).');
            return;
        }

        if (!gender) {
            Alert.alert('Validation Error', 'Please select a gender.');
            return;
        }

        if (!goal) {
            Alert.alert('Validation Error', 'Please select a primary focus.');
            return;
        }

        // Registration details validation
        if (!phone || phone.trim().length < 8) {
            Alert.alert('Validation Error', 'Please enter a valid phone number.');
            return;
        }
        if (!profession || profession.trim().length < 2) {
            Alert.alert('Validation Error', 'Please enter your profession.');
            return;
        }
        if (!nrcOrPassport || nrcOrPassport.trim().length < 4) {
            Alert.alert('Validation Error', 'Please enter your NRC or Passport number.');
            return;
        }
        if (!nationality || nationality.trim().length < 2) {
            Alert.alert('Validation Error', 'Please enter your nationality.');
            return;
        }
        if (!termsConsent) {
            Alert.alert('Terms Required', 'You must agree to the Terms and Conditions to continue.');
            return;
        }

        setLoading(true);
        try {
            const updates = {
                height: parseFloat(height) || 0,
                weight: parseFloat(weight) || 0,
                age: parseInt(age) || 0,
                gender,
                primaryObjective: goal,
                goal: goal,
                targetWeight: parseFloat(targetWeight) || 0,
                phone: phone.trim(),
                profession: profession.trim(),
                nrcOrPassport: nrcOrPassport.trim(),
                nationality: nationality.trim(),
                termsConsent: true,
                termsConsentDate: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                metadata: {
                    ...(user?.metadata || {}),
                    // CLEAR POLLUTED FIELDS to prevent bypass loops
                    height: undefined,
                    weight: undefined,
                    age: undefined,
                    gender: undefined,
                    fitnessGoal: undefined,
                    goal: undefined,
                    targetWeight: undefined,
                },
                recommendedWeight: recommendation?.idealW,
                goalTimeframe: recommendation?.timeframe ? `${recommendation.timeframe} months` : null
            };

            console.log('[HealthMetrics] Attempting update for user.id:', user.id);
            const { error } = await (supabase as any)
                .from('users')
                .update(DataMapper.toDb(updates))
                .eq('id', user?.id);

            if (error) {
                console.error('[HealthMetrics] Database rejection:', error);
                Alert.alert('Save Failed', `Database rejected the update: ${error.message}`);
                setLoading(false);
                return;
            }

            console.log('[HealthMetrics] Profile updated successfully. Recalculating goals...');
            setSaveSuccess(true);

            // Optimistic update: merge calibration data immediately so gates re-evaluate without waiting for refetch
            const calibrationData = {
                height: parsedHeight,
                weight: parsedWeight,
                age: parsedAge,
                gender,
                goal,
                primaryObjective: goal,
                targetWeight: parsedTargetWeight,
                recommendedWeight: recommendation?.idealW ?? undefined,
                goalTimeframe: recommendation?.timeframe ? `${recommendation.timeframe} months` : undefined,
            };
            mergeUserData(calibrationData);

            if (user.gymId && user.accessMode) {
                const cal = await setCalibrationCompleted(user.id, user.gymId, user.accessMode);
                if (!cal.success) console.warn('[HealthMetrics] setCalibrationCompleted:', cal.error);
            }

            await refreshUser();

            // Log historical weight metric for progress tracking
            try {
                await progressService.addBodyMetric(user.id, {
                    weight: parsedWeight,
                    date: new Date().toISOString().split('T')[0]
                });
            } catch (pMetricErr) {
                console.warn('[HealthMetrics] Historical log failed:', pMetricErr);
            }

            // NEW: Interconnect health metrics with nutrition goals
            try {
                await nutritionService.syncNutritionTargets(user.id);
            } catch (nSyncErr) {
                console.warn('[HealthMetrics] Nutrition sync failed:', nSyncErr);
                // We don't block the UI for this, as the primary save worked.
            }

            setLoading(false);
            // Open the app: replace this screen so calibration disappears and Main (dashboard) shows.
            navigation.replace('Main');

        } catch (error) {
            console.error('[HealthMetrics] Unexpected crash during save:', error);
            const detail = error instanceof Error ? error.message : 'Check logs';
            Alert.alert('Critical Error', `Submission crashed: ${detail}`);
            setLoading(false);
        }
    };

    const handleApply = () => {
        if (recommendation) {
            setTargetWeight(recommendation.idealW.toString());
            if (recommendation.action === 'Lose') setGoal('lose_weight');
            else if (recommendation.action === 'Gain') setGoal('build_muscle');
            else setGoal('recomp');
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            {saveSuccess && (
                <View style={[styles.successBanner, { backgroundColor: theme.primary }]}>
                    <MaterialCommunityIcons name="check-circle" size={24} color="#fff" />
                    <Text style={styles.successBannerText}>Calibration complete!</Text>
                </View>
            )}
            <ScreenHeader
                title="AI Calibration"
                showBackButton={!isHardGate}
                rightElement={
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.sub, { color: theme.textSecondary, marginBottom: 0 }]}>
                            {user?.uniqueId || 'Syncing ID...'}
                        </Text>
                        <Text style={[styles.sub, { color: theme.textSecondary, fontSize: 10, opacity: 0.9 }]}>
                            {gender === 'male' ? 'Performance' : 'Vitality'} Mode
                        </Text>
                    </View>
                }
            />

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 160 }]} showsVerticalScrollIndicator={false}>

                    {/* --- ROW 1: GENDER + AGE --- */}
                    <View style={styles.row}>
                        <View style={{ width: COL_WIDTH, flex: 1 }}>
                            <Text style={[styles.label, { color: theme.textSecondary }]}>GENDER</Text>
                            <View style={styles.toggleContainer}>
                                {['male', 'female'].map(g => (
                                    <TouchableOpacity key={g} onPress={() => setGender(g as any)} style={[styles.toggleBtn, gender === g && { backgroundColor: theme.primary, elevation: 2 }]}>
                                        <Text style={[styles.toggleText, { color: gender === g ? '#FFF' : theme.textMuted }]}>{g.toUpperCase()}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                        <View style={{ width: SPACING }} />
                        <View style={styles.colFixed}>
                            <Text style={[styles.label, { color: theme.textSecondary }]}>AGE</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.backgroundCard, borderColor: theme.border, color: theme.text, textAlign: 'center', outlineStyle: 'none' } as any]}
                                value={age}
                                onChangeText={v => setAge(v.replace(/[^0-9]/g, ''))}
                                keyboardType="numeric"
                                maxLength={3}
                                placeholder="--"
                            />
                        </View>
                    </View>

                    {/* --- ROW 2: HEIGHT + WEIGHT (Explicit Widths) --- */}
                    <View style={styles.row}>
                        {/* Height Column - Explicitly sized to end at center */}
                        <View style={{ width: COL_WIDTH }}>
                            <View style={styles.labelRow}>
                                <Text style={[styles.label, { color: theme.textSecondary }]}>HEIGHT</Text>
                                <View style={styles.unitPillBg}>
                                    <TouchableOpacity onPress={() => setHeightUnit('cm')} style={[styles.unitPill, heightUnit === 'cm' && { backgroundColor: theme.primary }]}>
                                        <Text style={[styles.unitText, { color: heightUnit === 'cm' ? '#FFF' : theme.textMuted }]}>CM</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => setHeightUnit('ft')} style={[styles.unitPill, heightUnit === 'ft' && { backgroundColor: theme.primary }]}>
                                        <Text style={[styles.unitText, { color: heightUnit === 'ft' ? '#FFF' : theme.textMuted }]}>FT</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {heightUnit === 'cm' ? (
                                <TextInput
                                    style={[styles.input, { backgroundColor: theme.backgroundCard, borderColor: theme.border, color: theme.text, outlineStyle: 'none', textAlign: 'center' } as any]}
                                    value={height}
                                    onChangeText={v => setHeight(v.replace(/[^0-9.]/g, ''))}
                                    keyboardType="numeric"
                                    placeholder="180"
                                    placeholderTextColor={theme.textMuted}
                                />
                            ) : (
                                <View style={{
                                    height: 40,
                                    borderRadius: 10,
                                    borderWidth: 1,
                                    width: '100%',
                                    backgroundColor: theme.backgroundCard,
                                    borderColor: theme.border,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    paddingHorizontal: 8,
                                    overflow: 'hidden'
                                }}>
                                    <TextInput
                                        style={{ width: 50, color: theme.text, fontSize: 14, fontWeight: '700', textAlign: 'center', height: '100%', outlineStyle: 'none', borderWidth: 0 } as any}
                                        value={heightFt}
                                        onChangeText={v => onFtChange(v.replace(/[^0-9]/g, ''), heightIn)}
                                        keyboardType="numeric"
                                        placeholder="5"
                                        placeholderTextColor={theme.textMuted}
                                    />
                                    <Text style={{ color: theme.textMuted, fontSize: 10, fontWeight: '800', marginHorizontal: 2 }}>FT</Text>

                                    <TextInput
                                        style={{ width: 50, color: theme.text, fontSize: 14, fontWeight: '700', textAlign: 'center', height: '100%', outlineStyle: 'none', borderWidth: 0 } as any}
                                        value={heightIn}
                                        onChangeText={v => onFtChange(heightFt, v.replace(/[^0-9]/g, ''))}
                                        keyboardType="numeric"
                                        placeholder="11"
                                        placeholderTextColor={theme.textMuted}
                                    />
                                    <Text style={{ color: theme.textMuted, fontSize: 10, fontWeight: '800', marginLeft: 2 }}>IN</Text>
                                </View>
                            )}
                        </View>

                        {/* Spacer - Exactly center gap */}
                        <View style={{ width: SPACING }} />

                        {/* Weight Column - Explicitly sized */}
                        <View style={{ width: COL_WIDTH }}>
                            <View style={styles.labelRow}>
                                <Text style={[styles.label, { color: theme.textSecondary }]}>WEIGHT</Text>
                                <View style={styles.unitPillBg}>
                                    <TouchableOpacity onPress={() => setWeightUnit('kg')} style={[styles.unitPill, weightUnit === 'kg' && { backgroundColor: theme.primary }]}>
                                        <Text style={[styles.unitText, { color: weightUnit === 'kg' ? '#FFF' : theme.textMuted }]}>KG</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => setWeightUnit('lbs')} style={[styles.unitPill, weightUnit === 'lbs' && { backgroundColor: theme.primary }]}>
                                        <Text style={[styles.unitText, { color: weightUnit === 'lbs' ? '#FFF' : theme.textMuted }]}>LB</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.backgroundCard, borderColor: theme.border, color: theme.text, outlineStyle: 'none', textAlign: 'center' } as any]}
                                value={weightDisp}
                                onChangeText={v => onWeightChange(v.replace(/[^0-9.]/g, ''))}
                                keyboardType="numeric"
                                placeholder="..."
                                placeholderTextColor={theme.textMuted}
                            />
                        </View>
                    </View>

                    {/* --- BMI --- */}
                    {!!bmiClass && (
                        <View style={[styles.bmiBar, { backgroundColor: 'rgba(0,0,0,0.03)' }]}>
                            <View style={styles.bmiContent}>
                                <Text style={[styles.bmiV, { color: bmiClass.color }]}>{bmi}</Text>
                                <View style={{ marginLeft: 10 }}>
                                    <Text style={[styles.bmiL, { color: bmiClass.color }]}>{bmiClass.label}</Text>
                                    <Text style={[styles.bmiT, { color: theme.textSecondary }]}>Target: {thresholds.min}-{thresholds.max}</Text>
                                </View>
                            </View>
                            {!!recommendation && (
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={[styles.recTxt, { color: theme.text }]}>{recommendation.str}</Text>
                                    <TouchableOpacity onPress={handleApply}><Text style={[styles.applyTx, { color: theme.primary }]}>APPLY</Text></TouchableOpacity>
                                </View>
                            )}
                        </View>
                    )}

                    {/* --- GOALS --- */}
                    <Text style={[styles.label, { marginTop: 20, color: theme.textSecondary }]}>PRIMARY FOCUS</Text>
                    <View style={styles.goalRow}>
                        {FITNESS_GOALS.map((g, i) => (
                            <TouchableOpacity
                                key={g.id}
                                onPress={() => setGoal(g.id)}
                                style={[
                                    styles.goalCard,
                                    { backgroundColor: theme.backgroundCard, borderColor: goal === g.id ? theme.primary : theme.border, width: COL_WIDTH }, // Use explicit width here too
                                    (i % 2 === 0) ? { marginRight: SPACING } : {}
                                ]}
                            >
                                <MaterialCommunityIcons name={g.icon as any} size={16} color={goal === g.id ? theme.primary : theme.textMuted} />
                                <Text style={[styles.goalLb, { color: goal === g.id ? theme.primary : theme.text }]}>{g.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* --- TARGET --- */}
                    <View style={{ marginTop: 16 }}>
                        <Text style={[styles.label, { color: theme.textSecondary }]}>TARGET ({weightUnit.toUpperCase()})</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.backgroundCard, borderColor: theme.border, color: theme.text, width: '100%', outlineStyle: 'none', textAlign: 'center' } as any]}
                            value={targetWeightDisp}
                            onChangeText={v => onTargetChange(v.replace(/[^0-9.]/g, ''))}
                            keyboardType="numeric"
                            placeholder="..."
                        />
                    </View>

                    {/* --- REGISTRATION DETAILS (below AI calibration) --- */}
                    <View style={[styles.registrationSection, { marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: theme.border }]}>
                        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>REGISTRATION DETAILS</Text>

                        <View style={{ marginTop: 12 }}>
                            <Text style={[styles.label, { color: theme.textSecondary }]}>PHONE NUMBER</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.backgroundCard, borderColor: theme.border, color: theme.text, outlineStyle: 'none' } as any]}
                                value={phone}
                                onChangeText={setPhone}
                                keyboardType="phone-pad"
                                placeholder="+260 9XX XXX XXX"
                                placeholderTextColor={theme.textMuted}
                            />
                        </View>

                        <View style={{ marginTop: 12 }}>
                            <Text style={[styles.label, { color: theme.textSecondary }]}>PROFESSION</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.backgroundCard, borderColor: theme.border, color: theme.text, outlineStyle: 'none' } as any]}
                                value={profession}
                                onChangeText={setProfession}
                                placeholder="e.g. Engineer, Teacher"
                                placeholderTextColor={theme.textMuted}
                            />
                        </View>

                        <View style={{ marginTop: 12 }}>
                            <Text style={[styles.label, { color: theme.textSecondary }]}>NRC / PASSPORT NUMBER</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.backgroundCard, borderColor: theme.border, color: theme.text, outlineStyle: 'none' } as any]}
                                value={nrcOrPassport}
                                onChangeText={setNrcOrPassport}
                                placeholder="NRC or Passport number"
                                placeholderTextColor={theme.textMuted}
                            />
                        </View>

                        <View style={{ marginTop: 12 }}>
                            <Text style={[styles.label, { color: theme.textSecondary }]}>NATIONALITY</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.backgroundCard, borderColor: theme.border, color: theme.text, outlineStyle: 'none' } as any]}
                                value={nationality}
                                onChangeText={setNationality}
                                placeholder="e.g. Zambian"
                                placeholderTextColor={theme.textMuted}
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.checkboxWrapper, { marginTop: 16 }]}
                            onPress={() => setTermsConsent(!termsConsent)}
                            activeOpacity={0.7}
                        >
                            <View style={[
                                styles.checkbox,
                                {
                                    borderColor: termsConsent ? theme.primary : theme.textMuted,
                                    backgroundColor: termsConsent ? theme.primary : theme.backgroundCard,
                                }
                            ]}>
                                {termsConsent && <MaterialCommunityIcons name="check" size={18} color="#FFF" />}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.checkboxLabel, { color: theme.text }]}>
                                    By submitting the above information, I agree to the{' '}
                                    <Text style={[styles.linkText, { color: theme.primary }]} onPress={() => setTermsModalVisible(true)}>
                                        Terms and Conditions
                                    </Text>
                                    {' '}and confirm that the information provided is accurate.
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Terms & Conditions Modal */}
                    <Modal visible={termsModalVisible} transparent animationType="slide">
                        <View style={styles.modalOverlay}>
                            <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
                                <View style={styles.modalHeader}>
                                    <Text style={[styles.modalTitle, { color: theme.text }]}>{TERMS_AND_CONDITIONS.title}</Text>
                                    <TouchableOpacity onPress={() => setTermsModalVisible(false)} style={styles.modalCloseBtn}>
                                        <MaterialCommunityIcons name="close" size={24} color={theme.text} />
                                    </TouchableOpacity>
                                </View>
                                <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator>
                                    {TERMS_AND_CONDITIONS.sections.map((s, i) => (
                                        <View key={i} style={{ marginBottom: 16 }}>
                                            <Text style={[styles.termsHeading, { color: theme.primary }]}>{s.heading}</Text>
                                            <Text style={[styles.termsBody, { color: theme.text }]}>{s.content}</Text>
                                        </View>
                                    ))}
                                </ScrollView>
                                <TouchableOpacity onPress={() => setTermsModalVisible(false)} style={[styles.modalDoneBtn, { backgroundColor: theme.primary }]}>
                                    <Text style={styles.modalDoneText}>Close</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Modal>

                    {/* Sync Engine button */}
                    <View style={{ marginTop: 20, zIndex: 9999, elevation: 9999 }}>
                        <Pressable
                            style={({ pressed }) => [
                                styles.btn,
                                { opacity: pressed || loading ? 0.8 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }
                            ]}
                            onPress={handleSave}
                            disabled={loading}
                        >
                            <LinearGradient colors={[theme.primary, theme.primaryLight]} style={styles.btnG}>
                                {loading ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.btnT}>Sync Engine</Text>}
                            </LinearGradient>
                        </Pressable>

                        <TouchableOpacity
                            onPress={logout}
                            style={{
                                marginTop: 10,
                                paddingVertical: 12,
                                alignItems: 'center',
                                flexDirection: 'row',
                                justifyContent: 'center',
                                gap: 6
                            }}
                        >
                            <MaterialCommunityIcons name="logout" size={18} color={theme.error} />
                            <Text style={{ color: theme.error, fontSize: 14, fontWeight: '700' }}>Logout</Text>
                        </TouchableOpacity>
                    </View>

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    successBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    successBannerText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
    scroll: { padding: PADDING },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 10 },
    iconBox: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    title: { fontSize: 16, fontWeight: '800' },
    sub: { fontSize: 12, opacity: 0.9 },

    row: { flexDirection: 'row', marginBottom: 14 },
    // Removes usage of flex: 1 for these critical layout columns to prevent expansion
    colFixed: { width: 64 },

    label: { fontSize: 11, fontWeight: '800', opacity: 0.85, marginBottom: 6, letterSpacing: 0.5 },
    labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, minHeight: 18 },

    toggleContainer: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 10, padding: 2, height: 40 },
    toggleBtn: { flex: 1, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    toggleText: { fontSize: 11, fontWeight: '800' },

    input: { height: 40, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontSize: 14, fontWeight: '700', width: '100%' },
    multiInput: { flexDirection: 'row', height: 40, width: '100%' },
    inputHalf: { flex: 1, borderRadius: 10, borderWidth: 1, textAlign: 'center', fontSize: 14, fontWeight: '700' },

    unitPillBg: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 8, padding: 2 },
    unitPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    unitText: { fontSize: 9, fontWeight: '900' },

    bmiBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderRadius: 12, marginBottom: 4 },
    bmiContent: { flexDirection: 'row', alignItems: 'center' },
    bmiV: { fontSize: 18, fontWeight: '900' },
    bmiL: { fontSize: 11, fontWeight: '800' },
    bmiT: { fontSize: 10, opacity: 0.8 },
    recTxt: { fontSize: 11, fontWeight: '600', textAlign: 'right', marginBottom: 2 },
    applyTx: { fontSize: 10, fontWeight: '900' },

    goalRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
    goalCard: { height: 42, borderWidth: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 10 },
    goalLb: { fontSize: 12, fontWeight: '700' },

    btn: { marginTop: 16, height: 48, borderRadius: 24, overflow: 'hidden', marginBottom: 30 },
    btnG: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    btnT: { color: '#FFF', fontSize: 14, fontWeight: '800' },

    // Registration section
    registrationSection: {},
    sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
    checkboxWrapper: { flexDirection: 'row', alignItems: 'flex-start' },
    checkbox: { width: 22, height: 22, borderWidth: 2, borderRadius: 6, marginRight: 10, justifyContent: 'center', alignItems: 'center' },
    checkboxLabel: { fontSize: 12, lineHeight: 18, flex: 1 },
    linkText: { fontWeight: '700', textDecorationLine: 'underline' },

    // Terms modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', paddingBottom: 24 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.08)' },
    modalTitle: { fontSize: 18, fontWeight: '800' },
    modalCloseBtn: { padding: 4 },
    modalScroll: { padding: 16, maxHeight: 400 },
    termsHeading: { fontSize: 14, fontWeight: '800', marginBottom: 6 },
    termsBody: { fontSize: 13, lineHeight: 20, opacity: 0.9 },
    modalDoneBtn: { marginHorizontal: 16, marginTop: 8, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
    modalDoneText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
