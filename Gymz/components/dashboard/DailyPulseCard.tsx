import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, useWindowDimensions } from 'react-native';
import Svg, { Circle, G, Defs, LinearGradient as SvgGradient, Stop, Path } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { useCoachCharacter } from '../../contexts/CoachCharacterContext';
import type { BubbleTargetPosition } from '../../contexts/CoachCharacterContext';
import { BUBBLE } from '../coachBubble/constants';

/** Compute bubble center (screen coords) so the bubble sits near the metric rect. */
function getBubbleTargetFromMeasure(
  x: number, y: number, w: number, h: number,
  screenWidth: number
): BubbleTargetPosition {
  const size = BUBBLE.SIZE_IDLE;
  const metricCenterX = x + w / 2;
  const gap = 14;
  const bubbleCenterX = metricCenterX < screenWidth / 2
    ? x + w + gap + size / 2
    : x - gap - size / 2;
  return {
    x: bubbleCenterX,
    y: y + h / 2,
  };
}

const NUDGE_LIBRARY: any = {
    protein: {
        male: {
            zero: [
                "Need {goal}g, {rem}g left. Muscles starving! Eat or they'll eat themselves.",
                "Protein: 0. Gains: 0. Log that shake, bro! {goal}g is waiting.",
                "Biceps in 'emergency power'. Feed them {rem}g now!",
                "Is this a fast? Your muscles are crying for {goal}g.",
                "Turn into a cardio meme? Or eat {rem}g protein?",
                "Losing mass just thinking. Log {rem}g, quick!"
            ],
            near: [
                "Basically there! {rem}g left of {goal}g. One scoop away.",
                "Don't quit now! Just {rem}g to hit the beast mark.",
                "Gains 90% loaded. Finish the {rem}g download!",
                "One shake away from being king. {rem}g left!",
                "Target acquired. {rem}g to lock in those gains.",
                "Almost a masterpiece. Finish {rem}g to be sure."
            ],
            over: [
                "Goal was {goal}g. You hit {cur}g! Chill, Hercules!",
                "Protein King! You're {diff}g over. Evolved status.",
                "Overachiever! {cur}g logged. Biological masterpiece.",
                "Goal crushed. You're {diff}g into beast mode.",
                "Save some for us! {cur}g is plenty, champ.",
                "Nuked the goal by {diff}g. Weights feel insecure."
            ]
        },
        female: {
            zero: [
                "Need {goal}g, {rem}g left. Glow needs fuel, Queen!",
                "Muscles can't live on vibes. Log {rem}g now!",
                "Kitchen closed? Let's see {goal}g gains, goddess!",
                "Body is a temple, needs {goal}g blocks. Log it!",
                "Strong is beautiful, but needs {rem}g protein!",
                "Don't let muscles vanish. Feed them {goal}g!"
            ],
            near: [
                "So close! {rem}g left of {goal}g. Cheering for you!",
                "Just a tiny bit more to hit {goal}g. Go!",
                "Crushing it! One final {rem}g protein push.",
                "Goal in sight, fitness queen! Just {rem}g left.",
                "90% warrior. Lock in that last {rem}g now.",
                "Finish strong, beauty. One more {rem}g log!"
            ],
            over: [
                "Fitness goddess! {cur}g logged. Evolved!",
                "Goal destroyed! {diff}g over. Absolute queen energy!",
                "Gains are real. {cur}g and you're glowing!",
                "Overachiever! {diff}g past your {goal}g target.",
                "Legendary discipline! {cur}g protein today.",
                "Rewrote the rules. {cur}g? Amazing energy!"
            ]
        }
    },
    water: {
        zero: [
            "100% dry. Need 8 cups, {rem} left. Drink up!",
            "70% water, but 100% thirsty. Log {rem} cups!",
            "Dehydration isn't a flex. Get {goal} cups in!",
            "Cells in a desert. Send {goal} cups of rain!",
            "Even your shadow is thirsty. Log {rem} cups!"
        ],
        near: [
            "One more glass! {rem} left of {goal}. Skin will thank you.",
            "Almost hydrated. 1 cup to hit the target!",
            "Hydration 90% there. Finish that bottle!",
            "Almost a mermaid. Just {rem} cup left!",
            "One final glass for hydration legend status."
        ],
        over: [
            "Basically a mermaid. {cur} cups? Incredible flow.",
            "H2O Overachiever. {diff} cups over. Glowing!",
            "Aquaman called. He's impressed by {cur} cups!",
            "Ocean is jealous of your {cur} cups. Crushing it!",
            "Surpassed the goal! Skin probably glows now."
        ]
    },
    kcal: {
        zero: [
            "Is this a strike? Log {goal} kcal or I call mom!",
            "Fuel needed! Log {goal} kcal. Don't live on air.",
            "Metabolism is bored. Give it {goal} kcal to work!",
            "Empty tank alert! Pull over at the {goal} kcal fridge.",
            "Fuel for takeoff. Log your {goal} kcal meal!"
        ],
        near: [
            "Fueling complete! Almost hit {goal} kcal perfectly.",
            "Great balance. {rem} kcal left of your budget.",
            "Nutrition pro! {rem} kcal to be perfectly fueled.",
            "Managing budget like a boss. {rem} kcal left.",
            "Fuel gauge almost 'Full'. {rem} kcal to go!"
        ],
        over: [
            "Extra fuel! {diff} kcal over for heavy lifts.",
            "Fuel tank overflowing! Use that for a PR.",
            "Honesty is gains. {cur} kcal? Beast mode.",
            "Fed the beast. {diff} kcal extra for the gym.",
            "Maximum fuel! {cur} kcal - ready for anything."
        ]
    },
    carbs: {
        zero: [
            "Need {goal}g energy. {rem}g left. Don't crash!",
            "Carbs = Cardio fuel. Log {goal}g or walk slow.",
            "Brain needs sugar. Log {rem}g carbs, genius!",
            "Zero carbs? Your energy is on life support."
        ],
        near: [
            "Almost fueled! {rem}g left of {goal}g carbs.",
            "Ready for takeoff. Just {rem}g more energy.",
            "Precision fueling. {rem}g carbs to hit the goal.",
            "Carb loading almost complete. Check {goal}g."
        ],
        over: [
            "Extra energy! {diff}g carbs. Go sprint!",
            "Carb monster! {cur}g logged. Heavy lifts today.",
            "Glucose level: Elite. {diff}g over target.",
            "Fueled for a marathon. {cur}g is plenty!"
        ]
    },
    fats: {
        zero: [
            "Hormones need help! Log {goal}g fats, quick.",
            "Don't be 'dry'. Need {goal}g healthy fats.",
            "Zero fats? Your brain is screaming for {rem}g.",
            "Healthy fats = Healthy life. Log {goal}g!"
        ],
        near: [
            "Almost balanced! {rem}g fats left to hit {goal}g.",
            "Precision macros. just {rem}g fats to go.",
            "So close! {rem}g fats of {goal}g target. Easy.",
            "Omega levels rising. {rem}g more to goal."
        ],
        over: [
            "Smooth operator! {cur}g fats logged. Nice.",
            "Goal crushed. {diff}g over. Glow is real.",
            "Healthy fats elite. {cur}g is a great target.",
            "Rewrote the macro book. {cur}g fats? Legend."
        ]
    },
    bmi: {
        reminder: [
            "It's been {days} days. The scale is lonely. Jump on!",
            "Ignoring the scale won't hide the gains. Log your weight!",
            "Wait, how much do you weigh again? It's been {days} days!",
            "The AI is guessing now. Feed me a new weight log, human!",
            "Log your weight! Don't make me call your trainer."
        ],
        high: [
            "BMI {cur}? Target {goal}. Drop {diff}kg to be a ninja.",
            "Gravity is hitting hard. Lose {diff}kg for peak health.",
            "Need to drop {diff}kg for that 'Healthy' label. You got this!",
            "BMI {cur} is a bit spicy. Let's lose {diff}kg together.",
            "Target BMI is {goal}. {diff}kg to go. Let's move!"
        ],
        healthy: [
            "BMI {cur}? Absolute perfection. Stay there, elite!",
            "Healthy as a horse. BMI {cur} is the sweet spot.",
            "Metric-wise, you're a masterpiece. Keep it up!",
            "Perfect BMI! Your doctor is probably bored of you. Nice.",
            "Golden ratio achieved! BMI {cur} is pure gold."
        ]
    }
};

