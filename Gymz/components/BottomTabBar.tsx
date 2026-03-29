import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Feather, Ionicons } from '@expo/vector-icons';
import { designSystem } from '../theme/designSystem';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';

/** Tab bar sits above the safe area: it uses bottom: 8 within the root-inset content (App.tsx paddingBottom), so it stays fully visible. */

interface BottomTabBarProps {
    state: any;
    descriptors: any;
    navigation: any;
    mode?: 'default' | 'event';
}

import * as Haptics from 'expo-haptics';

export function BottomTabBar({ state, descriptors, navigation, mode = 'default' }: BottomTabBarProps) {
    const { theme, isDark } = useTheme();
    const { isAdmin } = useAuth();
    const styles = createStyles(theme, isDark);

    return (
        <View style={styles.container}>
            <View
                style={[styles.background, { backgroundColor: theme.backgroundCard }]}
            >
                <View style={styles.tabContainer}>
                    {state.routes.filter((route: any) => {
                        const { options } = descriptors[route.key];
                        // Defense-in-depth: never render admin-only Tribes tab for non-admins,
                        // even if a stale navigator state still contains the route.
                        if (route.name === 'Tribes' && !isAdmin) return false;
                        // Respect tabBarButton: () => null — do not render hidden tabs
                        if (options.tabBarButton === null || (typeof options.tabBarButton === 'function' && options.tabBarButton() === null)) return false;
                        return true;
                    }).map((route: any, index: number) => {
                        // Compute the real index (for isFocused) from the original state
                        const realIndex = state.routes.indexOf(route);
                        const { options } = descriptors[route.key];
                        const isFocused = state.index === realIndex;

                        const onPress = () => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            const event = navigation.emit({
                                type: 'tabPress',
                                target: route.key,
                                canPreventDefault: true,
                            });

                            if (!isFocused && !event.defaultPrevented) {
                                navigation.navigate(route.name);
                            }
                        };

                        const getIcon = (routeName: string, focused: boolean, color: string, size: number) => {
                            const iconSize = size;
                            switch (routeName) {
                                case 'Dashboard':
                                case 'EventHome':
                                    return <Ionicons name={focused ? "grid" : "grid-outline"} size={iconSize} color={color} />;
                                case 'Nutrition':
                                    return <Ionicons name={focused ? "restaurant" : "restaurant-outline"} size={iconSize} color={color} />;
                                case 'Discover':
                                    return <Ionicons name={focused ? "compass" : "compass-outline"} size={iconSize} color={color} />;
                                case 'Calendar':
                                case 'Gym Calendar':
                                case 'GymCalendar':
                                    return <Ionicons name={focused ? "calendar" : "calendar-outline"} size={iconSize} color={color} />;
                                case 'Tribes':
                                    return <Ionicons name={focused ? "people" : "people-outline"} size={iconSize} color={color} />;
                                case 'Progress':
                                    return <Ionicons name={focused ? "bar-chart" : "bar-chart-outline"} size={iconSize} color={color} />;
                                case 'Gymz AI':
                                    return <Ionicons name={focused ? "sparkles" : "sparkles-outline"} size={iconSize + 2} color={color} />;
                                case 'Admin':
                                    return <MaterialCommunityIcons name={focused ? "shield-account" : "shield-account-outline"} size={iconSize + 2} color={color} />;
                                case 'Profile':
                                    return <Ionicons name={focused ? "person" : "person-outline"} size={iconSize} color={color} />;
                                default:
                                    return <Ionicons name={focused ? "ellipse" : "ellipse-outline"} size={iconSize} color={color} />;
                            }
                        };

                        const getShortName = (routeName: string) => {
                            switch (routeName) {
                                case 'Gym Calendar':
                                case 'GymCalendar': return 'Calendar';
                                case 'EventHome': return 'Home';
                                case 'Tribes': return 'Tribes';
                                case 'Gymz AI': return 'AI';
                                case 'Progress': return 'Progress';
                                default: return routeName;
                            }
                        };

                        return (
                            <TouchableOpacity
                                key={index}
                                onPress={onPress}
                                style={[styles.tabButton, isFocused ? { flex: 2 } : { flex: 1 }]}
                                activeOpacity={0.8}
                            >
                                {isFocused ? (
                                    <LinearGradient
                                        colors={designSystem.colors.gradients.primary}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.activeTab}
                                    >
                                        {getIcon(route.name, true, "#FFF", 18)}
                                        <Text style={styles.activeLabel} numberOfLines={1}>
                                            {options.futureRelease
                                                ? 'Future Release'
                                                : (options.tabBarLabel || options.title || getShortName(route.name))}
                                        </Text>
                                    </LinearGradient>
                                ) : (
                                    <View style={styles.inactiveTab}>
                                        {getIcon(
                                            route.name,
                                            false,
                                            isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)',
                                            22
                                        )}
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
        </View>
    );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 8,
        left: 16,
        right: 16,
        borderRadius: 32,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: isDark ? 0.4 : 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    background: {
        paddingVertical: 10,
        paddingHorizontal: 6,
        borderRadius: 32,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    },
    tabContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    tabButton: {
        alignItems: 'center',
        justifyContent: 'center',
        height: 52,
    },
    activeTab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 24,
        gap: 6,
        minWidth: 70,
        justifyContent: 'center',
        // Standard subtle shadow instead of "glow"
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
        elevation: 2,
    },
    activeLabel: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 11,
    },
    inactiveTab: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

