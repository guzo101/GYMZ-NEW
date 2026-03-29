import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../hooks/useTheme';
import { designSystem } from '../../theme/designSystem';
import { ProgressReport } from '../../services/progressReportService';

interface ProgressReportCardProps {
    report: ProgressReport;
    onClose: () => void;
    onViewFullProgress: () => void;
}

export const ProgressReportCard: React.FC<ProgressReportCardProps> = ({
    report,
    onClose,
    onViewFullProgress,
}) => {
    const { theme } = useTheme();

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#2A4B2A', '#F1C93B']}
                style={styles.gradient}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.milestoneBadge}>
                        <Text style={styles.milestoneText}>DAY {report.dayNumber}</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <MaterialCommunityIcons name="close" size={20} color="rgba(255,255,255,0.7)" />
                    </TouchableOpacity>
                </View>

                {/* Content */}
                <Text style={styles.title}>{report.title}</Text>
                <Text style={styles.message}>{report.message}</Text>

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    <ReportStat
                        icon="arm-flex"
                        label="Avg Protein"
                        value={`${report.stats.avgProtein}g`}
                    />
                    <ReportStat
                        icon="calendar-check"
                        label="Logged"
                        value={`${report.stats.daysLogged}/7 days`}
                    />
                    <ReportStat
                        icon="bullseye-arrow"
                        label="Consistency"
                        value={`${report.stats.consistencyScore}%`}
                    />
                    {report.stats.weightDelta !== null && (
                        <ReportStat
                            icon="scale-bathroom"
                            label="Weight Change"
                            value={`${report.stats.weightDelta > 0 ? '+' : ''}${report.stats.weightDelta}kg`}
                        />
                    )}
                </View>

                {/* Footer Action */}
                <TouchableOpacity
                    style={styles.ctaButton}
                    onPress={onViewFullProgress}
                >
                    <Text style={styles.ctaText}>VIEW FULL PROGRESS</Text>
                    <MaterialCommunityIcons name="arrow-right" size={16} color="#2A4B2A" />
                </TouchableOpacity>
            </LinearGradient>
        </View>
    );
};

const ReportStat = ({ icon, label, value }: any) => (
    <View style={styles.statItem}>
        <View style={styles.statIconContainer}>
            <MaterialCommunityIcons name={icon} size={18} color="#FFF" />
        </View>
        <View>
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={styles.statValue}>{value}</Text>
        </View>
    </View>
);

const styles = StyleSheet.create({
    container: {
        marginBottom: 24,
        ...designSystem.shadows.lg,
    },
    gradient: {
        padding: 24,
        borderRadius: 32,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    milestoneBadge: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    milestoneText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1,
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        color: '#FFF',
        fontSize: 22,
        fontWeight: '900',
        marginBottom: 8,
    },
    message: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 14,
        fontWeight: '500',
        lineHeight: 20,
        marginBottom: 24,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 24,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '45%',
        gap: 12,
    },
    statIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    statLabel: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    statValue: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '800',
    },
    ctaButton: {
        backgroundColor: '#FFF',
        height: 48,
        borderRadius: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    ctaText: {
        color: '#2A4B2A',
        fontSize: 14,
        fontWeight: '900',
    },
});
