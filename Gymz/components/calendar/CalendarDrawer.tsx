import React, { useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Animated,
    Dimensions,
    TouchableWithoutFeedback,
    ScrollView
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';

type CalendarViewType = 'schedule' | 'day' | '3day' | 'week' | 'month';

interface CalendarDrawerProps {
    isVisible: boolean;
    onClose: () => void;
    currentView: CalendarViewType;
    onSelectView: (view: CalendarViewType) => void;
    showGymCalendar: boolean;
    showPersonalCalendar: boolean;
    onToggleGym: () => void;
    onTogglePersonal: () => void;
}

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.8;

export const CalendarDrawer: React.FC<CalendarDrawerProps> = ({
    isVisible,
    onClose,
    currentView,
    onSelectView,
    showGymCalendar,
    showPersonalCalendar,
    onToggleGym,
    onTogglePersonal
}) => {
    const { theme } = useTheme();
    const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

    useEffect(() => {
        if (isVisible) {
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: -DRAWER_WIDTH,
                duration: 250,
                useNativeDriver: true,
            }).start();
        }
    }, [isVisible]);

    const handleViewSelect = (view: CalendarViewType) => {
        onSelectView(view);
        onClose(); // Auto close on selection
    };

    const renderViewOption = (view: CalendarViewType, icon: string, label: string) => {
        const isSelected = currentView === view;
        return (
            <TouchableOpacity
                style={[
                    styles.drawerItem,
                    isSelected && { backgroundColor: `${theme.primary}15` }
                ]}
                onPress={() => handleViewSelect(view)}
            >
                <MaterialCommunityIcons
                    name={icon as any}
                    size={24}
                    color={isSelected ? theme.primary : theme.textMuted}
                    style={styles.itemIcon}
                />
                <Text style={[
                    styles.itemText,
                    { color: isSelected ? theme.primary : theme.text }
                ]}>
                    {label}
                </Text>
            </TouchableOpacity>
        );
    };

    const renderCalendarToggle = (
        label: string,
        checked: boolean,
        color: string,
        onToggle: () => void
    ) => (
        <TouchableOpacity
            style={styles.checkboxItem}
            onPress={onToggle}
        >
            <MaterialCommunityIcons
                name={checked ? "checkbox-marked" : "checkbox-blank-outline"}
                size={24}
                color={checked ? color : theme.textMuted}
                style={styles.itemIcon}
            />
            <Text style={[styles.itemText, { color: theme.text }]}>{label}</Text>
        </TouchableOpacity>
    );

    if (!isVisible) return null;

    return (
        <Modal
            transparent
            visible={isVisible}
            animationType="none"
            onRequestClose={onClose}
        >
            <View style={styles.overlayContainer}>
                <TouchableWithoutFeedback onPress={onClose}>
                    <View style={styles.backdrop} />
                </TouchableWithoutFeedback>

                <Animated.View
                    style={[
                        styles.drawerContainer,
                        {
                            backgroundColor: theme.background,
                            transform: [{ translateX: slideAnim }]
                        }
                    ]}
                >
                    <ScrollView contentContainerStyle={styles.drawerContent}>
                        <View style={styles.header}>
                            <Text style={[styles.headerTitle, { color: theme.text }]}>
                                Gym Calendar
                            </Text>
                        </View>

                        <View style={styles.section}>
                            {renderViewOption('schedule', 'calendar-text', 'Schedule')}
                            {renderViewOption('day', 'calendar-today', 'Day')}
                            {renderViewOption('3day', 'view-week', '3 Day')}
                            {renderViewOption('week', 'calendar-week', 'Week')}
                            {renderViewOption('month', 'calendar-month', 'Month')}
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>CALENDARS</Text>
                            {renderCalendarToggle("Gym Schedule", showGymCalendar, theme.primary, onToggleGym)}
                            {renderCalendarToggle("My Schedule", showPersonalCalendar, theme.success || '#10B981', onTogglePersonal)}
                        </View>
                    </ScrollView>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlayContainer: {
        flex: 1,
        flexDirection: 'row',
    },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    drawerContainer: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        width: DRAWER_WIDTH,
        shadowColor: "#000",
        shadowOffset: {
            width: 2,
            height: 0,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    drawerContent: {
        paddingVertical: 50,
        paddingHorizontal: 8,
    },
    header: {
        paddingHorizontal: 16,
        marginBottom: 24,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
    },
    section: {
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '600',
        paddingHorizontal: 16,
        marginBottom: 8,
    },
    drawerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 24, // Pill shape selection
        marginBottom: 4,
    },
    checkboxItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    itemIcon: {
        marginRight: 16,
    },
    itemText: {
        fontSize: 16,
        fontWeight: '500',
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(150,150,150,0.2)',
        marginVertical: 16,
        marginHorizontal: 16,
    }
});
