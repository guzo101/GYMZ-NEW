import React from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { FoodScanner } from '../components/nutrition/FoodScanner';
import { nutritionService } from '../services/nutritionService';
import { useAuth } from '../hooks/useAuth';

export default function FoodScannerScreen({ navigation, route }: any) {
    const { user } = useAuth();
    const { mealType = 'lunch' } = route.params || {};

    const handleLogMeal = async (data: any) => {
        if (!user?.id) return;

        try {
            await nutritionService.logMeal({
                foodName: data.name || data.foodName,
                calories: data.calories,
                protein: data.protein,
                carbs: data.carbs,
                fats: data.fat || data.fats,
                fiber: data.fiber ?? data.fiberG ?? 0,
                mealType: mealType,
                quantity: 1,
                loggedAt: new Date().toISOString(),
                imageUrl: data.imageUri || data.imageUrl,
                userId: user.id
            } as any); // Cast to any to bypass strict type check if needed, but userId should fix the specific property error
            Alert.alert('Success', 'Meal logged successfully!');
            if (navigation.canGoBack()) {
                navigation.goBack();
            } else {
                navigation.navigate('Main');
            }
        } catch (error) {
            console.error('[FoodScannerScreen] Error logging meal:', error);
            Alert.alert('Error', 'Failed to log meal. Please try again.');
        }
    };

    return (
        <View style={styles.container}>
            <FoodScanner
                onClose={() => navigation.goBack()}
                mealType={mealType}
                onScanComplete={handleLogMeal}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
});
