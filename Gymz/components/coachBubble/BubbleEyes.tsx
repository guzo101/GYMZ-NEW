import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import type { EyeExpression, EyelidState } from './constants';
import { TIMING } from './constants';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

interface ScreenAwareIdle {
  bubbleCenterX: number;
  bubbleCenterY: number;
  screenWidth: number;
  screenHeight: number;
}

interface BubbleEyesProps {
  expression: EyeExpression;
  eyelidState: EyelidState;
  blinkTrigger: number;
  gender: 'male' | 'female';
  size: number;
  /** Bubble body color — eyelids are drawn in this color (opaque) */
  bodyColor: string;
  /** Cute female variant: slightly larger eyes, more blush */
  cuteVariant?: boolean;
  lookToward?: { dx: number; dy: number } | null;
  screenAwareIdle?: ScreenAwareIdle | null;
  inConversation?: boolean;
  longPressActive?: boolean;
  isAttentive?: boolean;
  /**
   * Drama: force pupils to look at a named target.
   * Overrides lookToward and idle drift when set.
   */
  lookAtNamedTarget?: 'user' | 'otherBubble' | 'logo' | 'center' | 'away' | 'left' | 'right' | 'down' | null;
  /** Drama: peek mode — one eye peeks while the other is nearly closed */
  peeking?: boolean;
}

// ─────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────

const BLINK_HALF       = TIMING.BLINK_DURATION_MS / 2;
const MAX_LOOK         = 3.6;
const PUPIL_EASING_MS  = 260;
const IDLE_DRIFT_MS    = 3200;
const SCREEN_LOOK_S    = 3.0;
const SCREEN_SIDE_S    = 2.2;
const BROW_EASING_MS   = 220;
const SHAPE_EASING_MS  = 280;

// ─────────────────────────────────────────────────────────────────
// Iris palette
// ─────────────────────────────────────────────────────────────────

const IRIS = {
  male: {
    base:   '#1e7ca8',
    mid:    '#155f82',
    deep:   '#0d3d54',
    limbal: '#0a2a38',
    pupil:  '#0e1a20',
  },
  female: {
    base:   '#8b5e2a',
    mid:    '#6b4520',
    deep:   '#45280d',
    limbal: '#2a1608',
    pupil:  '#0a0502',
  },
};

// ─────────────────────────────────────────────────────────────────
// Eye shape per expression
// scaleX: how wide the eye stretches (1 = normal, >1 = wider, <1 = narrower)
// lidClose: 0 = fully open, 1 = fully closed (top lid slides down)
// aspect: eyeH multiplier (1 = normal, <1 = squished flat, >1 = rounder/taller)
// ─────────────────────────────────────────────────────────────────

interface EyeShape {
  lidL: number;   // 0–1, left lid closedness
  lidR: number;   // 0–1, right lid closedness
  scaleX: number; // horizontal stretch
  aspect: number; // height multiplier
}

