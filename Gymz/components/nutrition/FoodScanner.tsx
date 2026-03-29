import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Dimensions,
    Platform,
    StatusBar,
    SafeAreaView,
    ScrollView,
    ActivityIndicator,
    Alert,
    Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { CameraView, CameraType } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCamera } from '../../hooks/useCameraPermissions';
import { Accelerometer, LightSensor } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import { analyzeFoodImage, uploadFoodImage, ScannerResult } from '../../services/foodService';
import Svg, { Circle, G, Line } from 'react-native-svg';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabase';
import { PortionAdjuster } from './PortionAdjuster';
import { ScannerTutorial } from './ScannerTutorial';
import { useCoachCharacter } from '../../contexts/CoachCharacterContext';
import type { BubblePosition } from '../../contexts/CoachCharacterContext';
import { useTheme } from '../../hooks/useTheme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

const { width, height } = Dimensions.get('window');

// Custom colors from the design
const COLORS = {
    brandGreen: '#2A4B2A',
    brandYellow: '#F1C93B',
    accentGreen: '#10B981',
    accentYellow: '#FBD85D',
    accentBlue: '#3B82F6', // Keeping semantic blue for info/links if needed, but auditing usage
    bgDark: '#0A120A',
    textLight: '#F3F4F6',
    textDark: '#1F2937',
    cardShadow: 'rgba(42, 75, 42, 0.15)',
};

// Removed dummy scans - users now see only their real logged meals
interface FoodScannerProps {
    onClose: () => void;
    onScanComplete?: (data: any) => void;
    mealType?: string;
}

