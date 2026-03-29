import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface PortionAdjusterProps {
    baseServing: string;
    foodName: string;
    onPortionChange: (multiplier: number) => void;
}

const PORTION_OPTIONS = [
    { label: 'Half', value: 0.5, icon: 'circle-slice-4', hint: 'Light meal' },
    { label: '1 Serving', value: 1.0, icon: 'circle-outline', hint: 'Standard' },
    { label: '1.5x', value: 1.5, icon: 'circle-slice-6', hint: 'Large' },
    { label: 'Double', value: 2.0, icon: 'circle-double', hint: 'Heavy meal' },
];

// Visual reference helpers based on food type keywords (simple implementation)
const getVisualReference = (foodName: string) => {
    const name = foodName.toLowerCase();
    if (name.includes('meat') || name.includes('chicken') || name.includes('beef') || name.includes('fish')) {
        return { icon: 'cards', text: '1 serving ≈ Deck of Cards' };
    }
    if (name.includes('rice') || name.includes('pasta') || name.includes('salad')) {
        return { icon: 'tennis-ball', text: '1 serving ≈ Tennis Ball' };
    }
    if (name.includes('oil') || name.includes('butter') || name.includes('cheese')) {
        return { icon: 'dice-d6', text: '1 serving ≈ 2 Dice' };
    }
    return { icon: 'hand-front-right', text: '1 serving ≈ Fist size' };
};

export const PortionAdjuster = ({ baseServing, foodName, onPortionChange }: PortionAdjusterProps) => {
    const [selectedPortion, setSelectedPortion] = useState(1.0);
    const visualRef = getVisualReference(foodName);

    const handleSelect = (value: number) => {
        setSelectedPortion(value);
        onPortionChange(value);
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Adjust Portion</Text>
                <View style={styles.visualRef}>
                    <MaterialCommunityIcons name={visualRef.icon as any} size={14} color="#6B7280" />
                    <Text style={styles.visualRefText}>{visualRef.text}</Text>
                </View>
            </View>

            <View style={styles.selectorContainer}>
                {PORTION_OPTIONS.map((option) => {
                    const isSelected = selectedPortion === option.value;
                    return (
                        <TouchableOpacity
                            key={option.value}
                            onPress={() => handleSelect(option.value)}
                            activeOpacity={0.7}
                            style={styles.optionWrapper}
                        >
                            <View style={[
                                styles.optionBtn,
                                isSelected && styles.selectedOptionBtn
                            ]}>
                                {isSelected && (
                                    <View style={[StyleSheet.absoluteFill, { borderRadius: 12, overflow: 'hidden' }]}>
                                        <LinearGradient
                                            colors={['#2A4B2A', '#F1C93B']}
                                            style={{ flex: 1 }}
                                            start={{ x: 0, y: 0.5 }}
                                            end={{ x: 1, y: 0.5 }}
                                        />
                                    </View>
                                )}
                                <MaterialCommunityIcons
                                    name={option.icon as any}
                                    size={20}
                                    color={isSelected ? '#FFF' : '#9CA3AF'}
                                />
                                <Text style={[
                                    styles.optionLabel,
                                    isSelected && styles.selectedOptionLabel
                                ]}>
                                    {option.label}
                                </Text>
                            </View>
                            {isSelected && (
                                <Text style={styles.hintText}>{option.hint}</Text>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>

            <View style={styles.summaryBar}>
                <Text style={styles.summaryText}>
                    Logging: <Text style={styles.summaryHighlight}>
                        {selectedPortion === 1 ? baseServing : `${selectedPortion}x ${baseServing}`}
                    </Text>
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#F9FAFB',
        borderRadius: 16,
        padding: 16,
        marginVertical: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: '#374151',
    },
    visualRef: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#E5E7EB',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    visualRefText: {
        fontSize: 12,
        color: '#4B5563',
        fontWeight: '500',
    },
    selectorContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    optionWrapper: {
        flex: 1,
        alignItems: 'center',
        gap: 8,
    },
    optionBtn: {
        width: '90%',
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        gap: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    selectedOptionBtn: {
        backgroundColor: '#2A4B2A', // Fallback
        borderColor: '#2A4B2A',
        borderWidth: 0,
    },
    optionLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#6B7280',
        textAlign: 'center',
    },
    selectedOptionLabel: {
        color: '#FFF',
    },
    hintText: {
        fontSize: 10,
        color: '#2A4B2A',
        fontWeight: '600',
        position: 'absolute',
        bottom: -18,
    },
    summaryBar: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
        alignItems: 'center',
    },
    summaryText: {
        fontSize: 14,
        color: '#6B7280',
    },
    summaryHighlight: {
        color: '#2A4B2A',
        fontWeight: '700',
    }
});