function getEyeShape(expression: EyeExpression, eyelidState: EyelidState, gender: 'male' | 'female'): EyeShape {
  const f = gender === 'female';
  switch (expression) {
    // ── Fully open / alert ───────────────────────────────────────
    case 'wide':
      return { lidL: 0.02, lidR: 0.02, scaleX: 1.06, aspect: 1.12 };  // eyes slightly taller + wider

    // ── Neutral / default ────────────────────────────────────────
    case 'idle':
    case 'lookLeft':
    case 'lookRight':
    case 'lookUp':
    case 'lookDown':
    case 'blink':
      return { lidL: 0.58, lidR: 0.58, scaleX: 1.0, aspect: 1.0 }; // Lazy / half-closed neutral state

    // ── Happy — crescent "^-^" ───────────────────────────────────
    case 'happy':
    case 'celebration':
      return { lidL: 0.76, lidR: 0.76, scaleX: 1.04, aspect: 0.70 }; // Reduced stretch, more biological

    // ── Suspicious / narrow — heavy-lidded squint ────────────────
    case 'suspicious':
    case 'narrow':
      return { lidL: f ? 0.46 : 0.50, lidR: f ? 0.46 : 0.50, scaleX: 1.0, aspect: 1.0 };

    // ── Sleepy — heavy lids, no stretch ──────────────────────────
    case 'sleepy':
      return { lidL: 0.82, lidR: 0.82, scaleX: 1.0, aspect: 1.0 }; // Enhanced dozing state

    // ── Amused / playful — one eye more closed ───────────────────
    case 'amused':
    case 'eyeRoll':
      return { lidL: 0.12, lidR: f ? 0.35 : 0.40, scaleX: 1.02, aspect: 0.96 };

    // ── Curious tilt — right eye slightly more open ──────────────
    case 'curiousTilt':
      return { lidL: 0.10, lidR: 0.02, scaleX: 1.04, aspect: 1.06 };

    // ── Proud — confident heavy upper lid ────────────────────────
    case 'proud':
      return { lidL: 0.18, lidR: 0.08, scaleX: 1.0, aspect: 0.94 };

    case 'starEyes':
    case 'heartEyes':
      return { lidL: 0.02, lidR: 0.02, scaleX: 1.10, aspect: 1.15 }; // Extra wide and round

    // ── Encouraging / warm ───────────────────────────────────────
    default:
      return { lidL: 0.08, lidR: 0.08, scaleX: 1.0, aspect: 1.0 };
  }
}

// ─────────────────────────────────────────────────────────────────
// Brow targets per expression
// ─────────────────────────────────────────────────────────────────

interface BrowTarget {
  leftY: number;
  rightY: number;
  leftRot: number;
  rightRot: number;
}

