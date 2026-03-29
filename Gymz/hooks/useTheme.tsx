import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { designSystem } from '../theme/designSystem';
import { useAuth } from './useAuth';

type ThemeMode = 'light' | 'dark';

// Define a common interface for theme colors to avoid strictly typed hex value conflicts
export interface ThemeColors {
    primary: string;
    primaryDark: string;
    primaryLight: string;
    background: string;
    backgroundCard: string;
    backgroundInput: string;
    text: string;
    textDark: string;
    textSecondary: string;
    textMuted: string;
    border: string;
    shadow: string;
    success: string;
    error: string;
    accent: string;
}

interface ThemeContextType {
    mode: ThemeMode;
    theme: ThemeColors;
    toggleTheme: () => void;
    isDark: boolean;
    gender: 'male' | 'female' | 'neutral';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@Gymz_theme_mode';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [mode, setMode] = useState<ThemeMode>('light');

    useEffect(() => {
        applyThemeLogic();
    }, [user?.gender]);

    const applyThemeLogic = async () => {
        try {
            // 1. Check for manually saved preference first
            const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);

            if (savedTheme === 'light' || savedTheme === 'dark') {
                console.log('[Theme] Using saved preference:', savedTheme);
                setMode(savedTheme);
                return;
            }

            // 2. If no saved preference, use Gender-based default
            if (user?.gender) {
                const g = user.gender.toLowerCase();
                if (g === 'female') {
                    console.log('[Theme] Auto-setting Default: Light (Female)');
                    setMode('light');
                } else if (g === 'male') {
                    console.log('[Theme] Auto-setting Default: Light (Male)');
                    setMode('light');
                } else {
                    // Default to Light for others
                    setMode('light');
                }
            } else {
                // No user gender yet? Default to Light.
                setMode('light');
            }
        } catch (error) {
            console.error('[Theme] Error applying theme logic:', error);
        }
    };

    const toggleTheme = async () => {
        const newMode = mode === 'light' ? 'dark' : 'light';
        setMode(newMode);
        console.log('[Theme] Toggling to:', newMode);
        try {
            await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
            console.log('[Theme] Saved to storage');
        } catch (error) {
            console.error('[Theme] Error saving theme:', error);
        }
    };

    // Determine the theme branch based on gender
    const userGender = user?.gender?.toLowerCase();
    let genderKey: 'male' | 'female' | 'neutral' = 'neutral';
    let themeBranch: { light: ThemeColors; dark: ThemeColors };

    if (userGender === 'male') {
        genderKey = 'male';
        themeBranch = designSystem.colors.male as any;
    } else if (userGender === 'female') {
        genderKey = 'female';
        themeBranch = designSystem.colors.female as any;
    } else {
        genderKey = 'neutral';
        themeBranch = {
            light: designSystem.colors.light as any,
            dark: designSystem.colors.dark as any
        };
    }

    const theme = mode === 'dark' ? themeBranch.dark : themeBranch.light;

    return (
        <ThemeContext.Provider value={{
            mode,
            theme,
            toggleTheme,
            isDark: mode === 'dark',
            gender: genderKey
        }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
