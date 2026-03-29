import React from 'react';
import { View, StyleSheet } from 'react-native';
import { CalendarContainer } from '../components/calendar/CalendarContainer';

export default function GymCalendarScreen() {
    return (
        <View style={styles.container}>
            <CalendarContainer />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
