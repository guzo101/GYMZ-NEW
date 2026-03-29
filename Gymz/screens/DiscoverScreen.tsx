import React from 'react';
import { View, StyleSheet, ScrollView, Alert, useWindowDimensions, TouchableOpacity, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { DynamicBackground } from '../components/dashboard/DynamicBackground';
import { ScreenHeader } from '../components/ScreenHeader';
import { useAuth } from '../hooks/useAuth';

export default function DiscoverScreen({ navigation }: any) {
    const { theme } = useTheme();
    const { user } = useAuth();
    const { width } = useWindowDimensions();
    const isAdmin = user?.role === 'admin';
    const cardWidth = Math.max(150, (width - 52) / 2);

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <DynamicBackground rotationType="fixed" fixedIndex={4} pointerEvents="none" />
            <ScreenHeader title="Discover" />
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.content}
            >
                <View style={styles.grid}>
                    <DiscoverTile
                        width={cardWidth}
                        height={140}
                        icon="timer"
                        title="Gym Timer"
                        subtitle="Check-in status"
                        iconColor={theme.primary}
                        iconBg={`${theme.primary}1C`}
                        onPress={() => navigation.navigate('Attendance')}
                    />

                    <DiscoverTile
                        width={cardWidth}
                        height={140}
                        icon="calendar-clock"
                        title="Schedule"
                        subtitle="Book classes"
                        iconColor="#2A4B2A"
                        iconBg="rgba(42, 75, 42, 0.14)"
                        onPress={() => navigation.navigate('GymCalendar')}
                    />

                    <DiscoverTile
                        width={(cardWidth * 2) + 12}
                        height={118}
                        icon="food"
                        title="What Should I Eat?"
                        subtitle="Meal suggestions"
                        iconColor="#10B981"
                        iconBg="rgba(16, 185, 129, 0.14)"
                        onPress={() => navigation.navigate('Nutrition')}
                    />

                    <DiscoverTile
                        width={cardWidth}
                        height={170}
                        icon="robot"
                        title="AI Coach"
                        subtitle="Chat with AI"
                        iconColor={theme.primary}
                        iconBg={`${theme.primary}16`}
                        onPress={() => {
                            const hasGaps = !user?.height || !user?.weight || !user?.age || !user?.gender || !user?.goal;
                            if (hasGaps) {
                                navigation.navigate('HealthMetrics');
                            } else {
                                navigation.navigate('AIChat');
                            }
                        }}
                    />

                    <DiscoverTile
                        width={cardWidth}
                        height={170}
                        icon={isAdmin ? 'message-bulleted' : 'message-bulleted'}
                        title={isAdmin ? 'Community' : 'Future Release'}
                        subtitle={isAdmin ? 'Chat tribe' : 'Community chat soon'}
                        iconColor="#FBBF24"
                        iconBg="rgba(251, 191, 36, 0.15)"
                        onPress={() => {
                            if (!isAdmin) {
                                Alert.alert('Future Release', 'Community chat will be available in a future release.');
                                return;
                            }
                            navigation.navigate('CommunityChat');
                        }}
                    />

                    {isAdmin && (
                        <DiscoverTile
                            width={(cardWidth * 2) + 12}
                            height={108}
                            icon="account-group"
                            title="Tribes"
                            subtitle="Find your crew"
                            iconColor="#10B981"
                            iconBg="rgba(16, 185, 129, 0.15)"
                            onPress={() => navigation.navigate('Tribes')}
                        />
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

function DiscoverTile({
    width,
    height,
    icon,
    title,
    subtitle,
    iconColor,
    iconBg,
    onPress,
}: {
    width: number;
    height: number;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    title: string;
    subtitle: string;
    iconColor: string;
    iconBg: string;
    onPress: () => void;
}) {
    const { theme } = useTheme();
    return (
        <TouchableOpacity
            activeOpacity={0.86}
            onPress={onPress}
            style={[styles.tile, { width, height, backgroundColor: theme.backgroundCard, borderColor: theme.border }]}
        >
            <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
                <MaterialCommunityIcons name={icon} size={24} color={iconColor} />
            </View>
            <Text style={[styles.tileTitle, { color: theme.text }]}>{title}</Text>
            <Text style={[styles.tileSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 110,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: 12,
    },
    tile: {
        borderRadius: 22,
        borderWidth: 1,
        padding: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 3,
    },
    iconBox: {
        width: 46,
        height: 46,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    tileTitle: {
        fontSize: 29 / 2,
        fontWeight: '800',
        marginBottom: 4,
    },
    tileSubtitle: {
        fontSize: 13,
        fontWeight: '600',
    },
});
