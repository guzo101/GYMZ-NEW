/**
 * DashboardLayoutWeekRow
 * Clean week/day selector for the Dashboard.
 * No hidden padding. Spacing controlled by parent via marginBottom.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { useTheme } from '../../hooks/useTheme';
import { DASHBOARD_LAYOUT } from './dashboardLayoutConstants';

interface DashboardLayoutWeekRowProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

export const DashboardLayoutWeekRow: React.FC<DashboardLayoutWeekRowProps> = ({
  selectedDate,
  onDateSelect,
}) => {
  const { theme, isDark } = useTheme();
  const startDate = startOfWeek(new Date());
  const days = Array.from({ length: 7 }).map((_, i) => addDays(startDate, i));

  return (
    <View style={styles.container}>
      <View style={styles.daysRow}>
        {days.map((day) => {
          const isSelected = isSameDay(day, selectedDate);
          const dayName = format(day, 'EEEEEE');
          const isToday = isSameDay(day, new Date());

          return (
            <TouchableOpacity
              key={day.toISOString()}
              style={styles.dayItem}
              onPress={() => onDateSelect(day)}
            >
              <Text style={[styles.dayLabel, { color: theme.textSecondary }]}>{dayName}</Text>
              <View
                style={[
                  styles.circle,
                  { borderColor: isSelected ? theme.primary : theme.border },
                  isSelected && {
                    backgroundColor: isDark ? 'rgba(42, 75, 42, 0.2)' : 'rgba(42, 75, 42, 0.1)',
                  },
                ]}
              >
                {isToday && <View style={[styles.dot, { backgroundColor: theme.primary }]} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 0,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayItem: {
    alignItems: 'center',
    gap: 8,
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderStyle: 'dashed',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    position: 'absolute',
    top: -10,
  },
});