const getSmartNudge = (type: string, current: number, goal: number, gender: string = 'male', extra: any = {}) => {
    const day = new Date().getDate();
    const g = gender === 'female' ? 'female' : 'male';
    const lib = NUDGE_LIBRARY[type];
    if (!lib) return "Keep going! You're doing great.";

    const category = lib[g] || lib;

    let state = 'zero';
    if (type === 'bmi') {
        const { lastWeightLogDate } = extra;
        if (lastWeightLogDate) {
            const lastLog = new Date(lastWeightLogDate);
            const now = new Date();
            const daysSince = Math.floor((now.getTime() - lastLog.getTime()) / (1000 * 60 * 60 * 24));
            if (daysSince >= 7) {
                const pool = category['reminder'];
                const template = pool[day % pool.length];
                return template.replace(/{days}/g, daysSince.toString());
            }
        }
        state = current > 24.9 ? 'high' : 'healthy';
        const pool = category[state] || category['healthy'];
        const template = pool[day % pool.length];
        const diff = Math.max(0, extra.weight - extra.targetWeight);
        return template
            .replace(/{cur}/g, current.toFixed(1))
            .replace(/{goal}/g, "24.9")
            .replace(/{diff}/g, diff.toFixed(1));
    }

    if (current > 0) {
        if (current >= goal) state = 'over';
        else if (current >= goal * 0.85) state = 'near';
        else state = 'zero';
    }

    const pool = category[state] || category['zero'];
    const template = pool[day % pool.length];

    const rem = Math.max(0, goal - current);
    const diff = Math.max(0, current - goal);

    return template
        .replace(/{goal}/g, Math.round(goal).toString())
        .replace(/{cur}/g, Math.round(current).toString())
        .replace(/{rem}/g, Math.round(rem).toString())
        .replace(/{diff}/g, Math.round(diff).toString());
};
import { designSystem } from '../../theme/designSystem';

