import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TextInput,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { designSystem } from '../../theme/designSystem';

interface ManualLogModalProps {
    visible: boolean;
    onClose: () => void;
    onLog: (meal: any) => void;
    initialMealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

export function ManualLogModal({ visible, onClose, onLog, initialMealType = 'breakfast' }: ManualLogModalProps) {
    const [name, setName] = useState('');
    const [calories, setCalories] = useState('');
    const [protein, setProtein] = useState('');
    const [carbs, setCarbs] = useState('');
    const [fat, setFat] = useState('');
    const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>(initialMealType);

    // Sync state when modal becomes visible or initialMealType changes
    React.useEffect(() => {
        if (visible) {
            setMealType(initialMealType);
        }
    }, [visible, initialMealType]);

    const handleLog = () => {
        if (!name || !calories) return;

        onLog({
            foodName: name,
            calories: parseFloat(calories),
            protein: parseFloat(protein) || 0,
            carbs: parseFloat(carbs) || 0,
            fats: parseFloat(fat) || 0,
            mealType: mealType,
            quantity: 1,
            loggedAt: new Date().toISOString(),
        });

        // Reset
        setName('');
        setCalories('');
        setProtein('');
        setCarbs('');
        setFat('');
        onClose();
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.modalContainer}
            >
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Log Food Manually</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="#1F2937" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        <View style={styles.form}>
                            <Text style={styles.label}>Food Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Chicken breast"
                                value={name}
                                onChangeText={setName}
                            />

                            <View style={styles.row}>
                                <View style={styles.halfInput}>
                                    <Text style={styles.label}>Calories (kcal)</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="0"
                                        keyboardType="numeric"
                                        value={calories}
                                        onChangeText={setCalories}
                                    />
                                </View>
                                <View style={styles.halfInput}>
                                    <Text style={styles.label}>Meal Type</Text>
                                    <View style={styles.typeSelector}>
                                        {['breakfast', 'lunch', 'dinner', 'snack'].map((type) => (
                                            <TouchableOpacity
                                                key={type}
                                                style={[
                                                    styles.typeBtn,
                                                    mealType === type && styles.typeBtnActive
                                                ]}
                                                onPress={() => setMealType(type as any)}
                                            >
                                                <Text style={[
                                                    styles.typeBtnText,
                                                    mealType === type && styles.typeBtnTextActive
                                                ]}>
                                                    {type.charAt(0).toUpperCase()}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            </View>

                            <Text style={styles.sectionTitle}>Macros (Optional)</Text>
                            <View style={styles.macroRow}>
                                <View style={styles.macroInput}>
                                    <Text style={styles.microLabel}>Protein</Text>
                                    <TextInput
                                        style={styles.smallInput}
                                        placeholder="0g"
                                        keyboardType="numeric"
                                        value={protein}
                                        onChangeText={setProtein}
                                    />
                                </View>
                                <View style={styles.macroInput}>
                                    <Text style={styles.microLabel}>Carbs</Text>
                                    <TextInput
                                        style={styles.smallInput}
                                        placeholder="0g"
                                        keyboardType="numeric"
                                        value={carbs}
                                        onChangeText={setCarbs}
                                    />
                                </View>
                                <View style={styles.macroInput}>
                                    <Text style={styles.microLabel}>Fat</Text>
                                    <TextInput
                                        style={styles.smallInput}
                                        placeholder="0g"
                                        keyboardType="numeric"
                                        value={fat}
                                        onChangeText={setFat}
                                    />
                                </View>
                            </View>
                        </View>
                    </ScrollView>

                    <TouchableOpacity style={styles.submitBtn} onPress={handleLog}>
                        <LinearGradient
                            colors={['#2A4B2A', '#F1C93B']}
                            style={styles.submitGradient}
                            start={{ x: 0, y: 0.5 }}
                            end={{ x: 1, y: 0.5 }}
                        >
                            <Text style={styles.submitBtnText}>Log Meal</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    content: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        maxHeight: '80%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1F2937',
    },
    form: {
        gap: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    row: {
        flexDirection: 'row',
        gap: 12,
    },
    halfInput: {
        flex: 1,
    },
    typeSelector: {
        flexDirection: 'row',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 4,
        gap: 4,
    },
    typeBtn: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 8,
    },
    typeBtnActive: {
        backgroundColor: '#2A4B2A',
    },
    typeBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
    },
    typeBtnTextActive: {
        color: '#FFF',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1F2937',
        marginTop: 8,
    },
    macroRow: {
        flexDirection: 'row',
        gap: 12,
    },
    macroInput: {
        flex: 1,
        alignItems: 'center',
    },
    microLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 4,
    },
    smallInput: {
        backgroundColor: '#F9FAFB',
        borderRadius: 10,
        padding: 10,
        width: '100%',
        textAlign: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    submitBtn: {
        marginTop: 24,
        borderRadius: 16,
        overflow: 'hidden',
    },
    submitGradient: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    submitBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