export function FoodScanner({ onClose, onScanComplete, mealType }: FoodScannerProps) {
    const insets = useSafeAreaInsets();
    const { hasPermission, requestPermission, canAskAgain } = useCamera();
    const [facing, setFacing] = useState<CameraType>('back');
    const [isScanning, setIsScanning] = useState(true);
    const [scanResult, setScanResult] = useState<any>(null);
    const [baseScanResult, setBaseScanResult] = useState<any>(null); // Store original result
    const [savedScanId, setSavedScanId] = useState<string | null>(null); // Track DB ID
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isLogging, setIsLogging] = useState(false);
    const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
    const [analysisLabels, setAnalysisLabels] = useState<string>("Analyzing image...");
    const [analysis, setAnalysis] = useState<any>(null);
    const [zoom, setZoom] = useState(0);
    const [scanHint, setScanHint] = useState<string | null>(null);
    const hintAnim = useRef(new Animated.Value(0)).current;
    const lastHintSeq = useRef(0);

    // Readiness indicators
    const [readinessScore, setReadinessScore] = useState(0);
    const [encouragementMessage, setEncouragementMessage] = useState('');
    const prevReadinessScore = useRef(0);

    // Nutrition Data State
    const [userGoals, setUserGoals] = useState<any>(null);
    const [todaysScans, setTodaysScans] = useState<any[]>([]);
    const [macroProgress, setMacroProgress] = useState({ protein: 0, calories: 0, carbs: 0, fats: 0, fiber: 0 });

    const scanLineAnim = useRef(new Animated.Value(0)).current;
    const flashAnim = useRef(new Animated.Value(0)).current;
    const cameraRef = useRef<any>(null);
    const { user } = useAuth();
    const char = useCoachCharacter();
    const { gender } = useTheme();
    const previousBubblePositionRef = useRef<BubblePosition | null>(null);
    const lastScanEffectKeyRef = useRef<string | null>(null);

    useEffect(() => {
        startScanAnimation();
        fetchUserData();
    }, []);

    // Animate "Try again" hint in the center
    useEffect(() => {
        if (scanHint === 'Try again') {
            lastHintSeq.current += 1;
            const seq = lastHintSeq.current;
            hintAnim.setValue(0);
            Animated.sequence([
                Animated.timing(hintAnim, {
                    toValue: 1,
                    duration: 180,
                    useNativeDriver: true,
                }),
                Animated.delay(900),
                Animated.timing(hintAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [scanHint, hintAnim]);

    async function fetchUserData() {
        try {
            const userId = (await supabase.auth.getUser()).data.user?.id;
            if (!userId) return;

            // 1. Fetch User Goals (from user_fitness_goals)
            const { data: goals, error: goalsError } = await supabase
                .from('user_fitness_goals')
                .select('*')
                .eq('user_id', userId)
                .eq('is_active', true)
                .maybeSingle();

            if (goals) setUserGoals(goals);
            if (goalsError) console.warn('[FoodScanner] Error fetching goals:', goalsError);

            // 2. Fetch Today's Logs (from daily_nutrition_logs)
            const today = new Date().toISOString().split('T')[0];
            const { data: scans, error: scansError } = await supabase
                .from('daily_nutrition_logs')
                .select('*')
                .eq('user_id', userId)
                .gte('logged_at', today)
                .order('logged_at', { ascending: false });

            console.log(`[FoodScanner] Fetched ${scans?.length || 0} logs for today`);

            const realScans = scans || [];
            setTodaysScans(realScans);

            // Calculate Progress using only real scans
            const total = realScans.reduce((acc: any, curr: any) => ({
                protein: acc.protein + (Number(curr.protein) || 0),
                calories: acc.calories + (Number(curr.calories) || 0),
                carbs: acc.carbs + (Number(curr.carbs) || 0),
                fats: acc.fats + (Number(curr.fats || curr.fat) || 0),
                fiber: acc.fiber + (Number(curr.fiber || curr.fiber_g) || 0),
            }), { protein: 0, calories: 0, carbs: 0, fats: 0, fiber: 0 });

            setMacroProgress(total);

        } catch (err) {
            console.error('[FoodScanner] Error fetching nutrition data:', err);
        }
    }

    // Real Sensor Logic for Readiness
    useEffect(() => {
        // Web Fallback: No real sensors, just simulate or set to ready
        if (Platform.OS === 'web') {
            if (isScanning && !isAnalyzing) {
                setReadinessScore(100);
                setEncouragementMessage("Ready to capture (Web Mode) 📸");
            }
            return;
        }

        if (!isScanning || isAnalyzing) {
            Accelerometer.removeAllListeners();
            LightSensor.removeAllListeners();
            return;
        }

        // 1. Configure Sensors
        Accelerometer.setUpdateInterval(200);
        LightSensor.setUpdateInterval(500);

        let lastData = { x: 0, y: 0, z: 0 };
        let stabilityScore = 100;
        let lightingScore = 100; // Default good for iOS

        const subscriptionAccel = Accelerometer.addListener(data => {
            // Calculate movement delta
            const delta = Math.abs(data.x - lastData.x) +
                Math.abs(data.y - lastData.y) +
                Math.abs(data.z - lastData.z);

            lastData = data;

            // Delta < 0.1 is very stable. Delta > 0.5 is moving.
            // Map delta 0.0-0.5 to score 100-0
            stabilityScore = Math.max(0, Math.min(100, 100 - (delta * 200)));

            updateReadiness(stabilityScore, lightingScore);
        });

        let subscriptionLight: any;
        if (Platform.OS === 'android') {
            subscriptionLight = LightSensor.addListener(data => {
                // Lux < 10 is dark. Lux > 50 is okay. Lux > 200 is great.
                // Map 0-200 lux to 0-100 score
                lightingScore = Math.min(100, (data.illuminance / 200) * 100);
                updateReadiness(stabilityScore, lightingScore);
            });
        }

        const updateReadiness = (stability: number, lighting: number) => {
            // Composite Score: Stability (60%) + Lighting (40%)
            const totalScore = Math.round((stability * 0.6) + (lighting * 0.4));

            setReadinessScore(prev => {
                // Smooth transition
                const diff = totalScore - prev;
                return Math.round(prev + (diff * 0.2));
            });

            // Update messages based on lowest factor
            if (stability < 50) {
                setEncouragementMessage("Hold steady for a clear shot 📸");
            } else if (lighting < 30) {
                setEncouragementMessage("It's a bit dark, try better lighting 💡");
            } else if (totalScore >= 80) {
                setEncouragementMessage("Perfect! Ready to capture ✨");
            } else {
                // Show greeting/context when aligning
                setEncouragementMessage(getGreeting());
            }

            // Haptic trigger for crossing threshold
            if (Platform.OS !== 'web' && totalScore >= 80 && prevReadinessScore.current < 80) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            prevReadinessScore.current = totalScore;
        };

        return () => {
            subscriptionAccel && subscriptionAccel.remove();
            subscriptionLight && subscriptionLight.remove();
        };

    }, [isScanning, isAnalyzing]);

    useEffect(() => {
        if (isScanning) {
            startScanAnimation();
        }
    }, [isScanning]);

    const getGreeting = (): string => {
        const hour = new Date().getHours();
        const isFirstScanToday = todaysScans.length === 0;

        if (isFirstScanToday) {
            if (hour < 12) return "Good morning! ☀️ Let's log your breakfast!";
            if (hour < 17) return "Lunch time? 🥗 Capture it clearly!";
            return "Dinner time! 🌙 Align your meal...";
        }

        return "Keep it steady... capturing goodness 🍎";
    };

    const startScanAnimation = () => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(scanLineAnim, {
                    toValue: 1,
                    duration: 1500, // Slightly faster for more "tech" feel
                    useNativeDriver: true,
                }),
                Animated.timing(scanLineAnim, {
                    toValue: 0,
                    duration: 0,
                    useNativeDriver: true,
                })
            ])
        ).start();
    };

    const runAnalysisLabels = () => {
        const labels = [
            "Identifying ingredients...",
            "Estimating portion sizes...",
            "Calculating nutritional density...",
            "Checking against your goals...",
            "Finalizing macro breakdown..."
        ];
        let index = 0;
        const interval = setInterval(() => {
            if (!isAnalyzing) {
                clearInterval(interval);
                return;
            }
            index = (index + 1) % labels.length;
            setAnalysisLabels(labels[index]);
        }, 1200);
        return () => clearInterval(interval);
    };

    useEffect(() => {
        if (isAnalyzing) {
            runAnalysisLabels();
        }
    }, [isAnalyzing]);

    async function processImage(base64Image: string, imageUri: string) {
        try {
            setIsAnalyzing(true);
            setCapturedImageUri(imageUri); // Freeze the frame
            console.log('[FoodScanner] Processing image...', Math.round(base64Image.length / 1024), 'KB');

            // STEP 1: Upload to Supabase Storage
            console.log('[FoodScanner] Uploading to Storage...');
            const userId = (await supabase.auth.getUser()).data.user?.id;
            if (!userId) throw new Error("Authentication Required");

            const publicUrl = await uploadFoodImage(base64Image, userId);
            console.log('[FoodScanner] Uploaded to Cloud');

            // STEP 2: AI Analysis (Absolute Harmony Standard)
            console.log('[FoodScanner] AI Analysis...');
            let userContext = '';
            if (userGoals) {
                userContext = `User Goal: ${userGoals.goal_type || 'improve health'}. 
Daily Targets: [Calories: ${userGoals.daily_calorie_goal}kcal, Protein: ${userGoals.daily_protein_goal}g].
Current Progress TODAY: [Calories: ${macroProgress.calories}kcal, Protein: ${macroProgress.protein}g, Carbs: ${macroProgress.carbs}g, Fats: ${macroProgress.fats}g, Fiber: ${macroProgress.fiber}g].
Tailor the recommendation and workoutAdvice for this specific user based on these numbers.`;
            }

            // We use Promise.all to ensure the analysis feels substantial and builds anticipation
            // Guaranteed 3 seconds of high-tech scanning visuals
            const [result] = await Promise.all([
                analyzeFoodImage(publicUrl, true, userContext, { 
                    gender: gender, 
                    userName: user?.name || 'Friend' 
                }),
                new Promise(resolve => setTimeout(resolve, 3000))
            ]);

            console.log('[FoodScanner] AI result:', result.foodName);

            const isUnknown = result.confidenceScore < 0.3 || result.isFallback;

            if (isUnknown) {
                console.log('[FoodScanner] Scan unclear, asking user to rescan');
                setScanHint('Try again');
                Alert.alert('Scan Unclear', 'Could not identify the food clearly. Please try again with a better-lit, clearer image.');
                return;
            }

            // result is already sanitized to camelCase ScannerResult
            const processedResult = {
                ...result,
                imageUri: publicUrl,
                status: 'success',
                meal_type: mealType
            };

            // STEP 3: Mandatory Automatic Save to meal_scans
            console.log('[FoodScanner] 💾 Persisting to Supabase...');
            const newScanId = await saveMealScan(processedResult);
            if (newScanId) setSavedScanId(newScanId);
            console.log('[FoodScanner] ✅ Record Created');
            // Mark scanner as used at least once so tutorial never shows again
            AsyncStorage.setItem('scanner_used_once', 'true').catch(() => { });

            // Final: Show Results with celebration
            if (Platform.OS !== 'web') {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            setBaseScanResult(processedResult); // Save base for calculations
            setScanResult(processedResult);
            analyzeMealAgainstGoal(processedResult, result);
            setIsScanning(false);

        } catch (error: any) {
            console.error(`[FoodScanner] ❌ Error: ${error.message}`);
            console.error("[FoodScanner] Production Flow Error:", error);
            setScanHint('Try again');
            Alert.alert('Scan Failed', error.message || 'Unable to scan food. Please try again.');
        } finally {
            setIsAnalyzing(false);
            console.log('[FoodScanner] 🏁 Flow Finished');
        }
    }

    async function handleScan() {
        // Always wake the AI bubble as soon as the user taps the camera,
        // even if the camera ref is missing (e.g. web / permissions).
        console.log('[FoodScanner] handleScan() tapped camera, notifying CoachCharacter');
        char?.fireMealScanStarted();

        if (!cameraRef.current) {
            console.error('[FoodScanner] Camera ref is null');
            return;
        }

        // Haptic feedback on capture
        if (Platform.OS !== 'web') {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }

        try {
            console.log('[FoodScanner] Capturing...');

            // Shutter Flash
            flashAnim.setValue(1);
            Animated.timing(flashAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();

            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.5,
                base64: true,
                skipProcessing: false
            });

            if (!photo || !photo.base64) throw new Error("Capture Failed");
            
            await processImage(photo.base64, photo.uri);

        } catch (error: any) {
            console.error(`[FoodScanner] ❌ Capture Error: ${error.message}`);
            Alert.alert('Capture Failed', error.message || 'Unable to capture image. Please try again.');
            setIsAnalyzing(false);
        }
    }

    async function handlePickImage() {
        try {
            // Request permissions
            if (Platform.OS !== 'web') {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Permission needed', 'Please grant photo library access to select images.');
                    return;
                }
            }

            // Haptic feedback
            if (Platform.OS !== 'web') {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }

            // Excite the AI bubble when user chooses an image to analyze
            char?.fireMealScanStarted();

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
                base64: true,
            });

            if (result.canceled || !result.assets || result.assets.length === 0) {
                return;
            }

            const asset = result.assets[0];
            if (!asset.base64) {
                Alert.alert('Error', 'Could not process selected image. Please try another image.');
                return;
            }

            await processImage(asset.base64, asset.uri);

        } catch (error: any) {
            console.error(`[FoodScanner] ❌ Image Picker Error: ${error.message}`);
            Alert.alert('Error', error.message || 'Failed to select image. Please try again.');
            setIsAnalyzing(false);
        }
    }

    async function saveMealScan(meal: any) {
        try {
            console.log('[FoodScanner] Auto-saving to meal_scans...');
            const { data, error } = await (supabase as any)
                .from('meal_scans')
                .insert([{
                    user_id: (await supabase.auth.getUser()).data.user?.id,
                    food_name: meal.foodName,
                    calories: meal.calories,
                    protein: meal.protein,
                    carbs: meal.carbs,
                    fat: meal.fats || meal.fat,
                    portion_size: meal.servingSize,
                    confidence_score: meal.confidenceScore,
                    image_url: meal.imageUri,
                    portion_multiplier: 1.0
                }])
                .select()
                .single();

            if (error) {
                console.warn('[FoodScanner] Skipping meal_scans auto-save due to DB error (ignoring so user can continue):', error.message);
                return null;
            }
            console.log('[FoodScanner] Scan saved successfully, ID:', data.id);
            // Refresh data instantly
            await fetchUserData();
            return data.id;
        } catch (err: any) {
            console.warn('[FoodScanner] Auto-save exception:', err.message);
            return null;
        }
    }

    async function updateDetailedScan(finalResult: any) {
        if (!savedScanId) return;
        try {
            console.log(`[FoodScanner] Updating scan ${savedScanId} with final adjustments...`);
            const { error } = await (supabase as any)
                .from('meal_scans')
                .update({
                    calories: finalResult.calories,
                    protein: finalResult.protein,
                    carbs: finalResult.carbs,
                    fat: finalResult.fats || finalResult.fat,
                    portion_multiplier: finalResult.portionMultiplier || 1.0
                })
                .eq('id', savedScanId);

            if (error) throw error;
            console.log('[FoodScanner] Scan updated successfully.');
            // Refresh one last time before closing
            await fetchUserData();
        } catch (err) {
            console.error('[FoodScanner] Update error:', err);
        }
    }

    function analyzeMealAgainstGoal(meal: ScannerResult, aiResult?: any) {
        const goal = userGoals?.goal_type || 'muscle_gain';
        const proteinGoal = userGoals?.daily_protein_goal || 0;
        const calorieGoal = userGoals?.daily_calorie_goal || 2000;

        const currentProtein = macroProgress.protein + (meal.protein || 0);
        const currentCalories = macroProgress.calories + (meal.calories || 0);

        const remainingProtein = Math.max(0, proteinGoal - currentProtein);
        const remainingCalories = Math.max(0, calorieGoal - currentCalories);

        let status = 'On Track';
        let recommendation = '';
        let nextStep = '';
        let color = COLORS.accentGreen;

        const isLowProtein = (meal.protein || 0) < 15;
        const isHighCalorie = (meal.calories || 0) > 600;

        // PRIORITY 1: USE AI Recommendations (Smarter & Actionable)
        if (meal.recommendation || meal.workoutAdvice) {
            recommendation = meal.recommendation || recommendation;
            nextStep = meal.workoutAdvice || nextStep;

            // If AI gave us a status or we can determine a better one based on goal
            // IMPORTANT: Never label protein deficit for meals that already have 30g+ protein.
            if (remainingProtein > 30 && currentCalories > (calorieGoal * 0.7) && (meal.protein || 0) < 30) {
                status = 'Protein Deficit Risk';
                color = COLORS.brandYellow;
            } else if (remainingCalories < 200 && remainingProtein > 10) {
                status = 'Calorie Limit Near';
                color = '#EF4444';
            } else if (remainingProtein === 0) {
                status = 'Protein Goal Reached';
                color = COLORS.accentGreen;
            }
        } else {
            // FALLBACK: The Fitness Sibling Verdict (High Energy & Comitted)
            // Again, do not scream "protein protest" if this individual meal already has 30g+ protein.
            if (remainingProtein > 30 && currentCalories > (calorieGoal * 0.7) && (meal.protein || 0) < 30) {
                status = 'PROTEIN PROTEST';
                color = COLORS.brandYellow;
                recommendation = "Listen, your calorie budget is disappearing but your muscles are still waiting for an invite to the protein party. We can't let them starve like this.";
                nextStep = "Go grab two boiled eggs and a glass of water right now—I'll wait. Don't make me come over there and peel them for you. Just execute.";
            } else if (isHighCalorie && isLowProtein) {
                status = 'HOLLOW GAINS';
                color = COLORS.brandYellow;
                recommendation = "Bestie, this meal is a master of disguise—plenty of calories, but the protein is nowhere to be found. It's a plot hole in our gains journey.";
                nextStep = "Set a timer for 2 hours from now. When it goes off, you're having a high-protein shake. No side quests, just progress.";
            } else if (remainingCalories < 200 && remainingProtein > 10) {
                status = 'CALORIE CEILING';
                color = '#EF4444'; // Red for warning
                recommendation = "My guy, we've reached the 'Final Boss' of today's calories, yet the protein quest is incomplete. Precision eating is now mandatory.";
                nextStep = "Move all the snacks to the highest shelf in the kitchen. If you're bored later, drink a glass of lemon water and text me 'I'm a legend' instead.";
            } else if (remainingProtein === 0) {
                status = 'LEGENDARY STATUS';
                color = COLORS.accentGreen;
                recommendation = "Is this... elite discipline? I'm almost proud of us. You hit that protein target while mortals are still scrolling through menus.";
                nextStep = "Take a mental snapshot of this win. Lock it in. This is exactly how we're going to dominate the rest of the week.";
            } else {
                status = 'STUNNINGLY ON TRACK';
                color = COLORS.accentGreen;
                recommendation = "This meal actually makes sense. I'm starting to think you're taking this as seriously as I am. Keep this energy!";
                nextStep = "Don't change a single thing for the next 4 hours. Keep this momentum and your future 'summer body' self will thank you.";
            }
        }

        // Daily macro context: show remaining/over protein and calories after this meal
        // in a very human, partner-style tone (but still strictly based on today's totals).
        const proteinDelta = currentProtein - proteinGoal;
        const calorieDelta = currentCalories - calorieGoal;
        const proteinClause = proteinGoal > 0
            ? (proteinDelta <= -5
                ? `We still owe about ${Math.round(-proteinDelta)}g of protein today.`
                : proteinDelta >= 5
                    ? `We are about ${Math.round(proteinDelta)}g over today's protein target.`
                    : 'Protein-wise, we are basically on target for today.')
            : '';
        const calorieClause = calorieGoal > 0
            ? (calorieDelta <= -80
                ? `We still have roughly ${Math.round(-calorieDelta)} kcal of room today.`
                : calorieDelta >= 80
                    ? `We are about ${Math.round(calorieDelta)} kcal over today\u2019s budget.`
                    : 'Calories are basically where we want them for today.')
            : '';
        const macroSummary = [proteinClause, calorieClause].filter(Boolean).join(' ');
        if (macroSummary) {
            recommendation = recommendation
                ? `${recommendation} ${macroSummary}`
                : macroSummary;
        }

        const workoutAdvice = meal.workoutAdvice || (meal.calories > 400
            ? 'Consider a 20-min walk to assist digestion and calorie balance.'
            : 'Looks like a great pre/post workout meal!');

        // Determine Health Score (1-10) — always set so Nutrition Rating is never blank
        const calories = Number(meal.calories) || 1;
        const protein = Number(meal.protein) || 0;
        let healthScore = typeof meal.healthScore === 'number' && !Number.isNaN(meal.healthScore)
            ? meal.healthScore
            : 0;
        if (healthScore < 1 || healthScore > 10) {
            const pRatio = (protein * 4) / Math.max(1, calories);
            const isMuscleGoal = goal === 'muscle_gain' || goal === 'strength';
            if (isMuscleGoal) {
                healthScore = pRatio > 0.3 ? 9 : pRatio > 0.2 ? 7 : pRatio > 0.1 ? 5 : 3;
            } else {
                healthScore = calories < 400 ? 8 : calories < 600 ? 6 : 4;
            }
            healthScore = Math.min(10, Math.max(1, healthScore));
        }
        const finalHealthScore = Number.isNaN(healthScore) ? 5 : Math.min(10, Math.max(1, healthScore));

        setAnalysis({ status, recommendation, nextStep, workoutAdvice, color, healthScore: finalHealthScore });
    }

    // Excite the AI bubble when user sees scan result + nutrition rating
    // and gently dock it near the Nutrition Rating card while on this screen.
    useEffect(() => {
        if (!analysis?.healthScore || !scanResult || !char) return;

        // Prevent infinite loops: only fire when healthScore/scan result combo actually changes.
        const key = `${analysis.healthScore}-${scanResult.foodName}-${scanResult.imageUri}`;
        if (lastScanEffectKeyRef.current === key) return;
        lastScanEffectKeyRef.current = key;

        char.fireMealScanned(analysis.healthScore, scanResult.bubbleQuip);

        // Cache previous position once
        if (!previousBubblePositionRef.current && char.bubblePosition) {
            previousBubblePositionRef.current = char.bubblePosition;
        }

        // Move bubble toward a fixed anchor near the Nutrition Rating card
        char.setBubblePosition({
            x: 1,    // push to the right edge (clamped safely)
            y: 0.32, // slightly lower for fine-tuned positioning
            normalized: true,
        });
    }, [analysis?.healthScore, scanResult, char]);

    // Restore bubble position when leaving the FoodScanner screen
    useEffect(() => {
        return () => {
            if (char && previousBubblePositionRef.current) {
                char.setBubblePosition(previousBubblePositionRef.current);
            }
        };
    }, [char]);

    const resetScan = () => {
        setIsScanning(true);
        setScanResult(null);
        setBaseScanResult(null);
        setSavedScanId(null);
        setScanHint(null);
        setCapturedImageUri(null); // Clear frozen frame
        hintAnim.setValue(0);
    };

    const handlePortionChange = (multiplier: number) => {
        if (!baseScanResult) return;

        console.log(`[FoodScanner] Adjusting portion: ${multiplier}x`);

        // Recalculate everything based on base result
        const adjustedResult: ScannerResult = {
            ...baseScanResult,
            calories: Math.round(baseScanResult.calories * multiplier),
            protein: Math.round(baseScanResult.protein * multiplier),
            carbs: Math.round(baseScanResult.carbs * multiplier),
            fats: Math.round(baseScanResult.fats * multiplier),
            fiberG: Math.round((baseScanResult.fiberG || 0) * multiplier),
            sugarG: Math.round((baseScanResult.sugarG || 0) * multiplier),
            sodiumMg: Math.round((baseScanResult.sodiumMg || 0) * multiplier),
            portionMultiplier: multiplier
        } as any;

        setScanResult(adjustedResult);
        analyzeMealAgainstGoal(adjustedResult); // Re-run analysis with new numbers
    };

    const handleLogCurrentMeal = async () => {
        if (isLogging || !scanResult) return;
        setIsLogging(true);
        try {
            console.log('[FoodScanner] Add to Log clicked. scanResult:', scanResult);

            await Promise.all([
                (async () => {
                    if (scanResult.portionMultiplier !== 1) {
                        await updateDetailedScan(scanResult);
                    }
                    if (onScanComplete) await onScanComplete(scanResult);
                })(),
                new Promise(resolve => setTimeout(resolve, 800))
            ]);
        } finally {
            setIsLogging(false);
        }
    };

    const renderNutritionBreakdown = () => {
        if (!scanResult) return null;

        const macros = [
            { label: 'Protein', value: scanResult.protein || 0, color: COLORS.brandYellow, icon: 'food-drumstick' },
            { label: 'Carbs', value: scanResult.carbs || 0, color: COLORS.accentBlue, icon: 'corn' },
            { label: 'Fats', value: scanResult.fats || scanResult.fat || 0, color: COLORS.accentGreen, icon: 'oil' },
            { label: 'Fiber', value: scanResult.fiberG || scanResult.fiber || 0, color: '#22C55E', icon: 'leaf' },
        ];

        const totalMacros = macros.reduce((sum, m) => sum + m.value, 0);

        return (
            <View style={styles.breakdownContainer}>
                <Text style={styles.cardTitle}>Nutrition Breakdown</Text>
                {macros.map((macro, index) => (
                    <View key={index} style={styles.macroRow}>
                        <View style={styles.macroHeader}>
                            <View style={styles.macroLabelGroup}>
                                <MaterialCommunityIcons name={macro.icon as any} size={18} color={macro.color} />
                                <Text style={styles.macroLabel}>{macro.label}</Text>
                            </View>
                            <Text style={styles.macroValue}>{macro.value}g</Text>
                        </View>
                        <View style={styles.macroBarBg}>
                            <View
                                style={[
                                    styles.macroBarFill,
                                    {
                                        width: `${totalMacros > 0 ? (macro.value / totalMacros) * 100 : 33.3}%`,
                                        backgroundColor: macro.color
                                    }
                                ]}
                            />
                        </View>
                    </View>
                ))}
            </View>
        );
    };


    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Camera / Scanner Section (hidden after a successful scan) */}
            {!scanResult && (
                <View style={[styles.cameraContainer, Platform.OS === 'web' && { height: 400 }]}>
                    {hasPermission === null ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={COLORS.brandGreen} />
                            <Text style={{ marginTop: 10, color: '#6B7280' }}>Initializing Camera...</Text>
                        </View>
                    ) : hasPermission ? (
                        <View style={{ flex: 1 }}>
                            <CameraView
                                style={[styles.camera, Platform.OS === 'web' && { width: '100%', height: '100%' }]}
                                facing={facing}
                                ref={cameraRef}
                                autofocus="on"
                                zoom={zoom}
                            />

                            {/* OVERLAYS AS SIBLINGS FOR GUARANTEED LAYERING */}
                            <Animated.View style={[
                                StyleSheet.absoluteFill,
                                { backgroundColor: 'white', opacity: flashAnim, zIndex: 1000, elevation: 20 }
                            ]} pointerEvents="none" />

                            {/* Frozen Frame Overlay */}
                            {capturedImageUri && (
                                <Image
                                    source={{ uri: capturedImageUri }}
                                    style={[StyleSheet.absoluteFill, { zIndex: 50 }]}
                                    resizeMode="cover"
                                />
                            )}

                            {/* Scanning UI Layer */}
                            <View
                                style={[
                                    StyleSheet.absoluteFill,
                                    styles.cameraOverlay,
                                    { zIndex: 100, elevation: 10 },
                                    isAnalyzing && { backgroundColor: 'rgba(0,0,0,0.2)' } // Subtle dim for contrast
                                ]}
                            >
                                {/* Header inside Camera */}
                                <SafeAreaView style={styles.headerSafe}>
                                    <View style={styles.header}>
                                        <View style={styles.brandContainer} />
                                        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                                            <Ionicons name="close" size={18} color="#FFF" />
                                        </TouchableOpacity>
                                    </View>
                                </SafeAreaView>

                                {/* Scanner Viewfinder */}
                                <View style={styles.scannerZone}>
                                    <View style={styles.scanFrame}>
                                        {/* Corner Markers */}
                                        <View style={[styles.corner, styles.tl, isAnalyzing && { borderColor: COLORS.accentYellow }]} />
                                        <View style={[styles.corner, styles.tr, isAnalyzing && { borderColor: COLORS.accentYellow }]} />
                                        <View style={[styles.corner, styles.bl, isAnalyzing && { borderColor: COLORS.accentYellow }]} />
                                        <View style={[styles.corner, styles.br, isAnalyzing && { borderColor: COLORS.accentYellow }]} />

                                        {/* Scanning Laser Line (thin, no glow, behind button) */}
                                        {(isScanning || isAnalyzing) && (
                                            <Animated.View
                                                style={[
                                                    styles.laserLine,
                                                    {
                                                        zIndex: -1,
                                                        elevation: 0,
                                                        transform: [{
                                                            translateY: scanLineAnim.interpolate({
                                                                inputRange: [0, 1],
                                                                outputRange: [0, 280]
                                                            })
                                                        }],
                                                        opacity: scanLineAnim.interpolate({
                                                            inputRange: [0, 0.1, 0.9, 1],
                                                            outputRange: [0, 1, 1, 0]
                                                        })
                                                    }
                                                ]}
                                            />
                                        )}

                                        {/* Technological Grid Effect during Analysis */}
                                        {isAnalyzing && (
                                            <View style={[StyleSheet.absoluteFill, { zIndex: 50, opacity: 0.15 }]}>
                                                <Svg width="100%" height="100%">
                                                    <G stroke={COLORS.accentYellow} strokeWidth="0.3">
                                                        {[...Array(12)].map((_, i) => (
                                                            <React.Fragment key={i}>
                                                                <Line x1={`${(i + 1) * 7.7}%`} y1="0" x2={`${(i + 1) * 7.7}%`} y2="100%" />
                                                                <Line x1="0" y1={`${(i + 1) * 7.7}%`} x2="100%" y2={`${(i + 1) * 7.7}%`} />
                                                            </React.Fragment>
                                                        ))}
                                                    </G>
                                                </Svg>
                                            </View>
                                        )}
                                    </View>

                                    {/* Analysis Message Overlay */}
                                    {isAnalyzing && (
                                        <View style={[styles.analysisLabelsContainer, { zIndex: 250, elevation: 0 }]}>
                                                            <LinearGradient
                                                // Fully transparent bar; only text + icon visible, similar to meal description vibe
                                                colors={['transparent', 'transparent']}
                                                style={styles.analysisLabelPill}
                                            >
                                                <ActivityIndicator size="small" color={COLORS.brandYellow} />
                                                <Text style={styles.analysisLabelText}>{analysisLabels}</Text>
                                            </LinearGradient>
                                        </View>
                                    )}
                                    {/* Readiness Indicators - Only on Mobile (Real Sensors) */}
                                    {isScanning && Platform.OS !== 'web' && (
                                        <View style={styles.readinessOverlay}>
                                            {/* Readiness Bar */}
                                            <View style={styles.readinessBar}>
                                                <View style={[
                                                    styles.readinessFill,
                                                    {
                                                        width: `${readinessScore}%`,
                                                        backgroundColor: readinessScore >= 80 ? COLORS.accentGreen :
                                                            readinessScore >= 50 ? COLORS.brandYellow : '#EF4444'
                                                    }
                                                ]} />
                                            </View>

                                            {/* Feedback Chips */}
                                            <View style={styles.feedbackChips}>
                                                <View style={styles.feedbackChip}>
                                                    <MaterialCommunityIcons
                                                        name={readinessScore >= 80 ? "check-circle" : "camera"}
                                                        size={16}
                                                        color={readinessScore >= 80 ? COLORS.accentGreen : '#FFF'}
                                                    />
                                                    <Text style={styles.chipText}>
                                                        {readinessScore >= 80 ? '✓ Ready!' : `${readinessScore}%`}
                                                    </Text>
                                                </View>

                                                {readinessScore >= 70 && (
                                                    <View style={styles.feedbackChip}>
                                                        <MaterialCommunityIcons name="white-balance-sunny" size={16} color="#FBBF24" />
                                                        <Text style={styles.chipText}>Good light</Text>
                                                    </View>
                                                )}
                                            </View>

                                            {/* Encouragement Message */}
                                            <Text style={styles.readinessMessage}>
                                                {encouragementMessage}
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                {/* Camera Actions */}
                                <View style={styles.cameraControls}>
                                    <View style={styles.cameraActionsRow}>
                                        {/* Gallery Button */}
                                        <TouchableOpacity
                                            style={styles.galleryBtn}
                                            onPress={handlePickImage}
                                            activeOpacity={0.8}
                                            disabled={isAnalyzing}
                                        >
                                            <Ionicons name="images" size={24} color="#FFF" />
                                        </TouchableOpacity>

                                        {/* Capture Button */}
                                        <View style={[
                                            styles.captureRing,
                                            readinessScore >= 50 && styles.captureRingReady
                                        ]}>
                                            <TouchableOpacity
                                                style={styles.captureBtnWrapper}
                                                onPress={handleScan}
                                                activeOpacity={0.8}
                                                disabled={isAnalyzing || readinessScore < 30} // Allow capture if readiness is at least 30%
                                            >
                                                <LinearGradient
                                                    colors={readinessScore >= 80
                                                        ? [COLORS.accentGreen, '#059669']
                                                        : readinessScore >= 50
                                                            ? [COLORS.brandYellow, '#D97706'] // Warning color for medium readiness
                                                            : ['#EF4444', '#B91C1C'] // Danger color for low readiness
                                                    }
                                                    style={styles.captureBtn}
                                                >
                                                    {isAnalyzing ? (
                                                        <ActivityIndicator color="#FFF" />
                                                    ) : (
                                                        <>
                                                            <Ionicons name="camera" size={24} color="#FFF" />
                                                            <Text style={styles.captureText}>
                                                                {readinessScore >= 50 ? 'Scan Now' : 'Analyze Meal'}
                                                            </Text>
                                                        </>
                                                    )}
                                                </LinearGradient>
                                            </TouchableOpacity>
                                        </View>

                                        {/* Spacer for symmetry */}
                                        <View style={styles.galleryBtn} />
                                    </View>
                                </View>
                            </View>
                        </View>
                    ) : (
                        <View style={[styles.camera, { backgroundColor: '#111827', justifyContent: 'center', alignItems: 'center' }]}>
                            <MaterialCommunityIcons name="camera-off" size={64} color="#374151" />
                            <Text style={{ color: 'white', marginTop: 20, fontSize: 18, fontWeight: 'bold' }}>Camera Missing Permission</Text>
                            <Text style={{ color: '#9CA3AF', marginTop: 8, textAlign: 'center', paddingHorizontal: 40 }}>
                                Please grant camera access to scan your meals, or select an image from your gallery.
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 12, marginTop: 30 }}>
                                <TouchableOpacity
                                    onPress={handlePickImage}
                                    style={{ paddingHorizontal: 24, paddingVertical: 12, backgroundColor: COLORS.brandYellow, borderRadius: 12 }}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Ionicons name="images" size={20} color="#000" />
                                        <Text style={{ color: '#000', fontWeight: 'bold' }}>Select from Gallery</Text>
                                    </View>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => {
                                        console.log('[FoodScanner] Manual Permission Request');
                                        requestPermission();
                                    }}
                                    style={{ paddingHorizontal: 24, paddingVertical: 12, backgroundColor: COLORS.brandGreen, borderRadius: 12 }}
                                >
                                    <Text style={{ color: 'white', fontWeight: 'bold' }}>Enable Camera</Text>
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity onPress={onClose} style={{ marginTop: 20 }}>
                                <Text style={{ color: '#6B7280' }}>Go Back</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            )}

            {/* Results / Summary */}
            <ScrollView
                style={styles.resultsScroll}
                contentContainerStyle={styles.resultsContent}
                showsVerticalScrollIndicator={false}
            >
                {scanResult ? (
                    <View>
                        {/* Captured image with brief overlay */}
                        <View style={styles.resultHero}>
                            {scanResult.imageUri ? (
                                <Image
                                    source={{ uri: scanResult.imageUri }}
                                    style={styles.resultHeroImage}
                                    resizeMode="cover"
                                />
                            ) : null}
                            <View style={styles.resultHeroOverlay}>
                                <Text style={styles.resultHeroTitle}>{scanResult.foodName}</Text>
                                <Text style={styles.resultHeroSubtitle} numberOfLines={1}>
                                    <Text style={styles.resultHeroSubtitleValue}>{scanResult.calories}</Text>
                                    <Text style={styles.resultHeroSubtitleLabel}> kcal  </Text>
                                    <Text style={styles.resultHeroSubtitleLabel}>Protein </Text>
                                    <Text style={styles.resultHeroSubtitleValue}>{scanResult.protein ?? 0}g  </Text>
                                    <Text style={styles.resultHeroSubtitleLabel}>Carbs </Text>
                                    <Text style={styles.resultHeroSubtitleValue}>{scanResult.carbs ?? 0}g  </Text>
                                    <Text style={styles.resultHeroSubtitleLabel}>Fats </Text>
                                    <Text style={styles.resultHeroSubtitleValue}>{scanResult.fats ?? scanResult.fat ?? 0}g  </Text>
                                    <Text style={styles.resultHeroSubtitleLabel}>Fiber </Text>
                                    <Text style={styles.resultHeroSubtitleValue}>{scanResult.fiberG ?? scanResult.fiber ?? 0}g</Text>
                                </Text>
                            </View>
                        </View>

                        {/* Nutrition Rating + AI reaction orb (exaggerated expression from score) */}
                        {analysis && (
                            <View style={styles.cardShadowWrapper}>
                                <View style={styles.nourishRow}>
                                    <View style={[styles.nourishContainer, styles.nourishFlex]}>
                                        <View style={styles.nourishHeader}>
                                            <View style={styles.nourishTitleGroup}>
                                                <MaterialCommunityIcons name="star-face" size={20} color={COLORS.brandYellow} />
                                                <Text style={styles.nourishTitle}>Nutrition Rating</Text>
                                            </View>
                                            <Text style={styles.nourishValue}>{Number(analysis.healthScore) || 5}/10</Text>
                                        </View>
                                        <View style={styles.nourishBarBg}>
                                            <LinearGradient
                                                colors={['#FCD34D', '#10B981', '#059669']}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 0 }}
                                                style={[styles.nourishBarFill, { width: `${Math.min(100, Math.max(0, ((Number(analysis.healthScore) || 5) / 10) * 100))}%` }]}
                                            />
                                        </View>
                                    </View>
                                </View>
                            </View>
                        )}

                        {/* Verdict / Insight — buddy voice, quotable for caption */}
                        {analysis && (
                            <View style={styles.cardShadowWrapper}>
                                <View style={[styles.insightCard, { borderColor: analysis.color }]}>
                                    <View style={styles.insightHeader}>
                                        <View style={[styles.statusBadge, { backgroundColor: analysis.color }]}>
                                            <Text style={styles.statusBadgeText}>{analysis.status}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={styles.insightTitle}>Verdict</Text>
                                            <MaterialCommunityIcons name="fire" size={18} color={analysis.color} />
                                        </View>
                                    </View>
                                    <Text style={styles.insightDescription}>{analysis.recommendation}</Text>
                                    <View style={styles.nextStepBox}>
                                        <View style={styles.assignmentHeader}>
                                            <MaterialCommunityIcons name="run-fast" size={16} color={COLORS.brandYellow} />
                                            <Text style={styles.assignmentTitle}>Assignment</Text>
                                        </View>
                                        <Text style={styles.nextStepText}>{analysis.nextStep}</Text>
                                    </View>
                                </View>
                            </View>
                        )}

                        {/* Detailed Breakdown */}
                        {renderNutritionBreakdown()}

                        {/* Current Progress Mini Card */}
                        <View style={styles.dailySummaryWrap}>
                            <View style={styles.summaryRow}>
                                <View>
                                    <Text style={styles.summaryLabel}>Daily Protein Progress</Text>
                                    <View style={styles.summaryValueContainer}>
                                        <Text style={styles.summaryValue}>
                                            {Math.round(macroProgress.protein || 0)}g
                                        </Text>
                                        <Text style={styles.summaryTotal}> / {userGoals?.daily_protein_goal || 0}g</Text>
                                    </View>
                                </View>
                                <View style={[styles.progressCircle, { borderColor: macroProgress.protein >= (userGoals?.daily_protein_goal || 0) ? COLORS.accentGreen : COLORS.brandYellow }]}>
                                    <Text style={[styles.progressPercent, { color: macroProgress.protein >= (userGoals?.daily_protein_goal || 0) ? COLORS.accentGreen : COLORS.brandYellow }]}>
                                        {Math.round(((macroProgress.protein || 0) / (userGoals?.daily_protein_goal || 1)) * 100)}%
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.progressBarBg}>
                                <View
                                    style={[
                                        styles.progressBarFill,
                                        {
                                            width: `${Math.min(100, ((macroProgress.protein || 0) / (userGoals?.daily_protein_goal || 1)) * 100)}%`,
                                            backgroundColor: macroProgress.protein >= (userGoals?.daily_protein_goal || 0) ? COLORS.accentGreen : COLORS.brandYellow
                                        }
                                    ]}
                                />
                            </View>
                        </View>

                    </View>
                ) : (
                    <View style={{ alignItems: 'center', padding: 40, opacity: 0.5 }}>
                        <MaterialCommunityIcons name="camera-iris" size={48} color="#D1D5DB" />
                        <Text style={{ color: '#6B7280', marginTop: 12 }}>
                            {scanHint || 'Ready to scan your meal'}
                        </Text>
                    </View>
                )}

                {/* Today's Logs Section */}
                <View style={styles.historySection}>
                    <Text style={styles.sectionTitle}>Today's Scans</Text>
                    {todaysScans.length > 0 ? (
                        todaysScans.map((item, idx) => (
                            <View key={item.id || idx} style={styles.historyItem}>
                                <View style={styles.historyThumb}>
                                    <MaterialCommunityIcons
                                        name={item.calories > 400 ? "food-drumstick" : "leaf"}
                                        size={20}
                                        color={COLORS.brandGreen}
                                    />
                                </View>
                                <View style={styles.historyInfo}>
                                    <Text style={styles.historyName}>{item.food_name}</Text>
                                    <View style={styles.miniMacroRow}>
                                        <Text style={styles.miniMacroText}>{item.calories} cal</Text>
                                        <Text style={[styles.miniMacroText, { marginLeft: 10, color: COLORS.accentBlue }]}>
                                            {item.protein}g Protein
                                        </Text>
                                    </View>
                                </View>
                                <Text style={styles.historyTime}>
                                    {new Date(item.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.emptyHistory}>No scans logged today yet.</Text>
                    )}
                </View>


                <View style={{ height: scanResult ? 150 : 120 }} />
            </ScrollView>

            {scanResult && (
                <View style={[styles.floatingActionBar, { bottom: Math.max(12, insets.bottom + 8) }]}>
                    <View style={styles.actionRow}>
                        <TouchableOpacity style={styles.secondaryBtn} onPress={resetScan}>
                            <Text style={styles.secondaryBtnText}>Rescan</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.primaryBtn, isLogging && { opacity: 0.7 }]}
                            disabled={isLogging}
                            onPress={handleLogCurrentMeal}
                        >
                            <LinearGradient
                                colors={[COLORS.brandGreen, COLORS.brandYellow]}
                                style={styles.btnGradient}
                            >
                                {isLogging ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                    <>
                                        <Ionicons name="add-circle-outline" size={20} color="#FFF" />
                                        <Text style={styles.primaryBtnText}>Log this meal</Text>
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* First-time User Tutorial Overlay */}
            <ScannerTutorial />

            {/* Center hint for rescan */}
            {scanHint === 'Try again' && (
                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.hintOverlay,
                        {
                            opacity: hintAnim,
                            transform: [
                                {
                                    scale: hintAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0.9, 1],
                                    }),
                                },
                            ],
                        },
                    ]}
                >
                    <View style={styles.hintPill}>
                        <Ionicons name="refresh" size={18} color={COLORS.textLight} />
                        <Text style={styles.hintText}>Try again</Text>
                    </View>
                </Animated.View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F4F6',
    },
    successHint: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ECFDF5',
        paddingVertical: 10,
        borderRadius: 12,
        marginBottom: 16,
        gap: 8,
        borderWidth: 1,
        borderColor: '#A7F3D0',
    },
    successHintText: {
        color: '#065F46',
        fontWeight: 'bold',
        fontSize: 14,
    },
    cameraContainer: {
        height: height * 0.45, // Top 45% is camera
        backgroundColor: '#000',
        overflow: 'hidden',
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
        zIndex: 30,
    },
    heroCalories: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 24,
        backgroundColor: 'rgba(42, 75, 42, 0.05)',
        borderRadius: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(42, 75, 42, 0.1)',
    },
    heroCalValue: {
        fontSize: 56,
        fontWeight: '900',
        color: COLORS.brandGreen,
        letterSpacing: -1,
    },
    heroCalLabel: {
        fontSize: 16,
        color: '#6B7280',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
    },
    camera: {
        flex: 1,
    },
    cameraOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'space-between',
        paddingTop: 80,
    },
    nutritionGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 24,
        gap: 12,
    },
    headerSafe: {
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingTop: 8,
        marginTop: -70,
    },
    brandContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    logoImage: {
        width: 80,
        height: 32,
    },
    divider: {
        width: 1,
        height: 24,
        backgroundColor: 'rgba(255,255,255,0.3)',
        marginHorizontal: 16,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFF',
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    scannerZone: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scanFrame: {
        width: width * 0.7,
        height: width * 0.7,
        maxHeight: 280,
        maxWidth: 280,
        position: 'relative',
    },
    corner: {
        position: 'absolute',
        width: 30,
        height: 30,
        borderColor: 'rgba(42, 75, 42, 0.6)',
        borderWidth: 1.5,
        borderRadius: 4,
    },
    tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
    tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
    bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
    br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
    laserLine: {
        position: 'absolute',
        width: '100%',
        height: 0.2,
        backgroundColor: 'rgba(16, 185, 129, 1)', // solid bright green beam
        borderRadius: 0.2,
        shadowColor: 'rgba(16, 185, 129, 1)',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
    },
    focusText: {
        color: 'rgba(255,255,255,0.7)',
        marginTop: 16,
        fontSize: 14,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    cameraControls: {
        paddingBottom: 40,
        alignItems: 'center',
    },
    cameraActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        width: '100%',
    },
    galleryBtn: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    zoomPill: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    zoomText: {
        color: 'rgba(255,255,255,0.5)',
        fontWeight: '600',
    },
    activeZoom: {
        color: '#FBBF24',
    },
    captureBtnWrapper: {
        shadowColor: '#2A4B2A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 10,
    },
    captureBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 28,
        gap: 10,
    },
    captureText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: 'bold',
    },
    resultsScroll: {
        flex: 1,
        marginTop: -30, // Overlap the camera view
        zIndex: 20,
    },
    resultsContent: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    resultCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 3,
        marginBottom: 20,
    },
    resultHero: {
        marginBottom: 16,
        borderRadius: 24,
        backgroundColor: '#FFFFFF',
        // Shadow removed from hero if it's clipped, or use a wrapper. 
        // But for now, ensuring solid background and no overflow:hidden on the shadow container.
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
        // Let the hero bleed to screen edges (counteracts resultsContent padding)
        marginHorizontal: -20,
    },
    resultHeroImage: {
        width: '100%',
        height: 340,
        borderRadius: 24, // Clip image instead of parent
    },
    resultHeroOverlay: {
        position: 'absolute',
        // Match content/card width while hero image bleeds full-bleed
        left: 20,
        right: 20,
        bottom: -20,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 12,
        // Softer, on-brand dark green overlay
        backgroundColor: 'rgba(42,75,42,0.78)', // COLORS.brandGreen with transparency
        borderWidth: 1,
        borderColor: 'rgba(241,201,59,0.75)',
        shadowColor: '#2A4B2A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    resultHeroTitle: {
        color: COLORS.textLight,
        fontSize: 16,
        fontWeight: '800',
        marginBottom: 2,
        letterSpacing: 0.2,
    },
    resultHeroSubtitle: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
    },
    resultHeroSubtitleLabel: {
        color: 'rgba(229,231,235,0.75)', // faint grey for nutrient names
    },
    resultHeroSubtitleValue: {
        color: '#E5E7EB',
    },
    resultHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
    },
    foodName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.textDark,
        marginBottom: 4,
    },
    servingRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    servingText: {
        color: '#6B7280',
        fontSize: 14,
        marginLeft: 4,
    },
    heartBtn: {
        padding: 8,
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
    },
    nutriItem: {
        width: '31%', // roughly 3 columns
        backgroundColor: '#F9FAFB',
        borderRadius: 16,
        padding: 12,
        alignItems: 'center',
        gap: 4,
    },
    featuredItem: {
        backgroundColor: '#F5F3FF',
        borderWidth: 1,
        borderColor: '#E9D5FF',
    },
    nutriValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.textDark,
    },
    nutriLabel: {
        fontSize: 12,
        color: '#6B7280',
    },
    actionRow: {
        flexDirection: 'row',
        gap: 12,
    },
    floatingActionBar: {
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 12,
        padding: 10,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.98)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        zIndex: 200,
    },
    secondaryBtn: {
        flex: 1,
        paddingVertical: 14,
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryBtnText: {
        color: '#374151',
        fontWeight: '600',
        fontSize: 16,
    },
    primaryBtn: {
        flex: 2,
        borderRadius: 16,
        overflow: 'hidden',
    },
    btnGradient: {
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    primaryBtnText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    placeholderCard: {
        backgroundColor: '#FFF',
        borderRadius: 24,
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
        marginBottom: 20,
    },
    placeholderText: {
        color: '#9CA3AF',
        fontSize: 16,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#374151',
        marginBottom: 20,
        alignSelf: 'flex-start',
    },
    analysisCard: {
        backgroundColor: '#F9FAFB',
        borderRadius: 20,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderLeftWidth: 6,
    },
    analysisHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusBadgeText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    analysisTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.textDark,
    },
    assignmentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    assignmentTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: COLORS.textDark,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        opacity: 0.7,
    },
    adviceItem: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
        backgroundColor: '#FFF',
        padding: 12,
        borderRadius: 12,
    },
    adviceText: {
        flex: 1,
        fontSize: 14,
        color: '#4B5563',
        lineHeight: 20,
    },
    suggestionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        marginTop: 8,
        paddingVertical: 8,
    },
    suggestionBtnText: {
        color: COLORS.brandGreen,
        fontSize: 14,
        fontWeight: 'bold',
    },
    dailySummaryWrap: {
        backgroundColor: '#FFF',
        borderRadius: 20,
        padding: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    summaryLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    summaryValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.textDark,
    },
    progressBarBg: {
        height: 10,
        backgroundColor: '#F3F4F6',
        borderRadius: 5,
        overflow: 'hidden',
        marginBottom: 8,
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 5,
    },
    remainingText: {
        fontSize: 12,
        color: '#9CA3AF',
        fontStyle: 'italic',
    },
    historySection: {
        marginTop: 10,
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.textDark,
        marginBottom: 16,
    },
    historyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        padding: 12,
        borderRadius: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    historyThumb: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: '#F5F3FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    historyInfo: {
        flex: 1,
    },
    historyName: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.textDark,
        marginBottom: 4,
    },
    historyTime: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    miniMacroRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    miniMacroText: {
        fontSize: 11,
        color: '#6B7280',
        marginLeft: 4,
    },
    miniBar: {
        height: 6,
        borderRadius: 3,
    },
    emptyHistory: {
        textAlign: 'center',
        color: '#9CA3AF',
        marginTop: 20,
        fontStyle: 'italic',
    },
    // debugOverlay removed
    readinessOverlay: {
        position: 'absolute',
        bottom: 140,
        left: 20,
        right: 20,
        alignItems: 'center',
        gap: 12,
    },
    readinessBar: {
        width: '100%',
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    readinessFill: {
        height: '100%',
        borderRadius: 3,
    },
    feedbackChips: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    feedbackChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    chipText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '600',
    },
    readinessMessage: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    captureRing: {
        borderRadius: 30, // match pill shape of captureBtn
        padding: 2,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    captureRingReady: {
        borderColor: COLORS.accentGreen,
        borderWidth: 2,
        shadowColor: COLORS.accentGreen,
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 6,
    },
    // debugLine removed
    hintOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2000,
    },
    hintPill: {
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: 'rgba(15,23,42,0.92)',
        borderWidth: 1,
        borderColor: 'rgba(241,201,59,0.8)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    hintText: {
        color: COLORS.textLight,
        fontSize: 14,
        fontWeight: '700',
    },
    analysisLabelsContainer: {
        position: 'absolute',
        bottom: -90,
        alignItems: 'center',
        width: '100%',
        zIndex: 500,
    },
    analysisLabelPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 10,
        paddingVertical: 2,
        borderRadius: 12,
        backgroundColor: 'transparent',
        borderWidth: 0,
    },
    analysisLabelText: {
        color: '#FFFFFF',
        fontSize: 11.5,
        fontWeight: '600',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    cardShadowWrapper: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        marginTop: 16,
        marginBottom: 6,
        // Shadow concerns only
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
    },
    insightCard: {
        borderRadius: 24,
        padding: 20,
        borderWidth: 1.2,
        backgroundColor: '#FFFFFF',
        overflow: 'hidden', // Strictly clip everything inside the radius
    },
    insightHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 14,
    },
    insightTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.textDark,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    insightDescription: {
        fontSize: 15,
        color: '#4B5563',
        lineHeight: 22,
        marginBottom: 16,
    },
    nextStepBox: {
        backgroundColor: 'rgba(251, 191, 36, 0.08)',
        padding: 12,
        borderRadius: 12,
        flexDirection: 'column',
    },
    nextStepText: {
        fontSize: 13,
        fontWeight: '500',
        color: COLORS.textDark,
        lineHeight: 18,
    },
    nourishRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 4,
    },
    nourishFlex: {
        flex: 1,
    },
    nourishContainer: {
        borderRadius: 24,
        padding: 20,
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
    },
    nourishHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    nourishTitleGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    nourishTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.textDark,
        letterSpacing: 0.3,
    },
    nourishValue: {
        fontSize: 18,
        fontWeight: '900',
        color: COLORS.accentGreen,
    },
    nourishBarBg: {
        height: 10,
        backgroundColor: '#F1F5F9',
        borderRadius: 4,
        overflow: 'hidden',
    },
    nourishBarFill: {
        height: '100%',
        borderRadius: 4,
    },
    breakdownContainer: {
        backgroundColor: '#FFF',
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
    },
    macroRow: {
        marginBottom: 16,
    },
    macroHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    macroLabelGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    macroLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    macroValue: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.textDark,
    },
    macroBarBg: {
        height: 8,
        backgroundColor: '#F3F4F6',
        borderRadius: 4,
        overflow: 'hidden',
    },
    macroBarFill: {
        height: '100%',
        borderRadius: 4,
    },
    summaryValueContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    summaryTotal: {
        fontSize: 14,
        color: '#9CA3AF',
        fontWeight: '500',
    },
    progressCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 3,
        justifyContent: 'center',
        alignItems: 'center',
    },
    progressPercent: {
        fontSize: 12,
        fontWeight: '800',
    },
});
