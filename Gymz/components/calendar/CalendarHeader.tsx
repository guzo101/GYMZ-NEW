import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../hooks/useTheme';
import { designSystem } from '../../theme/designSystem';

interface CalendarHeaderProps {
    currentDate: Date;
    onMenuPress: () => void;
    onTodayPress: () => void;
    onPrevPress: () => void;
    onNextPress: () => void;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
    currentDate,
    onMenuPress,
    onTodayPress,
    onPrevPress,
    onNextPress
}) => {
    const { theme } = useTheme();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.container, {
            backgroundColor: theme.background,
            paddingTop: insets.top + 8
        }]}>
            <View style={styles.leftSection}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.iconButton}
                    >
                        <MaterialCommunityIcons name="arrow-left" size={26} color={theme.text} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={onMenuPress}
                        style={styles.iconButton}
                    >
                        <MaterialCommunityIcons name="menu" size={26} color={theme.text} />
                    </TouchableOpacity>
                </View>

                <View style={styles.titleContainer}>
                    <TouchableOpacity onPress={onPrevPress} style={styles.navButton}>
                        <MaterialCommunityIcons name="chevron-left" size={28} color={theme.text} />
                    </TouchableOpacity>

                    <Text style={[styles.title, { color: theme.text }]}>
                        {format(currentDate, 'MMMM yyyy')}
                    </Text>

                    <TouchableOpacity onPress={onNextPress} style={styles.navButton}>
                        <MaterialCommunityIcons name="chevron-right" size={28} color={theme.text} />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.rightSection}>
                <TouchableOpacity
                    onPress={onTodayPress}
                    style={[styles.todayButton, { borderColor: theme.border }]}
                >
                    <MaterialCommunityIcons name="calendar-blank" size={24} color={theme.text} />
                    <View style={styles.dateNumberContainer}>
                        <Text style={[styles.dateNumber, { color: theme.text }]}>
                            {format(new Date(), 'd')}
                        </Text>
                    </View>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 6,
    },
    leftSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    rightSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    navButton: {
        padding: 4,
    },
    iconButton: {
        padding: 4,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        minWidth: 140,
        textAlign: 'center',
        fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
    },
    todayButton: {
        width: 38,
        height: 38,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    dateNumberContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: -2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dateNumber: {
        fontSize: 10,
        fontWeight: 'bold',
    }
});
