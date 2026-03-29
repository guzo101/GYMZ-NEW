import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { designSystem } from '../../theme/designSystem';
import { useTheme } from '../../hooks/useTheme';
import { workoutService } from '../../services/workoutService';
import { CelebrationModal } from './CelebrationModal';
import { getUserMemory } from '../../services/aiChat';

interface LogWorkoutModalProps {
    visible: boolean;
    onClose: () => void;
    onLogComplete?: () => void;
    userId: string;
}

export const LogWorkoutModal: React.FC<LogWorkoutModalProps> = ({ visible, onClose, onLogComplete, userId }) => {
    const { theme } = useTheme();
    const [loading, setLoading] = useState(false);
    const [exercise, setExercise] = useState('');
    const [sets, setSets] = useState('3');
    const [reps, setReps] = useState('10');
    const [weight, setWeight] = useState('0');
    const [duration, setDuration] = useState('45');
    const [intensity, setIntensity] = useState('Medium');
    const [showCelebration, setShowCelebration] = useState(false);
    const [pointsEarned, setPointsEarned] = useState(150);
    const [userMemory, setUserMemory] = useState<any>(null);

    React.useEffect(() => {
        if (visible && userId) {
            getUserMemory(userId).then(setUserMemory);
        }
    }, [visible, userId]);

    const intensities = ['Low', 'Medium', 'High', 'Elite'];

    const handleLogWorkout = async () => {
        if (!exercise) {
            Alert.alert('Error', 'Please enter an exercise name');
            return;
        }

        setLoading(true);
        try {
            const result = await workoutService.logWorkout({
                exercise_name: exercise,
                sets: parseInt(sets),
                reps: parseInt(reps),
                weight: parseFloat(weight),
                duration: parseInt(duration),
                intensity_level: intensity,
                user_id: userId,
            } as any);

            setPointsEarned(result.points);
            setShowCelebration(true);

            if (onLogComplete) onLogComplete();
            // Reset form
            setExercise('');
        } catch (error) {
            console.error('Log error:', error);
            Alert.alert('Error', 'Failed to log workout');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.keyboardView}
                >
                    <View style={[styles.modalContent, { backgroundColor: theme.backgroundCard }]}>
                        {/* Header */}
                        <View style={styles.header}>
                            <View>
                                <Text style={[styles.title, { color: theme.text }]}>Log Workout</Text>
                                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Track your progress & earn XP</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                <Ionicons name="close" size={24} color={theme.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            style={styles.form}
                            keyboardShouldPersistTaps="handled"
                        >
                            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>EXERCISE NAME</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.backgroundInput, color: theme.text }]}
                                placeholder="e.g. Bench Press"
                                placeholderTextColor="#6B7280"
                                value={exercise}
                                onChangeText={setExercise}
                            />

                            <View style={styles.row}>
                                <View style={styles.col}>
                                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>SETS</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: theme.backgroundInput, color: theme.text }]}
                                        keyboardType="numeric"
                                        value={sets}
                                        onChangeText={setSets}
                                    />
                                </View>
                                <View style={styles.col}>
                                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>REPS</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: theme.backgroundInput, color: theme.text }]}
                                        keyboardType="numeric"
                                        value={reps}
                                        onChangeText={setReps}
                                    />
                                </View>
                                <View style={styles.col}>
                                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>WEIGHT (KG)</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: theme.backgroundInput, color: theme.text }]}
                                        keyboardType="numeric"
                                        value={weight}
                                        onChangeText={setWeight}
                                    />
                                </View>
                            </View>

                            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>DURATION (MINUTES)</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.backgroundInput, color: theme.text }]}
                                keyboardType="numeric"
                                value={duration}
                                onChangeText={setDuration}
                            />

                            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>INTENSITY</Text>
                            <View style={styles.intensityContainer}>
                                {intensities.map((level) => (
                                    <TouchableOpacity
                                        key={level}
                                        style={[
                                            styles.intensityPill,
                                            { backgroundColor: theme.backgroundInput },
                                            intensity === level && { backgroundColor: theme.primary }
                                        ]}
                                        onPress={() => setIntensity(level)}
                                    >
                                        <Text style={[
                                            styles.intensityText,
                                            { color: theme.textSecondary },
                                            intensity === level && { color: '#FFF' }
                                        ]}>{level}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <View style={styles.infoBox}>
                                <MaterialCommunityIcons name="lightning-bolt" size={20} color="#FBBF24" />
                                <Text style={styles.infoText}>This session will earn you approx. 150 XP!</Text>
                            </View>

                            <TouchableOpacity
                                style={styles.submitBtn}
                                onPress={handleLogWorkout}
                                disabled={loading}
                                activeOpacity={0.8}
                            >
                                <LinearGradient
                                    colors={[theme.primary, theme.primaryLight]}
                                    style={styles.submitGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#FFF" />
                                    ) : (
                                        <View style={styles.submitContent}>
                                            <Text style={styles.submitText}>Complete Session</Text>
                                            <MaterialCommunityIcons name="check-circle" size={20} color="#FFF" />
                                        </View>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>

                            <View style={{ height: 40 }} />
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </View>

            <CelebrationModal
                visible={showCelebration}
                xpEarned={pointsEarned}
                userMemory={userMemory}
                onClose={() => {
                    setShowCelebration(false);
                    onClose();
                }}
            />
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    keyboardView: {
        width: '100%',
    },
    modalContent: {
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        maxHeight: '90%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 14,
        fontWeight: '500',
    },
    closeBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    form: {
        maxHeight: 600,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1,
        marginBottom: 8,
        marginTop: 16,
    },
    input: {
        height: 56,
        borderRadius: 16,
        paddingHorizontal: 16,
        fontSize: 16,
        fontWeight: '600',
    },
    row: {
        flexDirection: 'row',
        gap: 12,
    },
    col: {
        flex: 1,
    },
    intensityContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    intensityPill: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 12,
        minWidth: 80,
        alignItems: 'center',
    },
    intensityText: {
        fontSize: 14,
        fontWeight: '700',
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(251, 191, 36, 0.1)',
        padding: 16,
        borderRadius: 16,
        marginTop: 24,
        gap: 12,
    },
    infoText: {
        color: '#FBBF24',
        fontSize: 13,
        fontWeight: '600',
    },
    submitBtn: {
        marginTop: 24,
        borderRadius: 18,
        overflow: 'hidden',
        ...designSystem.shadows.brand,
    },
    submitGradient: {
        height: 60,
        justifyContent: 'center',
        alignItems: 'center',
    },
    submitContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    submitText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '800',
    },
});
