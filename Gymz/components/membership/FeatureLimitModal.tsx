import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Dimensions,
    Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../hooks/useTheme';

const { width } = Dimensions.get('window');

interface FeatureLimitModalProps {
    visible: boolean;
    onClose: () => void;
    onAction: () => void;
    title: string;
    message: string;
    actionLabel: string;
    icon: string;
    isTrial?: boolean;
}

export const FeatureLimitModal: React.FC<FeatureLimitModalProps> = ({
    visible,
    onClose,
    onAction,
    title,
    message,
    actionLabel,
    icon,
    isTrial = false,
}) => {
    const { theme, isDark } = useTheme();

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {Platform.OS === 'ios' ? (
                    <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.85)' }]} />
                )}

                <View style={[styles.modalContent, { backgroundColor: theme.backgroundCard, borderColor: theme.border }]}>
                    <View style={styles.iconContainer}>
                        <LinearGradient
                            colors={isTrial ? [theme.primary, theme.primary + 'AA'] : [theme.error, theme.error + 'AA']}
                            style={styles.iconCircle}
                        >
                            <MaterialCommunityIcons name={icon as any} size={40} color="#FFF" />
                        </LinearGradient>
                    </View>

                    <View style={styles.body}>
                        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
                        <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>

                        <View style={styles.actionContainer}>
                            <TouchableOpacity
                                style={[styles.primaryButton, { backgroundColor: theme.primary }]}
                                onPress={onAction}
                            >
                                <Text style={styles.primaryButtonText}>{actionLabel}</Text>
                                <MaterialCommunityIcons name="arrow-right" size={20} color="#FFF" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.secondaryButton, { borderColor: theme.border }]}
                                onPress={onClose}
                            >
                                <Text style={[styles.secondaryButtonText, { color: theme.textSecondary }]}>MAYBE LATER</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 28,
        borderWidth: 1,
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.25,
                shadowRadius: 16,
            },
            android: {
                elevation: 12,
            },
        }),
    },
    iconContainer: {
        alignItems: 'center',
        paddingTop: 40,
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
    body: {
        padding: 24,
        alignItems: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 12,
        textAlign: 'center',
    },
    message: {
        fontSize: 15,
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 22,
    },
    actionContainer: {
        width: '100%',
        gap: 12,
    },
    primaryButton: {
        height: 54,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    primaryButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
        marginRight: 8,
    },
    secondaryButton: {
        height: 50,
        borderRadius: 16,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryButtonText: {
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: 1,
    },
});
