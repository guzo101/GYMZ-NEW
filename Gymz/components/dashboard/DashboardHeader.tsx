import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../hooks/useTheme';
import { designSystem } from '../../theme/designSystem';
import { NotificationBell } from '../notifications/NotificationBell';

interface DashboardHeaderProps {
    memberName: string;
    initials: string;
    gender: 'male' | 'female' | 'other';
    avatarUrl?: string | null;
    onProfilePress?: () => void;
    paddingTop?: number;
}

const DashboardHeaderComponent: React.FC<DashboardHeaderProps> = ({
    memberName,
    initials,
    gender,
    avatarUrl,
    onProfilePress,
    paddingTop = 0
}) => {
    const { theme } = useTheme();

    return (
        <View style={[styles.container, { paddingTop }]}>
            {/* Top Bar: Logo & Member Name & Avatar */}
            <View style={styles.topBar}>
                <View style={styles.leftContainer}>
                    <Image
                        source={require('../../assets/gymzLogo.png')}
                        style={styles.logoImage}
                        resizeMode="contain"
                    />
                </View>

                <View style={styles.rightBar}>
                    <NotificationBell />
                    <TouchableOpacity activeOpacity={0.8} onPress={onProfilePress}>
                        {avatarUrl ? (
                            <Image
                                source={{ uri: avatarUrl }}
                                style={[styles.avatarImage, { borderColor: theme.border }]}
                            />
                        ) : (
                            <LinearGradient
                                colors={designSystem.colors.gradients.brand}
                                style={styles.avatar}
                            >
                                <Text style={styles.avatarText}>{initials}</Text>
                            </LinearGradient>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

        </View>
    );
};

DashboardHeaderComponent.displayName = 'DashboardHeader';

export const DashboardHeader = React.memo(DashboardHeaderComponent);

const styles = StyleSheet.create({
    container: {
        marginBottom: 8,
        marginTop: 4,
        paddingBottom: 4,
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 0,
        paddingHorizontal: 0,
    },
    leftContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    rightBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12, // Reduced gap
    },
    logoContainer: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
    },
    logoImage: {
        width: 36,
        aspectRatio: 1,
    },
    logoText: {
        fontSize: 22,
        fontWeight: '900',
        letterSpacing: -0.5,
        color: '#FFF',
        fontStyle: 'italic',
    },
    avatar: {
        width: 34,
        height: 34,
        borderRadius: 17,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.2)', // Increased visibility slightly
        ...designSystem.shadows.sm,
    },
    avatarImage: {
        width: 34,
        height: 34,
        borderRadius: 17,
        borderWidth: 1.5,
    },
    avatarText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFF',
    },
});
