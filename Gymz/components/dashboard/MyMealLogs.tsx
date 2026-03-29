import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, LayoutAnimation, UIManager, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { designSystem } from '../../theme/designSystem';
import { useTheme } from '../../hooks/useTheme';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface MealLog {
    id: string;
    foodName: string;
    calories: number;
    mealType: string;
    imageUrl?: string;
}

interface MyMealLogsProps {
    logs: MealLog[];
    onLogPress: (mealType: string) => void;
    onViewAll?: () => void;
    isLoading?: boolean;
}

export const MyMealLogs: React.FC<MyMealLogsProps> = ({ logs, onLogPress, onViewAll, isLoading = false }) => {
    const { theme, isDark } = useTheme();
    const [expandedId, setExpandedId] = useState<string | null>(null);

    if (isLoading) {
        return (
            <View style={styles.container}>
                <View style={styles.sectionHeader}>
                    <View>
                        <View style={{ width: 150, height: 22, borderRadius: 6, backgroundColor: theme.border, marginBottom: 4 }} />
                        <View style={{ width: 100, height: 12, borderRadius: 4, backgroundColor: theme.border }} />
                    </View>
                </View>
                <View style={styles.mealList}>
                    {[1, 2, 3].map(i => (
                        <View key={i} style={[styles.mealSection, { backgroundColor: theme.backgroundCard, borderColor: theme.border, opacity: 0.6, height: 80 }]} />
                    ))}
                </View>
            </View>
        );
    }

    const toggleExpand = (id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedId(expandedId === id ? null : id);
    };

    const mealTypes = [
        { id: 'breakfast', label: 'Breakfast', image: require('../../assets/icon_breakfast_new.png'), color: '#3B82F6', size: 140 },
        { id: 'lunch', label: 'Lunch', image: require('../../assets/icon_lunch_new.png'), color: '#F59E0B', size: 150 },
        { id: 'snack', label: 'Snack', image: require('../../assets/icon_snack_new.png'), color: '#F1C93B', size: 120 },
        { id: 'dinner', label: 'Dinner', image: require('../../assets/icon_dinner_new.png'), color: '#10B981', size: 120 },
    ];

    const renderMealItem = (type: string, label: string, image: number, badgeColor: string, itemSize: number = 120) => {
        const mealLogs = logs.filter(l => l.mealType === type);
        const totalCals = mealLogs.reduce((sum, l) => sum + (l.calories || 0), 0);
        const isExpanded = expandedId === type;

        return (
            <View key={type} style={[styles.mealSection, { backgroundColor: theme.backgroundCard, borderColor: theme.border }]}>
                {/* Visual Header */}
                <Pressable
                    style={styles.mealHeader}
                    onPress={() => mealLogs.length > 0 && toggleExpand(type)}
                >
                    <View style={styles.mealLeft}>
                        <View style={styles.iconWrapper}>
                            <View style={[styles.mealIcon3D, { backgroundColor: badgeColor + '25' }]}>
                                <Image source={image} style={[styles.mealIconImage, { width: itemSize, height: itemSize }]} resizeMode="contain" />
                            </View>
                            <View style={[styles.colorIndicator, { backgroundColor: badgeColor }]} />
                        </View>
                        <View style={styles.mealText}>
                            <View style={styles.mealLabelRow}>
                                <Text style={[styles.mealLabel, { color: theme.text }]}>{label}</Text>
                                {mealLogs.length > 0 && (
                                    <>
                                        <MaterialCommunityIcons name="check-decagram" size={16} color="#10B981" />
                                        <MaterialCommunityIcons
                                            name={isExpanded ? "chevron-up" : "chevron-down"}
                                            size={20}
                                            color={theme.textMuted}
                                            style={{ marginLeft: 4 }}
                                        />
                                    </>
                                )}
                            </View>
                            {totalCals > 0 && (
                                <Text style={[styles.totalCals, { color: theme.textSecondary }]}>
                                    <Text style={{ color: badgeColor, fontWeight: '900' }}>{totalCals}</Text> kcal today
                                </Text>
                            )}
                        </View>
                    </View>

                    {mealLogs.length === 0 ? (
                        <TouchableOpacity
                            style={[styles.quickLogBtn, { backgroundColor: badgeColor + '15' }]}
                            onPress={() => onLogPress(type)}
                        >
                            <MaterialCommunityIcons name="plus" size={18} color={badgeColor} />
                            <Text style={[styles.quickLogText, { color: badgeColor }]}>Log</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={styles.addMoreBtn}
                            onPress={() => onLogPress(type)}
                        >
                            <MaterialCommunityIcons name="plus-circle-outline" size={24} color={theme.textMuted} />
                        </TouchableOpacity>
                    )}
                </Pressable>

                {/* Logged Item Details (Expandable) */}
                {mealLogs.length > 0 && isExpanded && (
                    <View style={[styles.loggedContainer, { borderTopColor: theme.border }]}>
                        {mealLogs.map((log, idx) => (
                            <View key={log.id || idx} style={[styles.logRow, { borderBottomColor: theme.border }, idx === mealLogs.length - 1 && { borderBottomWidth: 0 }]}>
                                <View style={[styles.logBullet, { backgroundColor: theme.textMuted }]} />
                                <View style={styles.logMain}>
                                    <Text style={[styles.foodName, { color: theme.text }]} numberOfLines={1}>{log.foodName}</Text>
                                    <Text style={[styles.foodCals, { color: theme.textMuted }]}>{log.calories} kcal</Text>
                                </View>
                                {log.imageUrl ? (
                                    <Image source={{ uri: log.imageUrl }} style={styles.foodThumb} />
                                ) : (
                                    <View style={[styles.foodIconPlaceholder, { backgroundColor: theme.backgroundInput }]}>
                                        <MaterialCommunityIcons name="food-apple" size={14} color={theme.textMuted} />
                                    </View>
                                )}
                            </View>
                        ))}
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.sectionHeader}>
                <View>
                    <Text style={[styles.title, { color: theme.text }]}>Nutrition Timeline</Text>
                    <Text style={[styles.subtitle, { color: theme.textMuted }]}>Today's fuel breakdown</Text>
                </View>
                <TouchableOpacity onPress={onViewAll} style={styles.viewAllBtn}>
                    <Text style={[styles.viewAll, { color: theme.primary }]}>View all</Text>
                    <MaterialCommunityIcons name="arrow-right" size={14} color={theme.primary} />
                </TouchableOpacity>
            </View>

            <View style={styles.mealList}>
                {mealTypes.map(m => renderMealItem(m.id, m.label, m.image, m.color, m.size))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 6,
        marginBottom: 8,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: 18,
    },
    title: {
        fontSize: 22,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
    },
    viewAllBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 4,
    },
    viewAll: {
        fontSize: 13,
        fontWeight: '800',
    },
    mealList: {
        gap: 12,
    },
    mealSection: {
        padding: 18,
        borderRadius: 28,
        borderWidth: 1,
        ...designSystem.shadows.sm,
    },
    mealHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    mealLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    iconWrapper: {
        position: 'relative',
    },
    mealIcon3D: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    mealIconImage: {
        width: 120,
        height: 120,
    },
    colorIndicator: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#FFF',
    },
    mealText: {
        gap: 2,
    },
    mealLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    mealLabel: {
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    totalCals: {
        fontSize: 12,
        fontWeight: '700',
    },
    quickLogBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 14,
    },
    quickLogText: {
        fontSize: 13,
        fontWeight: '900',
    },
    addMoreBtn: {
        padding: 4,
    },
    loggedContainer: {
        marginTop: 18,
        paddingTop: 14,
        borderTopWidth: 1,
    },
    logRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    logBullet: {
        width: 4,
        height: 4,
        borderRadius: 2,
        marginRight: 12,
    },
    logMain: {
        flex: 1,
    },
    foodName: {
        fontSize: 14,
        fontWeight: '700',
    },
    foodCals: {
        fontSize: 11,
        fontWeight: '600',
        marginTop: 1,
    },
    foodThumb: {
        width: 36,
        height: 36,
        borderRadius: 10,
        marginLeft: 12,
    },
    foodIconPlaceholder: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 12,
    }
});
