import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Dimensions,
    ActivityIndicator,
    RefreshControl,
    Animated,
    Platform,
    useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import Svg, { Line, Path, Defs, LinearGradient as SvgGradient, Stop, Circle, Rect, Text as SvgText, ClipPath } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { format, subDays } from 'date-fns';
import {
    getReportData,
    clearReportCache,
    ReportRange,
    ReportData,
    ConsistencyMetrics,
    NutritionMetrics,
    BodyMetrics,
    HydrationMetrics,
} from '../services/myReportService';
import { SnapshotsView } from '../components/dashboard/SnapshotsView';

export function useChartDimensions() {
    const { width } = useWindowDimensions();
    const CHART_WIDTH = width - 72;
    const CHART_HEIGHT = 160;
    const LEFT_MARGIN = 35;
    const RIGHT_MARGIN = 15;
    const TOP_MARGIN = 20;
    const BOTTOM_MARGIN = 30;
    const DRAW_WIDTH = CHART_WIDTH - LEFT_MARGIN - RIGHT_MARGIN;
    const DRAW_HEIGHT = CHART_HEIGHT - TOP_MARGIN - BOTTOM_MARGIN;
    return { CHART_WIDTH, CHART_HEIGHT, LEFT_MARGIN, RIGHT_MARGIN, TOP_MARGIN, BOTTOM_MARGIN, DRAW_WIDTH, DRAW_HEIGHT };
}

// ── Types ──────────────────────────────────────────────────────────────────

type MainTab = 'CHARTS' | 'SNAPSHOTS';
type RangeKey = 'Month' | '3 Months' | '6 Months' | 'Year';

const RANGE_MAP: Record<RangeKey, ReportRange> = {
    'Month': 'MONTH',
    '3 Months': 'THREE_MONTHS',
    '6 Months': 'SIX_MONTHS',
    'Year': 'YEAR',
};
const RANGE_LABELS: RangeKey[] = ['Month', '3 Months', '6 Months', 'Year'];

// ── Chart Helpers ──────────────────────────────────────────────────────────

function getSmoothPath(points: { x: number; y: number }[]): string {
    if (points.length < 2) return '';
    let d = `M${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
        const curr = points[i];
        const next = points[i + 1];
        const tension = 0.15;
        const prev = points[i - 1] || curr;
        const secondNext = points[i + 2] || next;
        const cp1x = curr.x + (next.x - prev.x) * tension;
        const cp1y = curr.y + (next.y - prev.y) * tension;
        const cp2x = next.x - (secondNext.x - curr.x) * tension;
        const cp2y = next.y - (secondNext.y - curr.y) * tension;
        d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${next.x},${next.y}`;
    }
    return d;
}

function mapToChartPoints(
    data: { date: string; value: number }[],
    minVal: number,
    maxVal: number,
    dims: any,
    startDateStr?: string,
    totalDays?: number
): { x: number; y: number; label: string; value: number }[] {
    const { DRAW_WIDTH, DRAW_HEIGHT, LEFT_MARGIN, TOP_MARGIN } = dims;
    if (data.length === 0) return [];
    const range = maxVal - minVal || 1;

    // If not mapped by time, space evenly
    if (!startDateStr || !totalDays || totalDays <= 1) {
        const stepX = data.length > 1 ? DRAW_WIDTH / (data.length - 1) : 0;
        return data.map((d, i) => ({
            x: i * stepX + LEFT_MARGIN,
            y: DRAW_HEIGHT - ((d.value - minVal) / range) * DRAW_HEIGHT + TOP_MARGIN,
            label: format(new Date(d.date + 'T00:00:00'), 'MMM d'),
            value: d.value,
        }));
    }

    // Map by absolute time in chronological order: Past = Left, Today = Right.
    const startMs = new Date(startDateStr + 'T00:00:00').getTime();

    return data.map((d) => {
        const dMs = new Date(d.date + 'T00:00:00').getTime();
        const diffFromStart = Math.max(0, Math.round((dMs - startMs) / 86400000));
        const pct = totalDays > 1 ? Math.min(1, diffFromStart / (totalDays - 1)) : 0;

        return {
            x: LEFT_MARGIN + pct * DRAW_WIDTH,
            y: DRAW_HEIGHT - ((d.value - minVal) / range) * DRAW_HEIGHT + TOP_MARGIN,
            label: format(new Date(d.date + 'T00:00:00'), 'MMM d'),
            value: d.value,
        };
    }).sort((a, b) => a.x - b.x);
}

// ── Root Screen ────────────────────────────────────────────────────────────

export default function MyReportScreen({ navigation }: any) {
    const { user } = useAuth();
    const { theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();

    const [activeTab, setActiveTab] = useState<MainTab>('CHARTS');
    const tabAnim = useRef(new Animated.Value(0)).current;

    const switchTab = (tab: MainTab) => {
        setActiveTab(tab);
        Animated.spring(tabAnim, {
            toValue: tab === 'CHARTS' ? 0 : 1,
            tension: 300,
            friction: 30,
            useNativeDriver: false,
        }).start();
    };

    const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

    // Animated indicator position
    const indicatorLeft = tabAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '50%'],
    });

    return (
        <View style={[styles.root, { paddingTop: insets.top }]}>

            {/* ── Sticky Header ── */}
            <View style={styles.headerBlock}>
                <Text style={styles.screenTitle}>Progress</Text>
                <Text style={styles.screenSub}>Track your charts and body transformation</Text>
            </View>

            {/* ── Main Tab Switcher ── */}
            <View style={styles.mainTabWrapper}>
                <View style={[styles.mainTabTrack, {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                }]}>
                    {/* Sliding pill */}
                    <Animated.View style={[styles.mainTabPill, { left: indicatorLeft, backgroundColor: theme.primary }]} />

                    <TouchableOpacity
                        style={styles.mainTabBtn}
                        onPress={() => switchTab('CHARTS')}
                        activeOpacity={0.8}
                    >
                        <Ionicons
                            name={activeTab === 'CHARTS' ? 'bar-chart' : 'bar-chart-outline'}
                            size={16}
                            color={activeTab === 'CHARTS' ? '#FFF' : theme.textSecondary}
                        />
                        <Text style={[
                            styles.mainTabLabel,
                            { color: activeTab === 'CHARTS' ? '#FFF' : theme.textSecondary }
                        ]}>
                            Charts
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.mainTabBtn}
                        onPress={() => switchTab('SNAPSHOTS')}
                        activeOpacity={0.8}
                    >
                        <Ionicons
                            name={activeTab === 'SNAPSHOTS' ? 'images' : 'images-outline'}
                            size={16}
                            color={activeTab === 'SNAPSHOTS' ? '#FFF' : theme.textSecondary}
                        />
                        <Text style={[
                            styles.mainTabLabel,
                            { color: activeTab === 'SNAPSHOTS' ? '#FFF' : theme.textSecondary }
                        ]}>
                            Snapshots
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── Tab Content ── */}
            {activeTab === 'CHARTS'
                ? <ChartsTab navigation={navigation} theme={theme} isDark={isDark} styles={styles} user={user} />
                : <SnapshotsTab theme={theme} isDark={isDark} styles={styles} />
            }
        </View>
    );
}

