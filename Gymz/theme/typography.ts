import { TextStyle } from 'react-native';

export const typography: Record<string, TextStyle> = {
    h1: {
        fontSize: 32,
        fontWeight: '800', // Making it bolder for modern look
        lineHeight: 40,
        letterSpacing: -0.5,
    },
    h2: {
        fontSize: 24,
        fontWeight: '700',
        lineHeight: 32,
        letterSpacing: -0.3,
    },
    h3: {
        fontSize: 20,
        fontWeight: '600',
        lineHeight: 28,
    },
    h4: {
        fontSize: 18,
        fontWeight: '600',
        lineHeight: 24,
    },
    body: {
        fontSize: 16,
        fontWeight: '400',
        lineHeight: 24,
    },
    bodySemibold: {
        fontSize: 16,
        fontWeight: '600',
        lineHeight: 24,
    },
    caption: {
        fontSize: 12,
        fontWeight: '400',
        lineHeight: 16,
    },
    tiny: {
        fontSize: 10,
        fontWeight: '500',
        lineHeight: 14,
        textTransform: 'uppercase',
    },
    button: {
        fontSize: 16,
        fontWeight: '700',
        textAlign: 'center',
    }
};
