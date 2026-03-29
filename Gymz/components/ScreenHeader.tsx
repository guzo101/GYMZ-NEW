import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

interface ScreenHeaderProps {
    title: string;
    rightElement?: React.ReactNode;
    showBackButton?: boolean;
    onBack?: () => void;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({ title, rightElement, showBackButton = true, onBack }) => {
    const navigation = useNavigation();
    const { theme } = useTheme();

    const insets = useSafeAreaInsets();

    const canGoBack = navigation.canGoBack();

    return (
        <View style={[styles.container, {
            backgroundColor: theme.background,
            borderBottomColor: theme.border,
            paddingTop: insets.top + 8
        }]}>
            <View style={styles.leftContainer}>
                {showBackButton && canGoBack && (
                    <TouchableOpacity
                        onPress={onBack || (() => navigation.goBack())}
                        style={[styles.backButton, { backgroundColor: theme.backgroundInput }]}
                    >
                        <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
                    </TouchableOpacity>
                )}
                <Text
                    style={[styles.title, { color: theme.text }]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                >
                    {title}
                </Text>
            </View>
            {rightElement && <View style={styles.rightContainer}>{rightElement}</View>}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 12,
        borderBottomWidth: 1,
        zIndex: 10,
    },
    leftContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        flexShrink: 1, // Allow title area to shrink
        marginRight: 12, // Ensure gap between title and right actions
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0, // Prevent back button from shrinking
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        flexShrink: 1, // Allow text to shrink and truncate
    },
    rightContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 0, // Prioritize actions visibility
    },
});
