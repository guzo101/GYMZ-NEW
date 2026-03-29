import React, { useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, PanResponder, Animated, Image, Dimensions, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

/** Zoom limits: min 1 (frame-filled), max 3.5 for controlled zoom */
const MIN_SCALE = 1;
const MAX_SCALE = 3.5;
/** Lower = slower zoom (0.2 = 20% of pinch distance affects scale) */
const ZOOM_SENSITIVITY = 0.2;
/** Hold duration (ms) before single-finger drag is enabled */
const HOLD_TO_DRAG_MS = 400;
/** Move threshold (px) - if user moves more than this before hold completes, cancel (allow scroll) */
const HOLD_CANCEL_MOVE_PX = 6;

interface BodyMetrics {
    weight?: number;
    bodyFat?: number;
    muscleMass?: number;
}

interface ComparisonSliderProps {
    beforeImage: string;
    afterImage: string;
    beforeDate: string;
    afterDate: string;
    beforeMetrics?: BodyMetrics;
    afterMetrics?: BodyMetrics;
    height?: number;
    onEditBefore?: () => void;
    onEditAfter?: () => void;
    /** When true, single-finger drag is enabled (hold not needed). When false, scroll works. */
    dragMode?: boolean;
}

export interface ComparisonSliderRef {
    resetZoomAndPosition: () => void;
}

export const ComparisonSlider = forwardRef<ComparisonSliderRef | null, ComparisonSliderProps>(({
    beforeImage,
    afterImage,
    beforeDate,
    afterDate,
    beforeMetrics,
    afterMetrics,
    height = 240,
    onEditBefore,
    onEditAfter,
    dragMode = false,
}, ref) => {
    const dragModeRef = React.useRef(dragMode);
    dragModeRef.current = dragMode;
    const { theme, isDark } = useTheme();
    const [sliderPos] = useState(new Animated.Value(width / 2));
    const containerWidth = width - 32;

    // --- Before Image Zoom & Pan State ---
    const beforePan = React.useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
    const beforeScale = React.useRef(new Animated.Value(1)).current;
    const beforeDragAnim = React.useRef(new Animated.Value(0)).current;
    const _beforeLastOffset = React.useRef({ x: 0, y: 0 });
    const _beforeLastScale = React.useRef(1);
    const _beforeInitDist = React.useRef<number | null>(null);
    const _beforeLastPanValue = React.useRef({ x: 0, y: 0 });

    // --- After Image Zoom & Pan State ---
    const afterPan = React.useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
    const afterScale = React.useRef(new Animated.Value(1)).current;
    const afterDragAnim = React.useRef(new Animated.Value(0)).current;
    const _afterLastOffset = React.useRef({ x: 0, y: 0 });
    const _afterLastScale = React.useRef(1);
    const _afterInitDist = React.useRef<number | null>(null);
    const _afterLastPanValue = React.useRef({ x: 0, y: 0 });

    React.useEffect(() => {
        const idBPan = beforePan.addListener(val => { _beforeLastOffset.current = val; });
        const idBScale = beforeScale.addListener(val => { _beforeLastScale.current = val.value; });
        const idAPan = afterPan.addListener(val => { _afterLastOffset.current = val; });
        const idAScale = afterScale.addListener(val => { _afterLastScale.current = val.value; });
        return () => {
            beforePan.removeListener(idBPan);
            beforeScale.removeListener(idBScale);
            afterPan.removeListener(idAPan);
            afterScale.removeListener(idAScale);
        };
    }, []);

    /** Compute max pan bounds so the image always fills the frame (minimum coverage rule) */
    const getMaxPan = (s: number) => ({
        x: Math.max(0, (containerWidth * s - containerWidth) / 2),
        y: Math.max(0, (height * s - height) / 2),
    });

    const createPanResponder = (
        pan: Animated.ValueXY,
        scale: Animated.Value,
        dragAnim: Animated.Value,
        lastOffset: React.MutableRefObject<{ x: number, y: number }>,
        lastScale: React.MutableRefObject<number>,
        initDist: React.MutableRefObject<number | null>,
        lastPanValue: React.MutableRefObject<{ x: number, y: number }>,
        dmRef: React.MutableRefObject<boolean>
    ) => {
        let longPressTimer: ReturnType<typeof setTimeout> | null = null;
        let isDraggingEnabled = false;

        return PanResponder.create({
            onStartShouldSetPanResponder: () => dmRef.current,
            onMoveShouldSetPanResponder: (evt, gestureState) => {
                if (evt.nativeEvent.touches.length > 1) return true;
                return isDraggingEnabled && (Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2);
            },
            onPanResponderTerminationRequest: () => true,
            onPanResponderGrant: (evt) => {
                pan.setOffset({ x: lastOffset.current.x, y: lastOffset.current.y });
                pan.setValue({ x: 0, y: 0 });
                lastPanValue.current = { x: 0, y: 0 };
                initDist.current = null;
                isDraggingEnabled = dmRef.current;

                if (evt.nativeEvent.touches.length === 1 && !dmRef.current) {
                    longPressTimer = setTimeout(() => {
                        isDraggingEnabled = true;
                        longPressTimer = null;
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        Animated.spring(dragAnim, {
                            toValue: 1,
                            tension: 300,
                            friction: 20,
                            useNativeDriver: false
                        }).start();
                    }, HOLD_TO_DRAG_MS);
                } else if (evt.nativeEvent.touches.length >= 2 || dmRef.current) {
                    isDraggingEnabled = true;
                    if (evt.nativeEvent.touches.length === 1) {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        Animated.spring(dragAnim, { toValue: 1, tension: 300, friction: 20, useNativeDriver: false }).start();
                    }
                }
            },
            onPanResponderMove: (evt, gestureState) => {
                const touches = evt.nativeEvent.touches;

                if (!isDraggingEnabled && touches.length === 1 && (Math.abs(gestureState.dx) > HOLD_CANCEL_MOVE_PX || Math.abs(gestureState.dy) > HOLD_CANCEL_MOVE_PX)) {
                    if (longPressTimer) {
                        clearTimeout(longPressTimer);
                        longPressTimer = null;
                    }
                }

                if (touches.length >= 2) {
                    const dx = touches[0].pageX - touches[1].pageX;
                    const dy = touches[0].pageY - touches[1].pageY;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (initDist.current === null) {
                        initDist.current = distance;
                    } else {
                        const ratio = distance / initDist.current;
                        const adjustedRatio = 1 + (ratio - 1) * ZOOM_SENSITIVITY;
                        const rawScale = lastScale.current * adjustedRatio;
                        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, rawScale));
                        scale.setValue(newScale);

                        const { x: maxPanX, y: maxPanY } = getMaxPan(newScale);
                        const totalX = lastOffset.current.x;
                        const totalY = lastOffset.current.y;
                        const clampedX = Math.max(-maxPanX, Math.min(maxPanX, totalX));
                        const clampedY = Math.max(-maxPanY, Math.min(maxPanY, totalY));

                        const newValX = clampedX - lastOffset.current.x + lastPanValue.current.x;
                        const newValY = clampedY - lastOffset.current.y + lastPanValue.current.y;
                        lastPanValue.current = { x: newValX, y: newValY };
                        pan.setValue({ x: newValX, y: newValY });
                    }
                } else if (touches.length === 1 && initDist.current === null && isDraggingEnabled) {
                    const currentScale = lastScale.current;
                    const { x: maxPanX, y: maxPanY } = getMaxPan(currentScale);

                    const absX = lastOffset.current.x + gestureState.dx;
                    const absY = lastOffset.current.y + gestureState.dy;

                    const proposedX = Math.max(-maxPanX, Math.min(maxPanX, absX)) - lastOffset.current.x;
                    const proposedY = Math.max(-maxPanY, Math.min(maxPanY, absY)) - lastOffset.current.y;

                    lastPanValue.current = { x: proposedX, y: proposedY };
                    pan.setValue({ x: proposedX, y: proposedY });
                }
            },
            onPanResponderRelease: () => {
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
                isDraggingEnabled = false;
                pan.flattenOffset();
                initDist.current = null;

                Animated.spring(dragAnim, {
                    toValue: 0,
                    tension: 300,
                    friction: 20,
                    useNativeDriver: false
                }).start();

                setTimeout(() => {
                    const currentScale = lastScale.current;
                    const { x: maxPanX, y: maxPanY } = getMaxPan(currentScale);

                    let targetX = lastOffset.current.x;
                    let targetY = lastOffset.current.y;

                    targetX = Math.max(-maxPanX, Math.min(maxPanX, targetX));
                    targetY = Math.max(-maxPanY, Math.min(maxPanY, targetY));

                    if (targetX !== lastOffset.current.x || targetY !== lastOffset.current.y) {
                        Animated.spring(pan, {
                            toValue: { x: targetX, y: targetY },
                            tension: 200,
                            friction: 25,
                            useNativeDriver: false
                        }).start();
                    }
                }, 0);
            },
            onPanResponderTerminate: () => {
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
                isDraggingEnabled = false;
                pan.flattenOffset();
                initDist.current = null;

                Animated.spring(dragAnim, {
                    toValue: 0,
                    tension: 300,
                    friction: 20,
                    useNativeDriver: false
                }).start();
            }
        });
    };

    const beforePanResponder = React.useRef(createPanResponder(beforePan, beforeScale, beforeDragAnim, _beforeLastOffset, _beforeLastScale, _beforeInitDist, _beforeLastPanValue, dragModeRef)).current;
    const afterPanResponder = React.useRef(createPanResponder(afterPan, afterScale, afterDragAnim, _afterLastOffset, _afterLastScale, _afterInitDist, _afterLastPanValue, dragModeRef)).current;

    const resetZoomAndPosition = React.useCallback(() => {
        _beforeLastOffset.current = { x: 0, y: 0 };
        _beforeLastScale.current = 1;
        _beforeLastPanValue.current = { x: 0, y: 0 };
        _afterLastOffset.current = { x: 0, y: 0 };
        _afterLastScale.current = 1;
        _afterLastPanValue.current = { x: 0, y: 0 };

        beforePan.flattenOffset();
        beforePan.setValue({ x: 0, y: 0 });
        beforePan.setOffset({ x: 0, y: 0 });
        beforeScale.setValue(1);

        afterPan.flattenOffset();
        afterPan.setValue({ x: 0, y: 0 });
        afterPan.setOffset({ x: 0, y: 0 });
        afterScale.setValue(1);

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, [beforePan, beforeScale, afterPan, afterScale]);

    useImperativeHandle(ref, () => ({ resetZoomAndPosition }), [resetZoomAndPosition]);

    const panResponder = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderMove: (_, gestureState) => {
            let newX = gestureState.moveX - 16;
            if (newX < 0) newX = 0;
            if (newX > containerWidth) newX = containerWidth;
            sliderPos.setValue(newX);
        },
    });

    const weightDiff = useMemo(() => {
        if (beforeMetrics?.weight && afterMetrics?.weight) {
            const diff = afterMetrics.weight - beforeMetrics.weight;
            return diff.toFixed(1);
        }
        return null;
    }, [beforeMetrics, afterMetrics]);

    const GlassBadge = ({ date, metrics, side, onEdit }: { date: string; metrics?: BodyMetrics; side: 'left' | 'right'; onEdit?: () => void }) => (
        <BlurView intensity={isDark ? 40 : 60} style={[styles.glassBadge, side === 'right' && { alignItems: 'flex-end' }]}>
            <View style={styles.badgeHeader}>
                <Text style={styles.dateLabel}>{date}</Text>
                {onEdit && (
                    <TouchableOpacity onPress={onEdit} style={styles.editIcon}>
                        <MaterialCommunityIcons name="pencil" size={10} color="#FFF" style={{ opacity: 0.7 }} />
                    </TouchableOpacity>
                )}
            </View>

            {metrics?.weight ? (
                <View style={[styles.primaryMetric, side === 'right' && { flexDirection: 'row-reverse' }]}>
                    <Text style={styles.heroWeight}>{metrics.weight}</Text>
                    <Text style={styles.heroUnit}>kg</Text>
                </View>
            ) : (
                <Text style={styles.noDataText}>No weight recorded</Text>
            )}

            {metrics?.bodyFat && (
                <View style={[styles.subMetric, side === 'right' && { flexDirection: 'row-reverse' }]}>
                    <MaterialCommunityIcons name="percent" size={10} color={theme.primary} />
                    <Text style={styles.subMetricValue}>{metrics.bodyFat}% <Text style={styles.subMetricLabel}>BF</Text></Text>
                </View>
            )}
        </BlurView>
    );

    return (
        <View style={[styles.container, { height, borderColor: theme.border, shadowColor: theme.primary }]}>
            {/* After Image Container (Background) - catches right half events */}
            <Animated.View style={StyleSheet.absoluteFill} {...afterPanResponder.panHandlers}>
                <Animated.Image
                    source={{ uri: afterImage }}
                    style={[
                        styles.image,
                        { width: containerWidth, height },
                        {
                            transform: [
                                { translateX: afterPan.x },
                                { translateY: afterPan.y },
                                { scale: afterScale },
                                { scale: afterDragAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) }
                            ]
                        }
                    ]}
                    resizeMode="cover"
                />
                <Animated.View style={[
                    StyleSheet.absoluteFill,
                    {
                        borderWidth: afterDragAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 3] }),
                        borderColor: theme.primary,
                        shadowColor: theme.primary,
                        shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: afterDragAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6] }),
                        shadowRadius: 20,
                    }
                ]} pointerEvents="none" />
            </Animated.View>

            {/* After Metrics Overlay */}
            <View pointerEvents="box-none" style={[styles.overlayContainer, { alignItems: 'flex-end', paddingBottom: 24, zIndex: 10 }]}>
                <GlassBadge date={afterDate} metrics={afterMetrics} side="right" onEdit={onEditAfter} />
            </View>

            {/* Before Image Container (Foreground) - catches left half events */}
            <Animated.View
                style={[
                    styles.beforeImageContainer,
                    { width: sliderPos, height, overflow: 'hidden', zIndex: 5 }
                ]}
                {...beforePanResponder.panHandlers}
            >
                <Animated.Image
                    source={{ uri: beforeImage }}
                    style={[
                        styles.image,
                        { width: containerWidth, height },
                        {
                            transform: [
                                { translateX: beforePan.x },
                                { translateY: beforePan.y },
                                { scale: beforeScale },
                                { scale: beforeDragAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) }
                            ]
                        }
                    ]}
                    resizeMode="cover"
                />

                <Animated.View style={[
                    styles.image,
                    {
                        width: containerWidth, height,
                        borderWidth: beforeDragAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 3] }),
                        borderColor: theme.primary,
                        shadowColor: theme.primary,
                        shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: beforeDragAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6] }),
                        shadowRadius: 20,
                    }
                ]} pointerEvents="none" />

                {/* Before Metrics Overlay */}
                <View pointerEvents="box-none" style={[styles.overlayContainer, { alignItems: 'flex-start', paddingBottom: 24, width: containerWidth }]}>
                    <GlassBadge date={beforeDate} metrics={beforeMetrics} side="left" onEdit={onEditBefore} />
                </View>
            </Animated.View>

            {/* Central Delta Comparison Badge */}
            {weightDiff && (
                <View style={styles.deltaContainer}>
                    <LinearGradient
                        colors={[theme.primary, theme.primary + 'CC']}
                        style={styles.deltaBadge}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <Text style={styles.deltaLabel}>TOTAL CHANGE</Text>
                        <Text style={styles.deltaValue}>{parseFloat(weightDiff) > 0 ? '+' : ''}{weightDiff} kg</Text>
                    </LinearGradient>
                </View>
            )}

            {/* Slider Handle */}
            <Animated.View
                {...panResponder.panHandlers}
                style={[
                    styles.handle,
                    { left: Animated.subtract(sliderPos, 1) }
                ]}
            >
                <View style={[styles.line, { backgroundColor: theme.primary }]} />
                <View style={[styles.circle, { backgroundColor: theme.primary }]}>
                    <MaterialCommunityIcons name="unfold-more-vertical" size={20} color="#FFF" style={{ transform: [{ rotate: '90deg' }] }} />
                </View>
                <View style={[styles.line, { backgroundColor: theme.primary }]} />
            </Animated.View>

            {/* Gymz Watermark Logo */}
            <View style={styles.watermarkContainer}>
                <Image
                    source={require('../../assets/gymzLogo.png')}
                    style={styles.watermarkLogo}
                    resizeMode="contain"
                />
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        width: '100%',
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1.5,
        elevation: 10,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
    },
    image: {
        position: 'absolute',
    },
    beforeImageContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        borderRightWidth: 1,
        borderRightColor: 'rgba(255,255,255,0.3)',
    },
    overlayContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        padding: 16,
    },
    glassBadge: {
        padding: 10,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        width: 120,
    },
    badgeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
        width: '100%',
    },
    editIcon: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dateLabel: {
        color: '#FFF',
        fontSize: 8,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        opacity: 0.8,
    },
    primaryMetric: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 2,
    },
    heroWeight: {
        color: '#FFF',
        fontSize: 22,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    heroUnit: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '700',
        opacity: 0.7,
    },
    noDataText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '600',
        opacity: 0.5,
    },
    subMetric: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    subMetricValue: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '800',
    },
    subMetricLabel: {
        fontSize: 8,
        opacity: 0.6,
        fontWeight: '600',
    },
    deltaContainer: {
        position: 'absolute',
        top: 16,
        alignSelf: 'center',
        zIndex: 20,
    },
    deltaBadge: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    deltaLabel: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 8,
        fontWeight: '900',
        letterSpacing: 1,
    },
    deltaValue: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '900',
    },
    handle: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 2,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 30,
    },
    line: {
        width: 2,
        flex: 1,
        opacity: 0.8,
    },
    circle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.8)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
    },
    watermarkContainer: {
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 25,
        opacity: 0.4,
    },
    watermarkLogo: {
        width: 24,
        height: 24,
    },
});