// ── Charts Tab ────────────────────────────────────────────────────────────

function ChartsTab({ navigation, theme, isDark, styles, user }: any) {
    const [selectedRange, setSelectedRange] = useState<RangeKey>('Month');
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchReport = useCallback(async (forceRefresh = false) => {
        if (!user?.id) { setLoading(false); return; }
        try {
            setError(null);
            if (forceRefresh) clearReportCache();
            const data = await getReportData(user.id, RANGE_MAP[selectedRange]);
            setReportData(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load report data.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user?.id, selectedRange]);

    // ── KEY FIX: Clear stale data immediately when range changes ──
    // Without this, the old numbers/charts stay visible during the network request,
    // making it look like the range switch did nothing.
    useEffect(() => {
        setReportData(null);
        setLoading(true);
        fetchReport();
    }, [selectedRange]); // intentionally only selectedRange as dep

    // Separate effect for user ID changes
    useEffect(() => {
        if (!user?.id) return;
        setReportData(null);
        setLoading(true);
        fetchReport();
    }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchReport(true);
    }, [fetchReport]);

    // Keep charts fresh when user returns from Nutrition logging.
    // Without this, the in-memory report cache can show stale hydration stats.
    useFocusEffect(
        useCallback(() => {
            fetchReport(true);
        }, [fetchReport])
    );

    if (loading && !reportData) {
        return (
            <View style={styles.flex}>
                <RangeSelector selectedRange={selectedRange} onSelect={setSelectedRange} theme={theme} isDark={isDark} />
                <View style={styles.centeredState}>
                    <ActivityIndicator size="large" color={theme.primary} />
                    <Text style={[styles.stateText, { color: theme.textSecondary }]}>Crunching your data…</Text>
                </View>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.flex}>
                <RangeSelector selectedRange={selectedRange} onSelect={setSelectedRange} theme={theme} isDark={isDark} />
                <View style={styles.centeredState}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={48} color={theme.error || '#EF4444'} />
                    <Text style={[styles.stateTitle, { color: theme.text }]}>Something went wrong</Text>
                    <Text style={[styles.stateText, { color: theme.textSecondary }]}>{error}</Text>
                    <TouchableOpacity style={[styles.stateBtn, { backgroundColor: theme.primary }]} onPress={() => fetchReport(true)}>
                        <Text style={styles.stateBtnText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    if (reportData && !reportData.hasData) {
        return (
            <View style={styles.flex}>
                <RangeSelector selectedRange={selectedRange} onSelect={setSelectedRange} theme={theme} isDark={isDark} />
                <View style={styles.centeredState}>
                    <MaterialCommunityIcons name="chart-timeline-variant-shimmer" size={64} color={theme.textMuted} />
                    <Text style={[styles.stateTitle, { color: theme.text }]}>No data for this period</Text>
                    <Text style={[styles.stateText, { color: theme.textSecondary }]}>
                        Track meals, water, and weigh-ins to see your report here.
                    </Text>
                    <TouchableOpacity
                        style={[styles.stateBtn, { backgroundColor: theme.primary }]}
                        onPress={() => navigation.navigate('Nutrition')}
                    >
                        <Text style={styles.stateBtnText}>Start Logging</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    if (!reportData) return null;

    return (
        <ScrollView
            style={styles.flex}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 140 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        >
            <RangeSelector selectedRange={selectedRange} onSelect={setSelectedRange} theme={theme} isDark={isDark} />
            <NutritionCard data={reportData.nutrition} theme={theme} isDark={isDark} styles={styles} range={selectedRange} startDate={reportData.startDate} />
            <BodyMetricsCard data={reportData.body} theme={theme} isDark={isDark} styles={styles} range={selectedRange} startDate={reportData.startDate} navigation={navigation} />
            <HydrationCard data={reportData.hydration} theme={theme} isDark={isDark} styles={styles} range={selectedRange} startDate={reportData.startDate} />
        </ScrollView>
    );
}

// ── Snapshots Tab ─────────────────────────────────────────────────────────

function SnapshotsTab({ theme, isDark, styles }: any) {
    return (
        <View style={styles.flex}>
            {/* Preamble row */}
            <View style={[styles.snapshotBanner, {
                backgroundColor: isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.05)',
                borderColor: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.12)',
            }]}>
                <View style={[styles.snapshotBannerIcon, {
                    backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)',
                }]}>
                    <MaterialCommunityIcons name="camera-burst" size={18} color="#6366F1" />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.snapshotBannerTitle, { color: theme.text }]}>Photo Progress</Text>
                    <Text style={[styles.snapshotBannerSub, { color: theme.textSecondary }]}>
                        Upload a photo whenever you weigh in and watch your transformation unfold side-by-side.
                    </Text>
                </View>
            </View>
            {/* Reuse the fully built SnapshotsView — camera, upload, grid, slider, edit, delete */}
            <SnapshotsView />
        </View>
    );
}

// ── Range Selector ─────────────────────────────────────────────────────────

