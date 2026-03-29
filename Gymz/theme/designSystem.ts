/**
 * Gymz Modern Design System
 * Clean, energetic, and motivating fitness aesthetics
 * Supports Gender-based themes (Male/Female/Neutral)
 */

export const designSystem = {
    colors: {
        // MALE THEME - Brand variants (Green/Yellow)
        male: {
            light: {
                primary: '#2A4B2A', // Desaturated Green
                primaryDark: '#1B2E1B',
                primaryLight: '#E8EFE8',
                background: '#F8FAFC',
                backgroundCard: '#FFFFFF',
                backgroundInput: '#F1F5F9',
                text: '#1B2E1B',
                textDark: '#0A120A',
                textSecondary: '#2A4B2A',
                textMuted: '#94A3B8',
                border: '#E2E8F0',
                shadow: 'rgba(42, 75, 42, 0.08)',
                success: '#10B981',
                error: '#EF4444',
                accent: '#F1C93B',
            },
            dark: {
                primary: '#3D6B3D', // Lighter Desaturated Green
                primaryDark: '#2A4B2A',
                primaryLight: '#D0DDD0',
                background: '#0A120A',
                backgroundCard: '#1B241B',
                backgroundInput: '#2A332A',
                text: '#F8FAFC',
                textDark: '#FFFFFF',
                textSecondary: '#94A3B8',
                textMuted: '#64748B',
                border: '#2A332A',
                shadow: 'rgba(0, 0, 0, 0.3)',
                success: '#34D399',
                error: '#FB7185',
                accent: '#F1C93B',
            }
        },
        // FEMALE THEME - Brand variants (Green/Yellow)
        female: {
            light: {
                primary: '#2A4B2A',
                primaryDark: '#1B2E1B',
                primaryLight: '#E8EFE8',
                background: '#F8FAFC',
                backgroundCard: '#FFFFFF',
                backgroundInput: '#F1F5F9',
                text: '#1B2E1B',
                textDark: '#0A120A',
                textSecondary: '#2A4B2A',
                textMuted: '#94A3B8',
                border: '#E2E8F0',
                shadow: 'rgba(42, 75, 42, 0.08)',
                success: '#10B981',
                error: '#EF4444',
                accent: '#FBD85D',
            },
            dark: {
                primary: '#3D6B3D',
                primaryDark: '#2A4B2A',
                primaryLight: '#D0DDD0',
                background: '#0A120A',
                backgroundCard: '#1B241B',
                backgroundInput: '#2A332A',
                text: '#F8FAFC',
                textDark: '#FFFFFF',
                textSecondary: '#94A3B8',
                textMuted: '#64748B',
                border: '#2A332A',
                shadow: 'rgba(0, 0, 0, 0.3)',
                success: '#34D399',
                error: '#FB7185',
                accent: '#FBD85D',
            }
        },
        // NEUTRAL THEME - The classic brand
        light: {
            primary: '#2A4B2A',
            primaryDark: '#1B2E1B',
            primaryLight: '#E8EFE8',
            background: '#F8F9FE',
            backgroundCard: '#FFFFFF',
            backgroundInput: '#F3F4F6',
            text: '#1F2937',
            textDark: '#111827',
            textSecondary: '#6B7280',
            textMuted: '#9CA3AF',
            border: '#E5E7EB',
            shadow: 'rgba(0, 0, 0, 0.08)',
            success: '#10B981',
            error: '#EF4444',
            accent: '#F1C93B',
        },
        dark: {
            primary: '#3D6B3D',
            primaryDark: '#2A4B2A',
            primaryLight: '#D0DDD0',
            background: '#0F1117',
            backgroundCard: '#1C1F26',
            backgroundInput: '#2D3139',
            text: '#FFFFFF',
            textDark: '#FFFFFF',
            textSecondary: 'rgba(255, 255, 255, 0.8)',
            textMuted: 'rgba(255, 255, 255, 0.6)',
            border: 'rgba(255, 255, 255, 0.1)',
            success: '#34D399',
            error: '#F87171',
            accent: '#F1C93B',
        },
        // Shared Semantic Colors
        accent: {
            cyan: '#06B6D4',
            pink: '#F1C93B',
            orange: '#F97316',
            green: '#10B981',
            red: '#EF4444',
            yellow: '#FBBF24',
            brand: '#2A4B2A',
        },
        // Gradient definitions
        gradients: {
            primary: ['#2A4B2A', '#1B2E1B'],
            brand: ['#2A4B2A', '#F1C93B'],
            male: ['#2A4B2A', '#FBD85D'],
            female: ['#2A4B2A', '#FAE392'],
            gold: ['#F1C93B', '#FBD85D'],
            success: ['#34D399', '#10B981'],
            error: ['#FB7185', '#EF4444'],
            backgroundDark: ['#0A120A', '#1B241B'],
            backgroundLight: ['#F8FAFC', '#FFFFFF'],
        },
    },

    typography: {
        fontFamily: {
            regular: 'System',
            medium: 'System',
            bold: 'System',
            black: 'System',
        },
        sizes: {
            hero: 48,
            h1: 32,
            h2: 24,
            h3: 20,
            h4: 18,
            body: 16,
            bodySmall: 14,
            caption: 12,
            tiny: 10,
        },
        weights: {
            regular: '400' as const,
            medium: '500' as const,
            semibold: '600' as const,
            bold: '700' as const,
            extrabold: '800' as const,
        },
        lineHeight: {
            tight: 1.2,
            normal: 1.5,
            relaxed: 1.75,
        }
    },

    spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
        xxl: 48,
        xxxl: 64,
    },

    borderRadius: {
        xs: 4,
        sm: 8,
        md: 12,
        lg: 20,
        xl: 24,
        xxl: 32,
        full: 9999,
    },

    shadows: {
        none: {
            shadowColor: 'transparent',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0,
            shadowRadius: 0,
            elevation: 0,
        },
        sm: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 1,
        },
        md: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 3,
        },
        lg: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.15,
            shadowRadius: 20,
            elevation: 8,
        },
        primary: (color: string) => ({
            shadowColor: color,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 10,
            elevation: 5,
        }),
        brand: {
            shadowColor: '#2A4B2A',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 6,
        },
        glow: (color: string) => ({
            shadowColor: color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.8,
            shadowRadius: 15,
            elevation: 10,
        }),
    },

    glass: {
        light: {
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            borderColor: 'rgba(255, 255, 255, 0.4)',
            borderWidth: 1,
        },
        dark: {
            backgroundColor: 'rgba(30, 41, 59, 0.6)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
        }
    },

    animation: {
        scale: {
            active: 0.95,
            duration: 100,
        }
    }
} as const;

export type DesignSystem = typeof designSystem;