function getBrowTarget(expression: EyeExpression): BrowTarget {
  switch (expression) {
    case 'wide':
      return { leftY: -2.8, rightY: -2.8, leftRot: 0,  rightRot: 0 };
    case 'suspicious':
    case 'narrow':
      return { leftY:  1.8, rightY:  1.8, leftRot: 9,  rightRot: -9 };
    case 'happy':
    case 'celebration':
      return { leftY: -1.8, rightY: -1.8, leftRot: -5, rightRot: 5 };
    case 'curiousTilt':
      return { leftY:  0,   rightY: -3.8, leftRot: 4,  rightRot: -9 };
    case 'amused':
    case 'eyeRoll':
      return { leftY: -1.2, rightY:  0.6, leftRot: -6, rightRot: 3 };
    case 'proud':
      return { leftY: -1.8, rightY: -2.8, leftRot: -3, rightRot: -2 };
    case 'sleepy':
      return { leftY:  2.2, rightY:  2.2, leftRot: 7,  rightRot: -7 };
    case 'starEyes':
    case 'heartEyes':
      return { leftY: -3.5, rightY: -3.5, leftRot: -8, rightRot: 8 };
    case 'lookUp':
      return { leftY: -2.0, rightY: -2.0, leftRot: 0,  rightRot: 0 };
    default:
      return { leftY:  0,   rightY: 0,    leftRot: 0,  rightRot: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────
// Screen-aware idle gaze
// ─────────────────────────────────────────────────────────────────

function towardScreenCenter(
  screen: ScreenAwareIdle,
  dX: number,
  dY: number,
): { x: number; y: number } {
  const cx = screen.screenWidth / 2;
  const cy = screen.screenHeight / 2;
  let dx = cx - screen.bubbleCenterX;
  let dy = cy - screen.bubbleCenterY;
  const len = Math.hypot(dx, dy) || 1;
  dx = (dx / len) * SCREEN_LOOK_S + dX;
  dy = (dy / len) * SCREEN_LOOK_S + dY;
  const clamp = 2.4;
  return { x: Math.max(-clamp, Math.min(clamp, dx)), y: Math.max(-clamp, Math.min(clamp, dy)) };
}

// ─────────────────────────────────────────────────────────────────
// SingleEye — 8-layer anatomy
// ─────────────────────────────────────────────────────────────────

/** Darken hex color by a factor 0–1 (e.g. 0.88 = 88% brightness). Non-hex returned as-is. */
function darkenHex(hex: string, factor: number): string {
  if (!hex.startsWith('#')) return hex;
  const n = parseInt(hex.slice(1), 16);
  if (Number.isNaN(n)) return hex;
  const r = Math.round(((n >> 16) & 0xff) * factor);
  const g = Math.round(((n >> 8) & 0xff) * factor);
  const b = Math.round((n & 0xff) * factor);
  return '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('');
}

interface SingleEyeProps {
  eyeW: number;
  eyeH: number;
  pupilSize: number;
  irisSize: number;
  limbalSize: number;
  pupilX: Animated.AnimatedValue;
  pupilY: Animated.AnimatedValue;
  pupilScale: Animated.AnimatedValue;
  blinkAnim: Animated.AnimatedValue;
  scaleXAnim: Animated.AnimatedValue;
  lidClose: number;       // 0 = open, 1 = fully closed
  iris: typeof IRIS.male;
  bodyColor: string;      // opaque eyelid color (bubble body)
  showLashes?: boolean;   // female only: upper eyelashes
  side: 'left' | 'right';
  expression: EyeExpression;
}

const SingleEye: React.FC<SingleEyeProps> = ({
  eyeW, eyeH, pupilSize, irisSize, limbalSize,
  pupilX, pupilY, pupilScale,
  blinkAnim, scaleXAnim, lidClose,
  iris,
  bodyColor,
  showLashes = false,
  side,
  expression,
}) => {
  // lidOpen: 1 = fully open, 0 = fully closed
  const lidOpen = 1 - lidClose;
  const eyeScaleY = Animated.multiply(blinkAnim, Math.max(0.02, lidOpen));
  // Pin bottom of eye in place as lid closes from top
  const translateY = Animated.multiply(Animated.add(eyeScaleY, -1), -(eyeH / 2));

  const irisOff   = (eyeW - irisSize) / 2;
  const limbalOff = (eyeW - limbalSize) / 2;
  const pupilOff  = (irisSize - pupilSize) / 2;

  const glossW  = eyeW * 0.72;
  const glossH  = eyeH * 0.22;
  const catchW  = Math.max(3,   pupilSize * 0.48); // Slightly larger
  const catchH  = Math.max(2,   pupilSize * 0.32); // Slightly larger
  const catch2  = Math.max(1.8, pupilSize * 0.26); // Slightly larger

  return (
    <Animated.View style={{ width: eyeW, height: eyeH, transform: [{ scaleX: scaleXAnim }] }}>
      <Animated.View
        style={{
          width: eyeW,
          height: eyeH,
          borderRadius: eyeW / 2,
          overflow: 'hidden',
          transform: [{ translateY }, { scaleY: eyeScaleY }],
        }}
      >
        {/* 1 · Sclera */}
        <LinearGradient
          colors={['#f7f9fc', '#e8ecf4']}
          start={{ x: 0.28, y: 0.0 }}
          end={{ x: 0.72, y: 1.0 }}
          style={[StyleSheet.absoluteFill, { borderRadius: eyeW / 2 }]}
        />

        {/* 2 · Limbal ring */}
        <View style={{
          position: 'absolute',
          width: limbalSize, height: limbalSize,
          borderRadius: limbalSize / 2,
          backgroundColor: iris.limbal,
          left: limbalOff, top: (eyeH - limbalSize) / 2,
        }} />

        {/* 3 · Iris + radial strands */}
        <LinearGradient
          colors={[iris.base, iris.mid, iris.deep]}
          start={{ x: 0.28, y: 0.0 }}
          end={{ x: 0.72, y: 1.0 }}
          style={{
            position: 'absolute',
            width: irisSize, height: irisSize,
            borderRadius: irisSize / 2,
            left: irisOff, top: (eyeH - irisSize) / 2,
            overflow: 'hidden',
          }}
        >
          {[0.11, 0.36, 0.61, 0.81].map((pos, i) => (
            <View key={i} style={{
              position: 'absolute',
              width: 1.1, height: irisSize / 2,
              backgroundColor: 'rgba(255,255,255,0.12)',
              left: irisSize * pos, top: 0,
              borderRadius: 1,
              transform: [{ rotate: `${i * 40 + 8}deg` }, { translateY: irisSize / 4 }],
            }} />
          ))}
          <LinearGradient
            colors={['transparent', iris.deep + 'bb']}
            start={{ x: 0.5, y: 0.28 }}
            end={{ x: 0.5, y: 1.0 }}
            style={[StyleSheet.absoluteFill, { borderRadius: irisSize / 2 }]}
          />
        </LinearGradient>

        {/* 4+5 · Pupil + catchlights (moves with pupil) */}
        <Animated.View style={{
          position: 'absolute',
          width: irisSize, height: irisSize,
          left: irisOff, top: (eyeH - irisSize) / 2,
          alignItems: 'center', justifyContent: 'center',
          transform: [{ translateX: pupilX }, { translateY: pupilY }],
        }}>
          {expression === 'starEyes' ? (
            <Svg width={irisSize * 1.3} height={irisSize * 1.3} viewBox="0 0 24 24">
              <Path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                fill="#FFD700"
              />
            </Svg>
          ) : (
            <>
              <Animated.View style={{
                width: pupilSize, height: pupilSize,
                borderRadius: pupilSize / 2,
                backgroundColor: iris.pupil,
                transform: [{ scale: pupilScale }],
              }} />
              {/* Main catchlight — upper-left */}
              <View style={{
                position: 'absolute',
                width: catchW, height: catchH,
                borderRadius: catchH / 2,
                backgroundColor: '#ffffff',
                top: pupilOff * 0.88, left: pupilOff * 0.88,
              }} />
              {/* Micro catchlight — lower-right */}
              <View style={{
                position: 'absolute',
                width: catch2, height: catch2,
                borderRadius: catch2 / 2,
                backgroundColor: '#ffffff',
                bottom: pupilOff * 0.88, right: pupilOff * 0.88,
              }} />
            </>
          )}
        </Animated.View>

        {/* 6 · Corneal gloss — wide wet arc */}
        <View style={{
          position: 'absolute',
          width: glossW, height: glossH,
          borderRadius: glossH,
          backgroundColor: 'rgba(255,255,255,0.28)',
          top: eyeH * 0.06,
          left: (eyeW - glossW) / 2,
        }} />

        {/* 7 · Upper eyelid — opaque, same color as bubble body */}
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: eyeH * 0.28,
          backgroundColor: bodyColor,
          borderTopLeftRadius: eyeW / 2,
          borderTopRightRadius: eyeW / 2,
        }} />
        {/* 8 · Lid crease — slightly darker body color so the fold is visible */}
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: Math.max(1.5, eyeH * 0.08),
          backgroundColor: darkenHex(bodyColor, 0.88),
          borderTopLeftRadius: eyeW / 2,
          borderTopRightRadius: eyeW / 2,
        }} />

        {/* 8b · Female: bold black upper lash line (cartoon outline) */}
        {showLashes && (
          <View style={{
            position: 'absolute',
            left: 0, right: 0,
            top: eyeH * 0.26,
            height: Math.max(2, eyeW * 0.08),
            backgroundColor: '#0d0d0d',
            borderBottomLeftRadius: eyeW / 2,
            borderBottomRightRadius: eyeW / 2,
          }} />
        )}

        {/* 8c · Female: thin black lower lid outline */}
        {showLashes && (
          <View style={{
            position: 'absolute',
            left: 0, right: 0, bottom: 0,
            height: Math.max(1.5, eyeW * 0.05),
            backgroundColor: '#0d0d0d',
            borderBottomLeftRadius: eyeW / 2,
            borderBottomRightRadius: eyeW / 2,
          }} />
        )}

      </Animated.View>

      <Animated.View
        style={{
          ...StyleSheet.absoluteFillObject,
          transform: [{ translateY }, { scaleY: eyeScaleY }],
        }}
        pointerEvents="none"
      >
        {showLashes && (() => {
          const lashColor = '#0d0d0d';
          // Cluster lashes towards the outer edges (left for left eye, right for right eye)
          const positionsLeft  = [0.04, 0.10, 0.18, 0.28, 0.40, 0.54];
          const positionsRight = [0.46, 0.60, 0.72, 0.82, 0.90, 0.96];
          const positions = side === 'left' ? positionsLeft : positionsRight;

          const rotationsLeft  = [-42, -32, -22, -12, -4, 4];   // Strong fan outward left
          const rotationsRight = [-4, 4, 12, 22, 32, 42];    // Strong fan outward right
          const rotations = side === 'left' ? rotationsLeft : rotationsRight;

          // Longer lashes towards the outer edge
          const lengthsLeft  = [0.62, 0.56, 0.50, 0.44, 0.38, 0.32];
          const lengthsRight = [0.32, 0.38, 0.44, 0.50, 0.56, 0.62];
          const lengths = side === 'left' ? lengthsLeft : lengthsRight;

          return positions.map((xPos, i) => {
            const h = Math.max(10, eyeH * lengths[i]);
            const w = Math.max(3.5, eyeW * 0.18); // Slightly thicker base for stronger "roots"
            // Curved path based on side
            const curveOffset = side === 'left' ? -w * 0.7 : w * 0.7;
            return (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  top: eyeH * 0.33 - h, // lower to sprout exactly from the lid edge
                  left: eyeW * xPos - w / 2,
                  width: w,
                  height: h,
                  transform: [{ rotate: `${rotations[i]}deg` }],
                }}
              >
                <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
                  <Path
                    d={`M 0 ${h} Q ${w * 0.5 + curveOffset} ${h * 0.5} ${w * 0.5} 0 Q ${w * 0.5 + curveOffset} ${h * 0.5} ${w} ${h} Z`}
                    fill={lashColor}
                  />
                </Svg>
              </View>
            );
          });
        })()}
      </Animated.View>

      {/* Heart overlay — rendered OUTSIDE everything so it sits in front of eyelids AND lashes */}
      {expression === 'heartEyes' && (
        <View
          style={{
            position: 'absolute',
            width: eyeW,
            height: eyeH,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          pointerEvents="none"
        >
          <Svg width={irisSize * 1.25} height={irisSize * 1.25} viewBox="0 0 24 24">
            <Path
              d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              fill="#FF4B2B"
            />
          </Svg>
        </View>
      )}
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────
// BubbleEyes — main export
// ─────────────────────────────────────────────────────────────────

export const BubbleEyes: React.FC<BubbleEyesProps> = React.memo(({
  expression,
  eyelidState,
  blinkTrigger,
  gender,
  size,
  bodyColor,
  cuteVariant = false,
  lookToward,
  screenAwareIdle,
  inConversation = false,
  longPressActive = false,
  isAttentive    = false,
  lookAtNamedTarget = null,
  peeking = false,
}) => {
  const isFemale = gender === 'female';
  const iris     = isFemale ? IRIS.female : IRIS.male;

  // ── Animated values ──────────────────────────────────────────
  const blinkAnim   = useRef(new Animated.Value(1)).current;
  const pupilX      = useRef(new Animated.Value(0)).current;
  const pupilY      = useRef(new Animated.Value(0)).current;
  const pupilScale  = useRef(new Animated.Value(1)).current;
  const browLY      = useRef(new Animated.Value(0)).current;
  const browRY      = useRef(new Animated.Value(0)).current;
  const browLRot    = useRef(new Animated.Value(0)).current;
  const browRRot    = useRef(new Animated.Value(0)).current;
  // Per-eye shape animations
  const scaleXAnim  = useRef(new Animated.Value(1)).current;   // shared scaleX (both eyes same)
  const aspectAnim  = useRef(new Animated.Value(1)).current;   // eyeH multiplier

  const [idleTarget, setIdleTarget] = useState({ x: 0, y: 0 });
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const screenRef    = useRef(screenAwareIdle);
  screenRef.current  = screenAwareIdle;

  // ── Blink ────────────────────────────────────────────────────
  useEffect(() => {
    if (blinkTrigger <= 0) return;
    Animated.sequence([
      Animated.timing(blinkAnim, { toValue: 0.02, duration: BLINK_HALF, useNativeDriver: true }),
      Animated.timing(blinkAnim, { toValue: 1,    duration: BLINK_HALF, useNativeDriver: true }),
    ]).start();
  }, [blinkTrigger, blinkAnim]);

  // ── Eye shape per expression ─────────────────────────────────
  useEffect(() => {
    const shape = getEyeShape(expression, eyelidState, gender);
    Animated.parallel([
      Animated.timing(scaleXAnim, { toValue: shape.scaleX, duration: SHAPE_EASING_MS, useNativeDriver: true }),
      Animated.timing(aspectAnim, { toValue: shape.aspect, duration: SHAPE_EASING_MS, useNativeDriver: false }),
    ]).start();
  }, [expression, eyelidState, gender, scaleXAnim, aspectAnim]);

  // ── Eyebrows ─────────────────────────────────────────────────
  useEffect(() => {
    const brow = getBrowTarget(expression);
    Animated.parallel([
      Animated.timing(browLY,   { toValue: brow.leftY,   duration: BROW_EASING_MS, useNativeDriver: true }),
      Animated.timing(browRY,   { toValue: brow.rightY,  duration: BROW_EASING_MS, useNativeDriver: true }),
      Animated.timing(browLRot, { toValue: brow.leftRot, duration: BROW_EASING_MS, useNativeDriver: true }),
      Animated.timing(browRRot, { toValue: brow.rightRot,duration: BROW_EASING_MS, useNativeDriver: true }),
    ]).start();
  }, [expression, browLY, browRY, browLRot, browRRot]);

  // ── Named target → look offset ───────────────────────────────
  const namedTargetOffset = (() => {
    if (!lookAtNamedTarget) return null;
    switch (lookAtNamedTarget) {
      case 'left':        return { x: -2.8, y: 0 };
      case 'right':       return { x:  2.8, y: 0 };
      case 'down':        return { x:  0,   y: 1.2 };
      case 'away':        return { x:  0,   y: -1.5 };
      case 'center':      return { x:  0,   y: 0 };
      case 'user':        return { x:  0,   y: 1.0 };
      case 'otherBubble': return { x: -2.4, y: 0 };
      case 'logo':        return { x:  0,   y: -2.0 };
      default:            return null;
    }
  })();

  // ── Pupil target ─────────────────────────────────────────────
  const targetX = (() => {
    if (longPressActive) return 0;
    if (namedTargetOffset) return namedTargetOffset.x;
    const screen = screenRef.current;
    if (isAttentive && screen) {
      return screen.bubbleCenterX < screen.screenWidth / 2 ? SCREEN_SIDE_S : -SCREEN_SIDE_S;
    }
    if (lookToward) {
      const len = Math.hypot(lookToward.dx, lookToward.dy) || 1;
      return Math.max(-MAX_LOOK, Math.min(MAX_LOOK, (lookToward.dx / len) * MAX_LOOK));
    }
    if (expression === 'lookLeft')  return -2.8;
    if (expression === 'lookRight') return  2.8;
    return idleTarget.x;
  })();

  const targetY = (() => {
    if (longPressActive) return 0;
    if (namedTargetOffset) return namedTargetOffset.y;
    if (lookToward) {
      const len = Math.hypot(lookToward.dx, lookToward.dy) || 1;
      return Math.max(-MAX_LOOK, Math.min(MAX_LOOK, (lookToward.dy / len) * MAX_LOOK));
    }
    if (expression === 'lookUp')   return -1.0;
    if (expression === 'lookDown') return  1.0;
    if (expression === 'eyeRoll')  return -1.5;
    return idleTarget.y;
  })();

  useEffect(() => {
    Animated.parallel([
      Animated.timing(pupilX, { toValue: targetX, duration: PUPIL_EASING_MS, useNativeDriver: true }),
      Animated.timing(pupilY, { toValue: targetY, duration: PUPIL_EASING_MS, useNativeDriver: true }),
    ]).start();
  }, [targetX, targetY, pupilX, pupilY]);

  useEffect(() => {
    Animated.timing(pupilScale, {
      toValue: longPressActive ? 1.22 : 1,
      duration: 130,
      useNativeDriver: true,
    }).start();
  }, [longPressActive, pupilScale]);

  // ── Idle drift ───────────────────────────────────────────────
  useEffect(() => {
    if (lookToward != null || longPressActive) return;
    const screen = screenRef.current;
    if (screen && isAttentive) {
      setIdleTarget(towardScreenCenter(screen, 0, 0));
    } else {
      setIdleTarget({ x: (Math.random() - 0.5) * 0.6, y: (Math.random() - 0.5) * 0.5 });
    }
    const schedule = () => {
      const s = screenRef.current;
      const dX = (Math.random() - 0.5) * 0.22;
      const dY = (Math.random() - 0.5) * 0.18;
      setIdleTarget(s && isAttentive
        ? towardScreenCenter(s, dX, dY)
        : { x: (Math.random() - 0.5) * 1.4, y: (Math.random() - 0.5) * 1.0 });
      idleTimerRef.current = setTimeout(schedule, IDLE_DRIFT_MS + Math.random() * 1800);
    };
    idleTimerRef.current = setTimeout(schedule, IDLE_DRIFT_MS + Math.random() * 1200);
    return () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current); };
  }, [lookToward, longPressActive, isAttentive]);

  // ── Sizing ───────────────────────────────────────────────────
  const eyeScale  = cuteVariant ? 0.32 : 0.30; // Cute: slightly bigger eyes
  const eyeW      = Math.max(12, size * eyeScale);
  const eyeHBase  = Math.max(10, eyeW * (cuteVariant ? 0.86 : 0.82)); // Cute: slightly rounder
  // aspectAnim drives the actual rendered height
  const [aspect, setAspect] = useState(1);
  useEffect(() => {
    const id = aspectAnim.addListener(({ value }) => setAspect(value));
    return () => aspectAnim.removeListener(id);
  }, [aspectAnim]);
  const eyeH       = eyeHBase * aspect;
  const irisSize   = Math.max(7,  eyeW * 0.64);
  const limbalSize = Math.max(8,  irisSize + eyeW * 0.06);
  const pupilSize  = Math.max(3,  irisSize * 0.48);
  const eyeGap     = Math.max(5,  eyeW * 0.24);

  // Brow sizing — female: bold black arched brows like cartoon reference
  const browW     = isFemale ? eyeW * 0.72 : eyeW * 0.80;
  const browThick = isFemale ? Math.max(2.5, size * 0.058) : Math.max(2.5, size * 0.062);
  const browColor = isFemale ? '#0d0d0d' : '#1a1a1a';
  const browBaseY = -(eyeHBase * 0.52 + browThick * 0.5 + 2.5);

  // Lid closedness from shape
  const shape    = getEyeShape(expression, eyelidState, gender);
  const lidLeft  = shape.lidL;
  const lidRight = shape.lidR;

  // Cheek blush — cuter variant: bigger, more visible blush
  const blushW   = isFemale ? eyeW * (cuteVariant ? 0.80 : 0.72) : eyeW * 0.58;
  const blushH   = blushW * 0.52;
  const blushClr = isFemale
    ? (cuteVariant ? 'rgba(255,140,120,0.42)' : 'rgba(255,140,120,0.30)')
    : 'rgba(235,120,100,0.18)';
  const blushY   = eyeH * 0.55; // below the eye

  // Layout
  const browHeadroom = browThick + 7;
  const totalW       = eyeGap + eyeW * 2;
  const totalH       = eyeHBase + browHeadroom + blushH + 3;
  const eyeCentreX   = totalW / 2;
  const eyeCentreY   = browHeadroom + eyeHBase / 2;

  return (
    <View style={{ width: totalW, height: totalH, alignItems: 'center', justifyContent: 'flex-start' }}>

      {/* ── Left brow ──────────────────────────────────────────── */}
      <Animated.View style={{
        position: 'absolute',
        left: eyeCentreX - eyeGap / 2 - eyeW + (eyeW - browW) / 2,
        top: eyeCentreY + browBaseY,
        transform: [
          { translateY: browLY },
          { rotate: browLRot.interpolate({ inputRange: [-20, 20], outputRange: ['-20deg', '20deg'] }) },
        ],
      }}>
        <View style={{
          width: browW, height: browThick,
          borderRadius: browThick / 2,
          backgroundColor: browColor,
          ...(isFemale ? { transform: [{ rotate: '-3deg' }] } : {}),
        }} />
      </Animated.View>

      {/* ── Right brow ─────────────────────────────────────────── */}
      <Animated.View style={{
        position: 'absolute',
        left: eyeCentreX + eyeGap / 2 + (eyeW - browW) / 2,
        top: eyeCentreY + browBaseY,
        transform: [
          { translateY: browRY },
          { rotate: browRRot.interpolate({ inputRange: [-20, 20], outputRange: ['-20deg', '20deg'] }) },
        ],
      }}>
        <View style={{
          width: browW, height: browThick,
          borderRadius: browThick / 2,
          backgroundColor: browColor,
          ...(isFemale ? { transform: [{ rotate: '3deg' }] } : {}),
        }} />
      </Animated.View>

      {/* ── Eyes row ───────────────────────────────────────────── */}
      <View style={{
        position: 'absolute', top: browHeadroom,
        flexDirection: 'row', alignItems: 'center',
        gap: eyeGap,
      }}>
        <SingleEye
          eyeW={eyeW} eyeH={eyeH}
          pupilSize={pupilSize} irisSize={irisSize} limbalSize={limbalSize}
          pupilX={pupilX} pupilY={pupilY} pupilScale={pupilScale}
          blinkAnim={blinkAnim} scaleXAnim={scaleXAnim}
          lidClose={lidLeft} iris={iris} bodyColor={bodyColor}
          showLashes={isFemale} side="left" expression={expression}
        />
        <SingleEye
          eyeW={eyeW} eyeH={eyeH}
          pupilSize={pupilSize} irisSize={irisSize} limbalSize={limbalSize}
          pupilX={pupilX} pupilY={pupilY} pupilScale={pupilScale}
          blinkAnim={blinkAnim} scaleXAnim={scaleXAnim}
          lidClose={lidRight} iris={iris} bodyColor={bodyColor}
          showLashes={isFemale} side="right" expression={expression}
        />
      </View>

      {/* ── Cheek blush — left ─────────────────────────────────── */}
      <View style={{
        position: 'absolute',
        width: blushW, height: blushH,
        borderRadius: blushH / 2,
        backgroundColor: blushClr,
        left: eyeCentreX - eyeGap / 2 - eyeW + (eyeW - blushW) / 2,
        top: eyeCentreY + blushY,
      }} />

      {/* ── Cheek blush — right ────────────────────────────────── */}
      <View style={{
        position: 'absolute',
        width: blushW, height: blushH,
        borderRadius: blushH / 2,
        backgroundColor: blushClr,
        left: eyeCentreX + eyeGap / 2 + (eyeW - blushW) / 2,
        top: eyeCentreY + blushY,
      }} />

    </View>
  );
});

BubbleEyes.displayName = 'BubbleEyes';