function RangeSelector({ selectedRange, onSelect, theme, isDark }: {
    selectedRange: RangeKey;
    onSelect: (r: RangeKey) => void;
    theme: any;
    isDark: boolean;
}) {
    return (
        <View style={{
            flexDirection: 'row',
            marginHorizontal: 20,
            marginBottom: 20,
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            borderRadius: 16,
            padding: 4,
        }}>
            {RANGE_LABELS.map((label) => {
                const isActive = selectedRange === label;
                return (
                    <TouchableOpacity
                        key={label}
                        onPress={() => onSelect(label)}
                        style={{
                            flex: 1,
                            paddingVertical: 10,
                            borderRadius: 12,
                            alignItems: 'center',
                            backgroundColor: isActive ? theme.primary : 'transparent',
                        }}
                        activeOpacity={0.75}
                    >
                        <Text style={{
                            fontSize: 12,
                            fontWeight: isActive ? '700' : '500',
                            color: isActive ? '#FFFFFF' : theme.textSecondary,
                        }}>
                            {label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

// ── Section A: Consistency ─────────────────────────────────────────────────

function ConsistencyCard({ data, theme, isDark, styles }: {
    data: ConsistencyMetrics; theme: any; isDark: boolean; styles: any;
}) {
    return (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={[styles.cardIcon, { backgroundColor: isDark ? 'rgba(42,75,42,0.15)' : 'rgba(42,75,42,0.1)' }]}>
                    <MaterialCommunityIcons name="target" size={20} color="#2A4B2A" />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Consistency</Text>
                    <Text style={styles.cardInsight}>{data.insight}</Text>
                </View>
            </View>

            <View style={styles.statsRow}>
                <StatBlock label="Goal Hit" value={`${data.goalHitRate}%`} color="#2A4B2A" theme={theme} />
                <StatBlock label="Logging Rate" value={`${data.loggingRate}%`} color="#2A4B2A" theme={theme} />
                <StatBlock label="Best" value={`${data.longestStreak}d`} color="#F1C93B" theme={theme} hideValue />
            </View>

            <View>
                <View style={styles.pbRow}>
                    <Text style={[styles.pbLabel, { color: theme.textSecondary }]}>Goal Hit Rate</Text>
                    <Text style={[styles.pbValue, { color: theme.text }]}>{data.daysGoalHit}/{data.totalDaysInRange} days</Text>
                </View>
                <View style={[styles.pbTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
                    <LinearGradient
                        colors={['#2A4B2A', '#3D6B3D']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={[styles.pbFill, { width: `${Math.min(100, data.goalHitRate)}%` }]}
                    />
                </View>
            </View>
        </View>
    );
}

// ── Section B: Nutrition ──────────────────────────────────────────────────

function NutritionCard({ data, theme, isDark, styles, range, startDate }: {
    data: NutritionMetrics; theme: any; isDark: boolean; styles: any; range: RangeKey; startDate: string;
}) {
    const dims = useChartDimensions();
    const { CHART_WIDTH, CHART_HEIGHT, DRAW_WIDTH, DRAW_HEIGHT, LEFT_MARGIN, RIGHT_MARGIN, TOP_MARGIN } = dims;

    const trend = data.calorieAdherenceTrend;
    const maxPoints = range === 'Month' ? 30 : range === '3 Months' ? 45 : 52;
    const step = Math.max(1, Math.floor(trend.length / maxPoints));
    const sampled = trend.filter((_, i) => i % step === 0 || i === trend.length - 1);

    // Calculate total days for correct chart scaling
    const endDate = trend.length > 0 ? new Date() : new Date();
    const totalDays = Math.round((endDate.getTime() - new Date(startDate + 'T00:00:00').getTime()) / 86400000) + 1;

    const allValues = sampled.flatMap(d => [d.hit, d.goal]);
    const minVal = Math.max(0, (allValues.length ? Math.min(...allValues) : 0) * 0.85);
    const maxVal = (allValues.length ? Math.max(...allValues) : 3000) * 1.15 || 3000;
    const hitPoints = mapToChartPoints(sampled.map(d => ({ date: d.date, value: d.hit })), minVal, maxVal, dims, startDate, totalDays);
    const goalY = maxVal > minVal ? DRAW_HEIGHT - ((data.calorieGoal - minVal) / (maxVal - minVal)) * DRAW_HEIGHT + TOP_MARGIN : DRAW_HEIGHT / 2 + TOP_MARGIN;
    const hitPath = getSmoothPath(hitPoints);


    return (
        <React.Fragment>
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={[styles.cardIcon, { backgroundColor: isDark ? 'rgba(42,75,42,0.15)' : 'rgba(42,75,42,0.1)' }]}>
                        <MaterialCommunityIcons name="food-apple" size={20} color="#2A4B2A" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle}>Nutrition</Text>
                        <Text style={styles.cardInsight}>{data.insight}</Text>
                    </View>
                </View>

                {sampled.length > 1 && (
                    <View style={{ marginTop: 8 }}>
                        <Text style={[styles.chartLabel, { color: theme.textSecondary }]}>Calories: Hit vs Goal</Text>
                        <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
                        <Defs>
                            <SvgGradient id="calGrad" x1="0" y1="0" x2="0" y2="1">
                                <Stop offset="0" stopColor="#2A4B2A" stopOpacity="0.3" />
                                <Stop offset="1" stopColor="#2A4B2A" stopOpacity="0" />
                            </SvgGradient>
                        </Defs>
                        {[0, 0.5, 1].map((r) => {
                            const v = maxVal - (maxVal - minVal) * r;
                            const y = DRAW_HEIGHT - ((v - minVal) / (maxVal - minVal)) * DRAW_HEIGHT + TOP_MARGIN;
                            return <React.Fragment key={`cg${r}`}>
                                <Line x1={LEFT_MARGIN} y1={y} x2={CHART_WIDTH - RIGHT_MARGIN} y2={y}
                                    stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'} strokeWidth="1" />
                                <SvgText x={CHART_WIDTH - RIGHT_MARGIN + 6} y={y + 3} fontSize="10" fontWeight="600"
                                    fill={theme.textMuted} opacity={0.6} textAnchor="start">{Math.round(v)}</SvgText>
                            </React.Fragment>;
                        })}
                        {[0, 0.5, 1].map((r) => {
                            const x = LEFT_MARGIN + r * DRAW_WIDTH;
                            const dStr = format(new Date(new Date(startDate + 'T00:00:00').getTime() + Math.floor((totalDays / 2) * 86400000)), 'MMM d');
                            const label = r === 1 ? 'Today' : (r === 0 ? format(new Date(startDate + 'T00:00:00'), 'MMM d') : dStr);
                            const align = r === 0 ? 'start' : (r === 1 ? 'end' : 'middle');
                            return (
                                <SvgText key={`cx${r}`} x={x} y={DRAW_HEIGHT + TOP_MARGIN + 16} fontSize="10" fontWeight="600"
                                    fill={theme.textSecondary} opacity={0.4} textAnchor={align}>{label}</SvgText>
                            );
                        })}
                        <Line x1={LEFT_MARGIN} y1={goalY} x2={CHART_WIDTH - RIGHT_MARGIN} y2={goalY}
                            stroke="#2A4B2A" strokeWidth="1.5" strokeDasharray="4,4" />
                        <SvgText x={CHART_WIDTH - RIGHT_MARGIN + 6} y={goalY + 3} fontSize="10" fontWeight="900"
                            fill="#2A4B2A" textAnchor="start">{data.calorieGoal}</SvgText>
                        <SvgText x={CHART_WIDTH - RIGHT_MARGIN - 6} y={goalY - 4} fontSize="9" fontWeight="900"
                            fill="#2A4B2A" letterSpacing="1" textAnchor="end">GOAL</SvgText>
                        {hitPoints.length > 0 && hitPath && (
                            <React.Fragment>
                                <Path d={`${hitPath} L${hitPoints[hitPoints.length - 1].x},${DRAW_HEIGHT + TOP_MARGIN} L${hitPoints[0].x},${DRAW_HEIGHT + TOP_MARGIN} Z`}
                                    fill="url(#calGrad)" />
                                <Path d={hitPath} stroke="#2A4B2A" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                                {hitPoints.filter((_, i) => i === 0 || i === hitPoints.length - 1).map((pt, i) => (
                                    <Circle key={`cp${i}`} cx={pt.x} cy={pt.y} r="3" fill="#FFF" stroke="#2A4B2A" strokeWidth="1.5" />
                                ))}
                            </React.Fragment>
                        )}
                        </Svg>
                    </View>
                )}
            </View>

            <MacroTrendRow
                title="Protein"
                trend={data.proteinTrend}
                goal={data.proteinGoal}
                avg={data.avgProtein}
                unit="g"
                startDate={startDate}
                range={range}
                theme={theme}
                isDark={isDark}
                styles={styles}
                isLast={false}
            />
            <MacroTrendRow
                title="Carbohydrates"
                trend={data.carbsTrend}
                goal={data.carbsGoal}
                avg={data.avgCarbs}
                unit="g"
                startDate={startDate}
                range={range}
                theme={theme}
                isDark={isDark}
                styles={styles}
                isLast={false}
            />
            <MacroTrendRow
                title="Fats"
                trend={data.fatsTrend}
                goal={data.fatsGoal}
                avg={data.avgFats}
                unit="g"
                startDate={startDate}
                range={range}
                theme={theme}
                isDark={isDark}
                styles={styles}
                isLast
            />
        </React.Fragment>
    );
}

function MacroTrendRow({
    title,
    trend,
    goal,
    avg,
    unit,
    startDate,
    range,
    theme,
    isDark,
    styles,
    isLast,
}: {
    title: string;
    trend: { date: string; hit: number; goal: number }[];
    goal: number;
    avg: number;
    unit: string;
    startDate: string;
    range: RangeKey;
    theme: any;
    isDark: boolean;
    styles: any;
    isLast?: boolean;
}) {
    const baseDims = useChartDimensions();
    const CHART_WIDTH = baseDims.CHART_WIDTH;
    const CHART_HEIGHT = 124;
    const LEFT_MARGIN = baseDims.LEFT_MARGIN;
    const RIGHT_MARGIN = baseDims.RIGHT_MARGIN + 22;
    const TOP_MARGIN = 10;
    const BOTTOM_MARGIN = 18;
    const DRAW_WIDTH = CHART_WIDTH - LEFT_MARGIN - RIGHT_MARGIN;
    const DRAW_HEIGHT = CHART_HEIGHT - TOP_MARGIN - BOTTOM_MARGIN;

    const maxPoints = range === 'Month' ? 30 : range === '3 Months' ? 45 : 52;
    const step = Math.max(1, Math.floor(trend.length / maxPoints));
    const sampled = trend.filter((_, i) => i % step === 0 || i === trend.length - 1);

    const endDate = new Date();
    const totalDays = Math.round((endDate.getTime() - new Date(startDate + 'T00:00:00').getTime()) / 86400000) + 1;

    const values = sampled.map(d => d.hit);
    values.push(goal);
    const minVal = Math.max(0, Math.min(...values, 0) * 0.85);
    const maxVal = Math.max(goal, ...values, 1) * 1.15;
    const goalRatio = maxVal > minVal ? (goal - minVal) / (maxVal - minVal) : 0;
    const axisRatios = [1, 2 / 3, 1 / 3, 0];

    const dims = { DRAW_WIDTH, DRAW_HEIGHT, LEFT_MARGIN, TOP_MARGIN };
    const points = mapToChartPoints(sampled.map(d => ({ date: d.date, value: d.hit })), minVal, maxVal, dims, startDate, totalDays);
    const path = getSmoothPath(points);
    const goalY = maxVal > minVal ? DRAW_HEIGHT - ((goal - minVal) / (maxVal - minVal)) * DRAW_HEIGHT + TOP_MARGIN : DRAW_HEIGHT / 2 + TOP_MARGIN;
    const latest = points.length > 0 ? points[points.length - 1] : null;
    const maxPoint = points.length > 0 ? points.reduce((best, p) => (p.value > best.value ? p : best), points[0]) : null;
    const minPoint = points.length > 0 ? points.reduce((best, p) => (p.value < best.value ? p : best), points[0]) : null;
    const gradientId = `macroGrad_${title.toLowerCase().replace(/\s+/g, '_')}`;
    const goalClipId = `macroGoalClip_${title.toLowerCase().replace(/\s+/g, '_')}`;
    const goalAreaFillId = `macroGoalArea_${title.toLowerCase().replace(/\s+/g, '_')}`;
    const areaPath = points.length > 1
        ? `${path} L${points[points.length - 1].x},${DRAW_HEIGHT + TOP_MARGIN} L${points[0].x},${DRAW_HEIGHT + TOP_MARGIN} Z`
        : '';

    return (
        <View style={[styles.card, { paddingTop: 16, paddingBottom: 10, marginBottom: isLast ? 16 : 10 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>{title}</Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary }}>
                    Avg {avg}{unit} / Goal {goal}{unit}
                </Text>
            </View>
            <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
                <Defs>
                    <SvgGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={theme.primary} stopOpacity="0.18" />
                        <Stop offset="1" stopColor={theme.primary} stopOpacity="0" />
                    </SvgGradient>
                    <SvgGradient id={goalAreaFillId} x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor="#F1C93B" stopOpacity="0.38" />
                        <Stop offset="1" stopColor="#F1C93B" stopOpacity="0.12" />
                    </SvgGradient>
                    <ClipPath id={goalClipId}>
                        <Rect x={0} y={0} width={CHART_WIDTH} height={Math.max(0, goalY)} />
                    </ClipPath>
                </Defs>
                {axisRatios.map((ratio) => {
                    // Skip a tick if it's too close to the goal label to avoid stacked numbers.
                    if (Math.abs(ratio - goalRatio) < 0.08) return null;
                    const v = minVal + (maxVal - minVal) * ratio;
                    const y = DRAW_HEIGHT - ((v - minVal) / (maxVal - minVal)) * DRAW_HEIGHT + TOP_MARGIN;
                    return (
                        <React.Fragment key={`mg${ratio}`}>
                            <Line
                                x1={LEFT_MARGIN}
                                y1={y}
                                x2={CHART_WIDTH - RIGHT_MARGIN}
                                y2={y}
                                stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}
                                strokeWidth="1"
                            />
                            <SvgText
                                x={CHART_WIDTH - RIGHT_MARGIN + 4}
                                y={y + 3}
                                fontSize="9"
                                fontWeight="700"
                                fill={theme.textMuted}
                                opacity={0.55}
                                textAnchor="start"
                            >
                                {Math.round(v)}
                            </SvgText>
                        </React.Fragment>
                    );
                })}
                <Line x1={LEFT_MARGIN} y1={goalY} x2={CHART_WIDTH - RIGHT_MARGIN} y2={goalY}
                    stroke={theme.primary} strokeWidth="1.2" strokeDasharray="3,3" opacity={0.35} />
                <SvgText
                    x={CHART_WIDTH - RIGHT_MARGIN + 4}
                    y={goalY + 3}
                    fontSize="9"
                    fontWeight="900"
                    fill={theme.primary}
                    textAnchor="start"
                >
                    {Math.round(goal)}
                </SvgText>
                {path ? (
                    <React.Fragment>
                        <Path d={areaPath} fill={`url(#${gradientId})`} />
                        <Path d={areaPath} fill={`url(#${goalAreaFillId})`} clipPath={`url(#${goalClipId})`} />
                        <Path d={path} stroke="#2A4B2A" strokeWidth="2.2" fill="none" strokeLinecap="round" />
                        <Path
                            d={path}
                            stroke="#F1C93B"
                            strokeWidth="2.4"
                            fill="none"
                            strokeLinecap="round"
                            clipPath={`url(#${goalClipId})`}
                        />
                        {maxPoint && (
                            <React.Fragment>
                                <Rect
                                    x={maxPoint.x - 14}
                                    y={Math.max(TOP_MARGIN - 2, maxPoint.y - 20)}
                                    width={28}
                                    height={16}
                                    rx={3}
                                    fill={maxPoint.value > goal ? '#F1C93B' : '#2A4B2A'}
                                />
                                <SvgText
                                    x={maxPoint.x}
                                    y={Math.max(TOP_MARGIN + 10, maxPoint.y - 9)}
                                    fontSize="9"
                                    fontWeight="900"
                                    fill={maxPoint.value > goal ? '#1F2937' : '#FFF'}
                                    textAnchor="middle"
                                >
                                    {Math.round(maxPoint.value)}
                                </SvgText>
                                <Circle
                                    cx={maxPoint.x}
                                    cy={maxPoint.y}
                                    r="3.5"
                                    fill="#FFF"
                                    stroke={maxPoint.value > goal ? '#F1C93B' : '#2A4B2A'}
                                    strokeWidth="1.5"
                                />
                            </React.Fragment>
                        )}
                        {minPoint && (!maxPoint || minPoint.x !== maxPoint.x || minPoint.y !== maxPoint.y) && (
                            <React.Fragment>
                                <Rect
                                    x={minPoint.x - 14}
                                    y={Math.max(TOP_MARGIN - 2, minPoint.y - 20)}
                                    width={28}
                                    height={16}
                                    rx={3}
                                    fill={minPoint.value > goal ? '#F1C93B' : '#2A4B2A'}
                                />
                                <SvgText
                                    x={minPoint.x}
                                    y={Math.max(TOP_MARGIN + 10, minPoint.y - 9)}
                                    fontSize="9"
                                    fontWeight="900"
                                    fill={minPoint.value > goal ? '#1F2937' : '#FFF'}
                                    textAnchor="middle"
                                >
                                    {Math.round(minPoint.value)}
                                </SvgText>
                                <Circle
                                    cx={minPoint.x}
                                    cy={minPoint.y}
                                    r="3.5"
                                    fill="#FFF"
                                    stroke={minPoint.value > goal ? '#F1C93B' : '#2A4B2A'}
                                    strokeWidth="1.5"
                                />
                            </React.Fragment>
                        )}
                        {latest && (
                            <Circle
                                cx={latest.x}
                                cy={latest.y}
                                r="3.5"
                                fill="#FFF"
                                stroke={latest.value > goal ? '#F1C93B' : '#2A4B2A'}
                                strokeWidth="1.5"
                            />
                        )}
                    </React.Fragment>
                ) : null}
            </Svg>
        </View>
    );
}

// ── Section C: Body Metrics ───────────────────────────────────────────────

function BodyMetricsCard({ data, theme, isDark, styles, range, startDate, navigation }: {
    data: BodyMetrics; theme: any; isDark: boolean; styles: any; range: RangeKey; startDate: string; navigation: any;
}) {
    const dims = useChartDimensions();
    const { CHART_WIDTH, CHART_HEIGHT, TOP_MARGIN, DRAW_WIDTH, DRAW_HEIGHT, LEFT_MARGIN, RIGHT_MARGIN } = dims;

    const endDate = new Date();
    const totalDays = Math.round((endDate.getTime() - new Date(startDate + 'T00:00:00').getTime()) / 86400000) + 1;

    const weightVals = data.weightTrend.map(w => w.weight);
    if (data.goalWeight) weightVals.push(data.goalWeight);
    const weightMin = weightVals.length > 0 ? Math.min(...weightVals) : 0;
    const weightMax = weightVals.length > 0 ? Math.max(...weightVals) : 100;
    const wBuf = (weightMax - weightMin) * 0.2 || 2;
    const minVal = weightMin - wBuf;
    const maxVal = weightMax + wBuf;

    const weightPoints = data.weightTrend.length > 0 ? mapToChartPoints(data.weightTrend.map(w => ({ date: w.date, value: w.weight })), minVal, maxVal, dims, startDate, totalDays) : [];
    const wPath = getSmoothPath(weightPoints);

    // Range label for header
    const rangeLabel = range === 'Month' ? 'past month' : (range === '3 Months' ? 'past 3 mos' : (range === '6 Months' ? 'past 6 mos' : 'past year'));

    return (
        <View style={styles.card}>
            {/* ── New Header ── */}
            <View style={styles.weightCardHeader}>
                <Text style={styles.weightTitle}>Weight</Text>
                <View style={styles.weightChangeContainer}>
                    <View style={styles.weightChangeRow}>
                        {data.weightChange !== null && data.weightChange !== 0 && (
                            <MaterialCommunityIcons 
                                name={data.weightChange < 0 ? 'arrow-down' : 'arrow-up'} 
                                size={20} 
                                color={data.weightChange <= 0 ? '#10B981' : '#EF4444'} 
                            />
                        )}
                        <Text style={[
                            styles.weightChangeValue, 
                            { color: data.weightChange !== null && data.weightChange <= 0 ? '#10B981' : '#EF4444' }
                        ]}>
                            {data.weightChange !== null ? `${Math.abs(data.weightChange)} kg` : '--'}
                        </Text>
                    </View>
                    <Text style={styles.weightRangeLabel}>{rangeLabel}</Text>
                </View>
            </View>

            {/* Plateau Alert (Kept for functional value) */}
            {data.plateauDetected && (
                <View style={[styles.alertBanner, { backgroundColor: isDark ? 'rgba(241,201,59,0.08)' : 'rgba(241,201,59,0.06)' }]}>
                    <MaterialCommunityIcons name="information-outline" size={15} color="#F1C93B" />
                    <Text style={[styles.alertText, { color: theme.textSecondary }]}>
                        Weight plateau detected. Consider adjusting your plan.
                    </Text>
                </View>
            )}

            {/* ── Chart with RIGHT Axis ── */}
            {(weightPoints.length > 0 || data.goalWeight) && (
                <View style={{ marginTop: 8 }}>
                    <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
                        <Defs>
                            <SvgGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
                                <Stop offset="0" stopColor={theme.primary} stopOpacity="0.2" />
                                <Stop offset="1" stopColor={theme.primary} stopOpacity="0" />
                            </SvgGradient>
                        </Defs>
                        
                        {/* Grid & Axis Labels (RIGHT) */}
                        {[0, 0.5, 1].map((r) => {
                            const v = maxVal - (maxVal - minVal) * r;
                            const y = DRAW_HEIGHT - ((v - minVal) / (maxVal - minVal)) * DRAW_HEIGHT + TOP_MARGIN;
                            return <React.Fragment key={`bg${r}`}>
                                <Line x1={LEFT_MARGIN} y1={y} x2={CHART_WIDTH - RIGHT_MARGIN} y2={y}
                                    stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'} strokeWidth="1" />
                                <SvgText x={CHART_WIDTH - RIGHT_MARGIN + 6} y={y + 3} fontSize="10" fontWeight="600"
                                    fill={theme.textMuted} opacity={0.6} textAnchor="start">{v.toFixed(1)}</SvgText>
                            </React.Fragment>;
                        })}

                        {/* X-Axis labels */}
                        {[0, 0.5, 1].map((r) => {
                            const x = LEFT_MARGIN + r * DRAW_WIDTH;
                            const dStr = format(new Date(new Date(startDate + 'T00:00:00').getTime() + Math.floor((totalDays / 2) * 86400000)), 'MMM d');
                            const label = r === 1 ? 'Today' : (r === 0 ? format(new Date(startDate + 'T00:00:00'), 'MMM d') : dStr);
                            const align = r === 0 ? 'start' : (r === 1 ? 'end' : 'middle');
                            return (
                                <SvgText key={`bx${r}`} x={x} y={DRAW_HEIGHT + TOP_MARGIN + 16} fontSize="10" fontWeight="600"
                                    fill={theme.textMuted} opacity={0.6} textAnchor={align}>{label}</SvgText>
                            );
                        })}

                        {/* Goal line */}
                        {data.goalWeight && ((() => {
                            const gy = DRAW_HEIGHT - ((data.goalWeight - minVal) / (maxVal - minVal)) * DRAW_HEIGHT + TOP_MARGIN;
                            return (
                                <Line x1={LEFT_MARGIN} y1={gy} x2={CHART_WIDTH - RIGHT_MARGIN} y2={gy}
                                    stroke={theme.primary} opacity={0.3} strokeWidth="1.5" strokeDasharray="4,4" />
                            );
                        })())}

                        {/* Trend path */}
                        {weightPoints.length > 0 && wPath && (
                            <React.Fragment>
                                <Path d={`${wPath} L${weightPoints[weightPoints.length - 1].x},${DRAW_HEIGHT + TOP_MARGIN} L${weightPoints[0].x},${DRAW_HEIGHT + TOP_MARGIN} Z`}
                                    fill="url(#wGrad)" />
                                <Path d={wPath} stroke={theme.primary} strokeWidth="3" fill="none" strokeLinecap="round" />
                                
                                {/* Latest Point Indicator (Box) */}
                                {(() => {
                                    const pt = weightPoints[weightPoints.length - 1];
                                    const boxW = 32;
                                    const boxH = 20;
                                    return (
                                        <React.Fragment>
                                            <Rect x={pt.x - boxW / 2} y={pt.y - boxH - 6} width={boxW} height={boxH} rx={4} fill={theme.primary} />
                                            <SvgText x={pt.x} y={pt.y - boxH / 2 - 3} fontSize="11" fill="#FFF" textAnchor="middle" fontWeight="900">
                                                {Math.round(pt.value)}
                                            </SvgText>
                                            <Circle cx={pt.x} cy={pt.y} r="4" fill="#FFF" stroke={theme.primary} strokeWidth="2" />
                                        </React.Fragment>
                                    );
                                })()}
                            </React.Fragment>
                        )}
                    </Svg>
                </View>
            )}

            {/* ── Footer ── */}
            <View style={styles.weightFooter}>
                <View style={styles.weightLatestContainer}>
                    <Text style={styles.weightLatestLabel}>Latest</Text>
                    <Text style={styles.weightLatestValue}>{data.endWeight !== null ? `${data.endWeight} kg` : '--'}</Text>
                </View>
                <TouchableOpacity 
                    style={styles.recordBtn} 
                    activeOpacity={0.8}
                    onPress={() => (navigation as any).navigate('HealthMetrics', { isHardGate: false })}
                >
                    <Text style={styles.recordBtnText}>Update</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

// ── Section D: Hydration ──────────────────────────────────────────────────

function HydrationCard({ data, theme, isDark, styles, range, startDate }: {
    data: HydrationMetrics; theme: any; isDark: boolean; styles: any; range: RangeKey; startDate: string;
}) {
    const dims = useChartDimensions();
    const { CHART_WIDTH, CHART_HEIGHT, TOP_MARGIN, DRAW_WIDTH, DRAW_HEIGHT, LEFT_MARGIN, RIGHT_MARGIN } = dims;

    const waterData = data.dailyWater;
    const maxPoints = 30;
    const step = Math.max(1, Math.floor(waterData.length / maxPoints));
    const sampled = waterData.filter((_, i) => i % step === 0 || i === waterData.length - 1);

    const endDate = new Date();
    const totalDays = Math.round((endDate.getTime() - new Date(startDate + 'T00:00:00').getTime()) / 86400000) + 1;

    const allValues = sampled.map(d => d.totalWater);
    allValues.push(2000);
    const minVal = 0;
    const maxVal = Math.max(...allValues, 2200) * 1.1;
    const waterPoints = sampled.length > 0
        ? mapToChartPoints(sampled.map(d => ({ date: d.date, value: d.totalWater })), minVal, maxVal, dims, startDate, totalDays)
        : [];
    const waterPath = waterPoints.length >= 2
        ? getSmoothPath(waterPoints)
        : (waterPoints.length === 1
            ? `M${LEFT_MARGIN},${waterPoints[0].y} L${CHART_WIDTH - RIGHT_MARGIN},${waterPoints[0].y}`
            : '');
    const waterAreaPath = waterPoints.length >= 2
        ? `${waterPath} L${waterPoints[waterPoints.length - 1].x},${DRAW_HEIGHT + TOP_MARGIN} L${waterPoints[0].x},${DRAW_HEIGHT + TOP_MARGIN} Z`
        : (waterPoints.length === 1
            ? `${waterPath} L${CHART_WIDTH - RIGHT_MARGIN},${DRAW_HEIGHT + TOP_MARGIN} L${LEFT_MARGIN},${DRAW_HEIGHT + TOP_MARGIN} Z`
            : '');
    const goalY = DRAW_HEIGHT - ((2000 - minVal) / (maxVal - minVal || 1)) * DRAW_HEIGHT + TOP_MARGIN;
    const latest = waterPoints.length > 0 ? waterPoints[waterPoints.length - 1] : null;

    return (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={[styles.cardIcon, { backgroundColor: isDark ? 'rgba(6,182,212,0.15)' : 'rgba(6,182,212,0.1)' }]}>
                    <MaterialCommunityIcons name="water" size={20} color="#06B6D4" />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Hydration</Text>
                    <Text style={styles.cardInsight}>{data.insight}</Text>
                </View>
            </View>

            <View style={styles.statsRow}>
                <StatBlock label="Hit Rate" value={`${data.waterGoalHitRate}%`} color="#06B6D4" theme={theme} />
                <StatBlock label="Consistency" value={`${data.waterConsistencyRate}%`} color="#06B6D4" theme={theme} />
                <StatBlock label="Wk Avg" value={`${(data.weeklyAverageWater / 1000).toFixed(1)}L`} color="#06B6D4" theme={theme} />
            </View>

            {sampled.length > 0 && (
                <View style={{ marginTop: 8 }}>
                    <Text style={[styles.chartLabel, { color: theme.textSecondary }]}>Daily Water Intake</Text>
                    <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
                        <Defs>
                            <SvgGradient id="hydrationGrad" x1="0" y1="0" x2="0" y2="1">
                                <Stop offset="0" stopColor="#06B6D4" stopOpacity="0.22" />
                                <Stop offset="1" stopColor="#06B6D4" stopOpacity="0" />
                            </SvgGradient>
                        </Defs>
                        {[0, 0.5, 1].map((r) => {
                            const v = maxVal - (maxVal - minVal) * r;
                            const y = DRAW_HEIGHT - ((v - minVal) / (maxVal - minVal || 1)) * DRAW_HEIGHT + TOP_MARGIN;
                            const text = r === 1 ? '0' : `${(v / 1000).toFixed(1)}L`;
                            return <React.Fragment key={`hg${r}`}>
                                <Line x1={LEFT_MARGIN} y1={y} x2={CHART_WIDTH - RIGHT_MARGIN} y2={y}
                                    stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'} strokeWidth="1" />
                                <SvgText x={CHART_WIDTH - RIGHT_MARGIN + 6} y={y + 3} fontSize="10" fontWeight="600"
                                    fill={theme.textMuted} opacity={0.6} textAnchor="start">{text}</SvgText>
                            </React.Fragment>;
                        })}
                        {[0, 0.5, 1].map((r) => {
                            const x = LEFT_MARGIN + r * DRAW_WIDTH;
                            const dStr = format(new Date(new Date(startDate + 'T00:00:00').getTime() + Math.floor((totalDays / 2) * 86400000)), 'MMM d');
                            const label = r === 1 ? 'Today' : (r === 0 ? format(new Date(startDate + 'T00:00:00'), 'MMM d') : dStr);
                            const align = r === 0 ? 'start' : (r === 1 ? 'end' : 'middle');
                            return (
                                <SvgText key={`hx${r}`} x={x} y={DRAW_HEIGHT + TOP_MARGIN + 16} fontSize="10" fontWeight="600"
                                    fill={theme.textSecondary} opacity={0.4} textAnchor={align}>{label}</SvgText>
                            );
                        })}
                        <Line x1={LEFT_MARGIN} y1={goalY} x2={CHART_WIDTH - RIGHT_MARGIN} y2={goalY}
                            stroke="#06B6D4" strokeWidth="1.5" strokeDasharray="4,4" />
                        <SvgText x={CHART_WIDTH - RIGHT_MARGIN + 6} y={goalY + 3} fontSize="10" fontWeight="900"
                            fill="#06B6D4" textAnchor="start">2.0L</SvgText>
                        <SvgText x={CHART_WIDTH - RIGHT_MARGIN - 6} y={goalY - 4} fontSize="9" fontWeight="900"
                            fill="#06B6D4" letterSpacing="1" textAnchor="end">GOAL</SvgText>
                        {waterPath && (
                            <React.Fragment>
                                <Path
                                    d={waterAreaPath}
                                    fill="url(#hydrationGrad)"
                                />
                                <Path d={waterPath} stroke="#06B6D4" strokeWidth="2.8" fill="none" strokeLinecap="round" />
                                {latest && (
                                    <React.Fragment>
                                        <Rect
                                            x={latest.x - 16}
                                            y={latest.y - 26}
                                            width={32}
                                            height={18}
                                            rx={4}
                                            fill="#06B6D4"
                                        />
                                        <SvgText
                                            x={latest.x}
                                            y={latest.y - 14}
                                            fontSize="10"
                                            fontWeight="900"
                                            fill="#FFFFFF"
                                            textAnchor="middle"
                                        >
                                            {(latest.value / 1000).toFixed(1)}L
                                        </SvgText>
                                        <Circle cx={latest.x} cy={latest.y} r="4" fill="#FFF" stroke="#06B6D4" strokeWidth="2" />
                                    </React.Fragment>
                                )}
                            </React.Fragment>
                        )}
                    </Svg>
                </View>
            )}
        </View>
    );
}

// ── Shared Small Components ────────────────────────────────────────────────

function StatBlock({ label, value, color, theme, hideValue, isLast }: { label: string; value: string; color: string; theme: any; hideValue?: boolean; isLast?: boolean }) {
    return (
        <View style={[
            { flex: 1, alignItems: 'center' },
            hideValue && { height: 42, marginLeft: -1 },
            isLast && hideValue && { marginRight: -158 },
        ]}>
            {!hideValue && <Text style={{ fontSize: 20, fontWeight: '800', color, letterSpacing: -0.5 }}>{value}</Text>}
            <Text style={{ fontSize: 10, fontWeight: '500', color: theme.textMuted, marginTop: hideValue ? 0 : 2, textAlign: 'center' }}>{label}</Text>
        </View>
    );
}

// ── Styles ─────────────────────────────────────────────────────────────────

function createStyles(theme: any, isDark: boolean) {
    return StyleSheet.create({
        root: {
            flex: 1,
            backgroundColor: theme.background,
        },
        flex: {
            flex: 1,
        },

        // ── Header
        headerBlock: {
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 4,
        },
        screenTitle: {
            fontSize: 28,
            fontWeight: '800',
            color: theme.text,
            letterSpacing: -0.5,
        },
        screenSub: {
            fontSize: 13,
            color: theme.textSecondary,
            marginTop: 2,
        },

        // ── Main Tab Switcher
        mainTabWrapper: {
            paddingHorizontal: 20,
            paddingTop: 14,
            paddingBottom: 18,
        },
        mainTabTrack: {
            flexDirection: 'row',
            borderRadius: 18,
            padding: 4,
            position: 'relative',
            overflow: 'hidden',
        },
        mainTabPill: {
            position: 'absolute',
            top: 4,
            bottom: 4,
            width: '50%',
            borderRadius: 14,
        },
        mainTabBtn: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 11,
            gap: 7,
            zIndex: 1,
        },
        mainTabLabel: {
            fontSize: 14,
            fontWeight: '700',
            letterSpacing: 0.2,
        },

        // ── Card
        card: {
            marginHorizontal: 20,
            marginBottom: 16,
            backgroundColor: isDark ? 'rgba(31,41,55,0.5)' : '#FFFFFF',
            borderRadius: 20,
            padding: 20,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            ...(isDark ? {} : {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.05,
                shadowRadius: 12,
                elevation: 2,
            }),
        },
        weightCardHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 20,
        },
        weightTitle: {
            fontSize: 24,
            fontWeight: '800',
            color: theme.text,
            letterSpacing: -0.5,
        },
        weightChangeContainer: {
            alignItems: 'flex-end',
        },
        weightChangeRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        weightChangeValue: {
            fontSize: 18,
            fontWeight: '800',
        },
        weightRangeLabel: {
            fontSize: 11,
            fontWeight: '600',
            color: theme.textMuted,
            marginTop: 2,
        },
        cardHeader: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            marginBottom: 16,
            gap: 12,
        },
        cardIcon: {
            width: 40,
            height: 40,
            borderRadius: 12,
            justifyContent: 'center',
            alignItems: 'center',
        },
        cardTitle: {
            fontSize: 17,
            fontWeight: '700',
            color: theme.text,
        },
        cardInsight: {
            fontSize: 13,
            color: theme.textSecondary,
            lineHeight: 18,
            marginTop: 2,
        },

        // ── Stat row
        statsRow: {
            flexDirection: 'row',
            marginBottom: 16,
        },

        // ── Progress bar
        pbRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 6,
        },
        pbLabel: {
            fontSize: 12,
            fontWeight: '500',
        },
        pbValue: {
            fontSize: 12,
            fontWeight: '700',
        },
        pbTrack: {
            height: 8,
            borderRadius: 4,
            overflow: 'hidden',
        },
        pbFill: {
            height: '100%',
            borderRadius: 4,
        },

        // ── Chart
        chartLabel: {
            fontSize: 12,
            fontWeight: '600',
            marginBottom: 6,
        },
        weightFooter: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 16,
            paddingTop: 16,
            borderTopWidth: 1,
            borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        },
        weightLatestContainer: {
            gap: 2,
        },
        weightLatestLabel: {
            fontSize: 13,
            fontWeight: '600',
            color: theme.textSecondary,
        },
        weightLatestValue: {
            fontSize: 24,
            fontWeight: '800',
            color: theme.text,
        },
        recordBtn: {
            backgroundColor: theme.primary,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 24,
            shadowColor: theme.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 4,
        },
        recordBtnText: {
            color: '#FFF',
            fontSize: 15,
            fontWeight: '800',
        },

        // ── Alert banner
        alertBanner: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 12,
            marginBottom: 14,
        },
        alertText: {
            fontSize: 12,
            fontWeight: '500',
            flex: 1,
            lineHeight: 16,
        },

        // ── States
        centeredState: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 40,
        },
        stateTitle: {
            fontSize: 18,
            fontWeight: '700',
            marginTop: 16,
        },
        stateText: {
            fontSize: 14,
            textAlign: 'center',
            marginTop: 8,
            lineHeight: 20,
        },
        stateBtn: {
            marginTop: 24,
            paddingHorizontal: 32,
            paddingVertical: 13,
            borderRadius: 12,
        },
        stateBtnText: {
            color: '#FFF',
            fontWeight: '700',
            fontSize: 15,
        },

        // ── Snapshot banner
        snapshotBanner: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 12,
            marginHorizontal: 20,
            marginBottom: 4,
            padding: 14,
            borderRadius: 16,
            borderWidth: 1,
        },
        snapshotBannerIcon: {
            width: 36,
            height: 36,
            borderRadius: 10,
            justifyContent: 'center',
            alignItems: 'center',
        },
        snapshotBannerTitle: {
            fontSize: 14,
            fontWeight: '700',
        },
        snapshotBannerSub: {
            fontSize: 12,
            lineHeight: 17,
            marginTop: 2,
        },
    });
}