interface DailyPulseCardProps {
    isLoading?: boolean;
    calories: { eaten: number; goal: number; burned: number };
    macros: {
        protein: { eaten: number; goal: number };
        carbs: { eaten: number; goal: number };
        fats: { eaten: number; goal: number };
    };
    level: number;
    xpProgress: number;
    steps: number;
    bmi?: number;
    weight?: number;
    height?: number;
    lastWeightLogDate?: string;
    sleepHours?: string;
    waterIntake?: number;
    onSetGoals?: () => void;
    onQuickAction?: () => void;
}

const DailyPulseCardComponent: React.FC<DailyPulseCardProps> = ({
    isLoading = false,
    calories,
    macros,
    level,
    xpProgress,
    steps,
    bmi = 0,
    weight = 0,
    height = 0,
    lastWeightLogDate,
    sleepHours = '--',
    waterIntake = 0,
    onSetGoals,
    onQuickAction,
}) => {
    const { width: windowWidth } = useWindowDimensions();
    const { theme, isDark } = useTheme();
    const { user } = useAuth();
    const shimmerValue = useRef(new Animated.Value(0)).current;
    const dotPulse = useRef(new Animated.Value(0)).current;
    const coachChar = useCoachCharacter();
    const refBurned = useRef<View>(null);
    const refEaten = useRef<View>(null);
    const refBmi = useRef<View>(null);
    const refProtein = useRef<View>(null);
    const refCarbs = useRef<View>(null);
    const refFat = useRef<View>(null);
    const refKcalFooter = useRef<View>(null);
    const refSteps = useRef<View>(null);
    const refWater = useRef<View>(null);

    const fireWithTarget = (ref: React.RefObject<View | null>, text: string, trigger: Parameters<NonNullable<typeof coachChar>['fireSpeech']>[1]) => {
        ref.current?.measureInWindow((x, y, w, h) => {
            coachChar?.fireSpeech(text, trigger, {
                targetPosition: getBubbleTargetFromMeasure(x, y, w, h, windowWidth),
            });
        });
    };

    const onGoalPress = () => {
        onSetGoals?.();
    };

    useEffect(() => {
        if (isLoading) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(shimmerValue, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(shimmerValue, {
                        toValue: 0,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
            Animated.loop(
                Animated.sequence([
                    Animated.timing(dotPulse, {
                        toValue: 1,
                        duration: 700,
                        useNativeDriver: true,
                    }),
                    Animated.timing(dotPulse, {
                        toValue: 0,
                        duration: 700,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        } else {
            shimmerValue.setValue(0);
            dotPulse.setValue(0);
        }
    }, [isLoading]);

    const opacity = shimmerValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    const screenWidth = windowWidth || 375;
    const CARD_WIDTH = Math.max(300, screenWidth - 40);

    if (isLoading) {
        return (
            <View style={[styles.outerWrapper, { width: CARD_WIDTH }]}>
                <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.backgroundCard, borderRadius: 24, borderBlur: 10 } as any]} />
                <View style={styles.contentContainer}>
                    <Animated.View style={[styles.skeletonTitle, { backgroundColor: theme.border, opacity }]} />
                    <View style={styles.body}>
                        <View style={styles.colLeft}>
                            {[1, 2, 3].map(i => (
                                <Animated.View key={i} style={[styles.skeletonMetric, { backgroundColor: theme.border, opacity, marginBottom: 20 }]} />
                            ))}
                        </View>
                        <Animated.View style={[styles.skeletonGraph, { borderColor: theme.border, opacity }]} />
                        <View style={styles.colRight}>
                            {[1, 2, 3, 4].map(i => (
                                <Animated.View key={i} style={[styles.skeletonMacro, { backgroundColor: theme.border, opacity, marginBottom: 15 }]} />
                            ))}
                        </View>
                    </View>
                    <View style={styles.footer}>
                        <Animated.View style={[styles.skeletonFooter, { backgroundColor: theme.border, opacity }]} />
                        <Animated.View style={[styles.skeletonFooter, { backgroundColor: theme.border, opacity }]} />
                    </View>
                </View>
            </View>
        );
    }

    const kcalLeft = Math.max(0, calories.goal - calories.eaten);
    const kcalProgress = Math.min(1, calories.eaten / (calories.goal || 1));

    // Define raw percentages for labels (can exceed 100%)
    const proPct = macros.protein.eaten / (macros.protein.goal || 1);
    const carbPct = macros.carbs.eaten / (macros.carbs.goal || 1);
    const fatPct = macros.fats.eaten / (macros.fats.goal || 1);

    // Progress for rings (capped at 100%)
    const proProgress = Math.min(1, proPct);
    const carbProgress = Math.min(1, carbPct);
    const fatProgress = Math.min(1, fatPct);
    const waterProgress = Math.min(1, waterIntake / 8);

    const ringSize = 160;
    const center = ringSize / 2;
    const strokeWidth = 10;
    const r1 = 68; const r2 = 54; const r3 = 42; const r4 = 30; const r5 = 18;

    // Dots sit at the 12 o'clock position of each ring (top = center - radius)
    const ringDots: { radius: number; color: string; dotR: number }[] = [
        { radius: r1, color: '#06B6D4', dotR: 5 },
        { radius: r2, color: '#475569', dotR: 4 },
        { radius: r3, color: '#7A1E2C', dotR: 4 },
        { radius: r4, color: '#FACC15', dotR: 4 },
        { radius: r5, color: '#F59E0B', dotR: 3.5 },
    ];

    const dotScale = dotPulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.3] });
    const dotOpacity = dotPulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

    const renderRing = (radius: number, progress: number, color: string, glowColor: string, index: number) => {
        // To make sure the glowing dot follows the tip of the curved progress bar:
        // The G element is rotated -90 degrees, so 0 degrees is mathematically the top.
        // Progress goes from 0 to 1, representing 0 to 360 degrees (2 * PI radians).
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference - progress * circumference;
        const currentStroke = radius === r1 ? strokeWidth : (radius === r5 ? 8 : 6);
        const dotR = radius === r1 ? 5 : radius === r5 ? 3 : 4;

        // Calculate the angle in radians based on progress (0 to 2PI)
        const angle = progress * 2 * Math.PI;

        // Calculate X and Y on the circle. 
        // In the un-rotated SVG space, angle 0 is the right side (3 o'clock).
        // Since we rotate the whole G by -90, the right side becomes the top (12 o'clock).
        // So standard X=cos, Y=sin gives us the exact tip position of the arc.
        const dotX = center + radius * Math.cos(angle);
        const dotY = center + radius * Math.sin(angle);
        return (
            <G rotation="-90" origin={`${center}, ${center} `} key={index}>
                {/* Track ring */}
                <Circle cx={center} cy={center} r={radius} stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'} strokeWidth={currentStroke} fill="transparent" />
                {/* Glow layer when there's progress */}
                {progress > 0 && (
                    <Circle cx={center} cy={center} r={radius} stroke={glowColor} strokeWidth={currentStroke + 2} strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" fill="transparent" opacity={0.15} />
                )}
                {/* Main arc — back to round so the path looks smooth and curved */}
                <Circle cx={center} cy={center} r={radius} stroke={color} strokeWidth={currentStroke} strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" fill="transparent" />

                {/* Always-visible dot, which now moves along with the tip of the progress arc */}
                <Circle cx={dotX} cy={dotY} r={dotR} fill={color} />
                {/* Glow halo around the moving tip dot */}
                <Circle cx={dotX} cy={dotY} r={dotR + 2.5} fill={glowColor} opacity={0.4} />
            </G>
        );
    };

    const h = 360;
    const w = CARD_WIDTH;
    const tabW = 134;
    const dipY = 48;
    const slopeX = 35;
    const vGap = 8;
    const r = 24;

    const bodyPath = `
        M ${r}, 0
        L ${w - tabW - slopeX}, 0
        L ${w - tabW}, ${dipY}
        L ${w - r}, ${dipY}
        Q ${w}, ${dipY} ${w}, ${dipY + r}
        L ${w}, ${h - r}
        Q ${w}, ${h} ${w - r}, ${h}
        L ${r}, ${h}
        Q 0, ${h} 0, ${h - r}
        L 0, ${r}
        Q 0, 0 ${r}, 0
Z
    `;

    const tabClipPath = `
        M ${w - tabW - slopeX}, ${-vGap}
        L ${w - r}, ${-vGap}
        Q ${w}, ${-vGap} ${w}, ${r - vGap}
        L ${w}, ${dipY - vGap - 4}
        L ${w - tabW}, ${dipY - vGap - 4}
        L ${w - tabW - slopeX}, ${-vGap}
Z
    `;

    return (
        <View style={[styles.outerWrapper, { width: CARD_WIDTH }]}>
            <View style={StyleSheet.absoluteFill}>
                <Svg width={w} height={h} viewBox={`0 0 ${w} ${h} `} style={{ overflow: 'visible' }}>
                    <Defs>
                        <SvgGradient id="cardBg" x1="0" y1="0" x2="1" y2="1">
                            <Stop offset="0" stopColor={theme.backgroundCard} stopOpacity={1} />
                            <Stop offset="1" stopColor={theme.backgroundCard} stopOpacity={1} />
                        </SvgGradient>
                    </Defs>
                    <Path d={bodyPath} fill="url(#cardBg)" />
                    <G transform="translate(0, -2)">
                        <Path d={tabClipPath} fill={theme.backgroundCard} stroke={theme.border} strokeWidth="1" />
                    </G>
                </Svg>
            </View>

            <View style={styles.contentContainer}>
                <View style={[styles.headerRow, { height: dipY - vGap }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingRight: 20 }}>
                        <Text
                            style={[
                                styles.titleText,
                                {
                                    color: theme.textDark,
                                    opacity: 1,
                                },
                            ]}
                        >
                            Daily Pulse
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={styles.quickActionButton}
                        onPress={onQuickAction}
                        activeOpacity={0.7}
                    >
                        <MaterialCommunityIcons name="qrcode-scan" size={18} color="#F1C93B" />
                        <Text style={styles.quickActionText}>CHECK IN</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.body}>
                    <View style={styles.colLeft}>
                        <TouchableOpacity onPress={() => fireWithTarget(refBurned, getSmartNudge('kcal', calories.burned, 500, user?.gender || 'male'), 'workoutLogged')}>
                            <View ref={refBurned} collapsable={false}>
                                <Metric unit="kcal" icon="fire" color="#EF4444" label="Burned" value={calories.burned} theme={theme} isDark={isDark} />
                            </View>
                        </TouchableOpacity>
                        <View style={{ height: vGap * 2 }} />
                        <TouchableOpacity onPress={() => fireWithTarget(refEaten, getSmartNudge('kcal', calories.eaten, calories.goal, user?.gender || 'male'), 'mealLogged')}>
                            <View ref={refEaten} collapsable={false}>
                                <Metric unit="kcal" icon="silverware-fork-knife" color="#6366F1" label="Eaten" value={calories.eaten} theme={theme} isDark={isDark} />
                            </View>
                        </TouchableOpacity>
                        <View style={{ height: vGap * 2 }} />
                        <TouchableOpacity onPress={() => {
                            const targetWeight = 24.9 * ((height / 100) * (height / 100));
                            const text = getSmartNudge('bmi', bmi, 24.9, user?.gender || 'male', { weight, height, targetWeight, lastWeightLogDate });
                            const trigger = bmi > 24.9 ? 'threeMissedDays' : 'streakMilestone';
                            fireWithTarget(refBmi, text, trigger);
                        }}>
                            <View ref={refBmi} collapsable={false}>
                                <Metric unit="index" icon="scale-bathroom" color="#22C55E" label="BMI" value={bmi} theme={theme} isDark={isDark} />
                            </View>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.graphContainer}>
                        {isLoading ? (
                            // Loading state: animated dots at 12 o'clock of each ring
                            <View style={styles.graph}>
                                <Svg width={ringSize} height={ringSize}>
                                    {ringDots.map(({ radius, color }, i) => (
                                        <G key={i}>
                                            {/* Faint track ring */}
                                            <Circle
                                                cx={center} cy={center} r={radius}
                                                stroke={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}
                                                strokeWidth={radius === r1 ? strokeWidth : (radius === r5 ? 8 : 6)}
                                                fill="transparent"
                                            />
                                        </G>
                                    ))}
                                </Svg>
                                {/* Animated dots overlaid at 12 o'clock of each ring */}
                                {ringDots.map(({ radius, color, dotR }, i) => {
                                    // 12 o'clock position in ring coordinate space
                                    const offsetFromEdge = (ringSize / 2) - radius; // px from top of svg to center of ring
                                    const dotTop = offsetFromEdge - dotR; // top edge of dot
                                    const delay = i * 120;
                                    return (
                                        <Animated.View
                                            key={i}
                                            style={[
                                                styles.ringDot,
                                                {
                                                    width: dotR * 2,
                                                    height: dotR * 2,
                                                    borderRadius: dotR,
                                                    backgroundColor: color,
                                                    top: dotTop,
                                                    left: center - dotR,
                                                    opacity: dotOpacity,
                                                    transform: [{ scale: dotScale }],
                                                    shadowColor: color,
                                                    shadowOpacity: 0.8,
                                                    shadowRadius: 6,
                                                    elevation: 4,
                                                }
                                            ]}
                                        />
                                    );
                                })}
                                <View style={styles.absCenter}>
                                    <MaterialCommunityIcons name="pulse" size={32} color={theme.primary} opacity={0.15} />
                                </View>
                            </View>
                        ) : calories.goal > 0 ? (
                            <View style={styles.graph}>
                                <Svg width={ringSize} height={ringSize}>
                                    {renderRing(r5, fatProgress, '#F59E0B', '#F59E0B', 5)}
                                    {renderRing(r4, carbProgress, '#FACC15', '#FACC15', 4)}
                                    {renderRing(r3, proProgress, '#7A1E2C', '#7A1E2C', 3)}
                                    {renderRing(r2, kcalProgress, calories.eaten > calories.goal ? '#EF4444' : '#475569', calories.eaten > calories.goal ? '#EF4444' : '#475569', 2)}
                                    {renderRing(r1, waterProgress, '#06B6D4', '#06B6D4', 1)}
                                </Svg>
                                <View style={styles.absCenter}>
                                    <MaterialCommunityIcons name="pulse" size={32} color={theme.primary} opacity={0.3} />
                                </View>
                            </View>
                        ) : (
                            <TouchableOpacity style={styles.noGoalGraph} onPress={onGoalPress}>
                                <MaterialCommunityIcons name="target" size={48} color={theme.primary} />
                                <Text style={[styles.noGoalText, { color: theme.text }]}>SET GOALS</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={styles.kcalFooter}
                            onPress={() => fireWithTarget(refKcalFooter, getSmartNudge('kcal', calories.eaten, calories.goal, user?.gender || 'male'), 'mealLogged')}
                        >
                            <View ref={refKcalFooter} collapsable={false}>
                                <Text style={[
                                    styles.kVal,
                                    { color: calories.eaten > calories.goal ? '#EF4444' : theme.text }
                                ]}>
                                    {calories.eaten > calories.goal ? `+ ${calories.eaten - calories.goal} ` : kcalLeft}
                                </Text>
                                <Text style={[styles.kSub, { color: calories.eaten > calories.goal ? '#EF4444' : theme.textMuted, marginBottom: 2 }]}>
                                    {calories.eaten > calories.goal ? 'kcal over' : 'kcal left'}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.colRight}>
                        <TouchableOpacity onPress={() => fireWithTarget(refProtein, getSmartNudge('protein', macros.protein.eaten, macros.protein.goal, user?.gender || 'male'), 'mealLogged')}>
                            <View ref={refProtein} collapsable={false}>
                                <Macro
                                    lab="Protein"
                                    col="#7A1E2C"
                                    val={macros.protein.eaten}
                                    pct={proPct * 100}
                                    theme={theme}
                                    isCritical={proProgress < 0.7}
                                    isOver={proPct > 1.0}
                                />
                            </View>
                        </TouchableOpacity>
                        <View style={{ height: vGap * 2 }} />
                        <TouchableOpacity onPress={() => fireWithTarget(refCarbs, getSmartNudge('carbs', macros.carbs.eaten, macros.carbs.goal, user?.gender || 'male'), 'mealLogged')}>
                            <View ref={refCarbs} collapsable={false}>
                                <Macro
                                    lab="Carbs"
                                    col="#FACC15"
                                    val={macros.carbs.eaten}
                                    pct={carbPct * 100}
                                    theme={theme}
                                    isOver={carbPct > 1.0}
                                />
                            </View>
                        </TouchableOpacity>
                        <View style={{ height: vGap * 2 }} />
                        <TouchableOpacity onPress={() => fireWithTarget(refFat, getSmartNudge('fats', macros.fats.eaten, macros.fats.goal, user?.gender || 'male'), 'mealLogged')}>
                            <View ref={refFat} collapsable={false}>
                                <Macro
                                    lab="Fat"
                                    col="#F59E0B"
                                    val={macros.fats.eaten}
                                    pct={fatPct * 100}
                                    theme={theme}
                                    isOver={fatPct > 1.0}
                                />
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={[styles.footer, { borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', justifyContent: 'space-around' }]}>
                    <TouchableOpacity onPress={() => fireWithTarget(refSteps, 'Step count is synced from your health data. Keep moving!', 'stepsLogged')}>
                        <View ref={refSteps} collapsable={false}>
                            <FootStat icon="shoe-print" color="#64748B" lab="Steps" val={steps.toLocaleString()} theme={theme} />
                        </View>
                    </TouchableOpacity>
                    <View style={styles.sep} />
                    <TouchableOpacity onPress={() => fireWithTarget(refWater, getSmartNudge('water', waterIntake, 8, user?.gender || 'male'), 'hydrationLogged')}>
                        <View ref={refWater} collapsable={false}>
                            <FootStat icon="water" color="#06B6D4" lab="Water" val={`${waterIntake} / 8 cups`} theme={theme} />
                        </View>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

export const DailyPulseCard = React.memo(DailyPulseCardComponent);

const Metric = ({ label, value, unit, icon, color, theme, isDark }: any) => (
    <View>
        <View style={styles.mHead}>
            <Text style={[styles.mLab, { color: theme.textMuted }]}>{label}</Text>
            <View style={[styles.mIcon, { backgroundColor: isDark ? color + '30' : color + '15' }]}>
                <MaterialCommunityIcons name={icon} size={10} color={color} />
            </View>
        </View>
        <Text style={[styles.mVal, { color: theme.text }]}>{value.toLocaleString()}</Text>
        <Text style={[styles.mUnit, { color: theme.textMuted }]}>{unit}</Text>
    </View>
);

const Macro = ({ lab, col, val, pct, goal, unit = 'g', isWater, theme, isCritical, isOver }: any) => (
    <View style={{ alignItems: 'flex-end' }}>
        <View style={[styles.mHead, { flexDirection: 'row-reverse' }]}>
            <Text style={[styles.mLab, { color: theme.textMuted }]}>{lab}</Text>
            <View style={[styles.macDotSmall, { backgroundColor: col }]} />
            {isCritical && <MaterialCommunityIcons name="alert-circle" size={10} color="#EF4444" />}
        </View>
        <Text style={[styles.mVal, { color: theme.text, textAlign: 'right' }]}>
            {Math.round(val)}{isWater ? '' : unit}
        </Text>
        <Text style={[
            styles.mUnit,
            { color: isOver ? 'rgba(100, 116, 139, 1)' : (isCritical ? 'rgba(100, 116, 139, 1)' : theme.textMuted), textAlign: 'right' }
        ]}>
            {isWater ? `/${goal} cups` : `${Math.round(pct)}%`}
        </Text>
    </View>
);

const FootStat = ({ icon, color, lab, val, theme }: any) => (
    <View style={styles.fRow}>
        <View style={[styles.fIcon, { borderColor: color + '30', backgroundColor: color + '05' }]}>
            <MaterialCommunityIcons name={icon} size={14} color={color} />
        </View>
        <View>
            <Text style={[styles.fLab, { color: theme.textMuted }]}>{lab}</Text>
            <Text style={[styles.fVal, { color: theme.text }]}>{val}</Text>
        </View>
    </View>
);

const styles = StyleSheet.create({
    outerWrapper: { height: 360, alignSelf: 'center', marginBottom: 20, marginTop: 4 },
    contentContainer: { flex: 1, padding: 22, paddingTop: 10 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
    titleText: {
        fontSize: 24,
        fontWeight: '900',
        letterSpacing: -1,
        lineHeight: 59,
        marginLeft: -1,
        paddingLeft: 0,
        paddingRight: 0,
        borderRadius: 0,
    },
    quickActionButton: {
        width: 94,
        height: 30,
        backgroundColor: '#2A4B2A', // Brand Primary
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: -41,
        marginLeft: -9,
        marginRight: -3,
        paddingHorizontal: 0,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: '#F1C93B', // Brand Accent
        shadowColor: '#F1C93B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 4,
        elevation: 5,
    },
    quickActionText: {
        color: '#F1C93B', // Brand Accent
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    body: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    colLeft: { flex: 1, alignItems: 'flex-start' },
    colRight: { flex: 1, alignItems: 'flex-end' },
    graphContainer: { width: 160, alignItems: 'center', justifyContent: 'center' },
    graph: { width: 160, height: 160, justifyContent: 'center', alignItems: 'center' },
    absCenter: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center'
    },
    kcalFooter: { marginTop: 16, alignItems: 'center' },
    kVal: { fontSize: 28, fontWeight: '900', lineHeight: 32 },
    kSub: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
    mHead: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
    mLab: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
    mIcon: { width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
    mVal: { fontSize: 20, fontWeight: '900' },
    mUnit: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
    macDotSmall: { width: 6, height: 6, borderRadius: 3 },
    footer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingTop: 20, borderTopWidth: 1, marginTop: 12 },
    fRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    fIcon: { width: 32, height: 32, borderRadius: 10, borderWidth: 1.2, justifyContent: 'center', alignItems: 'center' },
    fLab: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    fVal: { fontSize: 14, fontWeight: '900' },
    sep: { width: 1, height: 18, backgroundColor: 'rgba(0,0,0,0.1)', opacity: 0.1 },
    noGoalGraph: {
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: 'rgba(42, 75, 42, 0.05)',
        borderWidth: 2,
        borderColor: 'rgba(42, 75, 42, 0.2)',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    noGoalText: {
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1,
    },
    // Ring loading dot
    ringDot: { position: 'absolute' },
    // Skeletons
    skeletonTitle: { width: 140, height: 28, borderRadius: 8, marginBottom: 30 },
    skeletonMetric: { width: 60, height: 40, borderRadius: 6 },
    skeletonGraph: { width: 160, height: 160, borderRadius: 80, borderWidth: 4 },
    skeletonMacro: { width: 70, height: 12, borderRadius: 4 },
    skeletonFooter: { width: 100, height: 30, borderRadius: 10 },
    hintContainer: {
        position: 'absolute',
        bottom: 80,
        left: 14,
        right: 14,
        borderRadius: 18,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderWidth: 1.5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 8,
    },
    hintText: {
        fontSize: 14,
        fontWeight: '700',
        flex: 1,
        lineHeight: 20,
    }
});
