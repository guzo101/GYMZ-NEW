import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Animated, PanResponder, useWindowDimensions, Text, Platform, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { CommonActions } from '@react-navigation/native';
import { useTheme } from '../../hooks/useTheme';
import { BubbleContainer, lighten } from './BubbleContainer';
import { BubbleEyes } from './BubbleEyes';
import { BubbleMiniChat } from './BubbleMiniChat';
import { useBubbleState } from './useBubbleState';
import { useBubbleExpression } from './useBubbleExpression';
import { useCoachCharacter } from '../../contexts/CoachCharacterContext';
import { BUBBLE, TIMING } from './constants';
import { NutritionRatingReaction } from './NutritionRatingReaction';
import { 
  SCAN_START_PHRASES,
  pickRandom 
} from './phrases';
import { useMarketingBubbleBehavior } from './useMarketingBubbleBehavior';
import { useMarketingBubbleRegistration } from './MarketingBubbleContext';
import {
  createPeekAnimation,
  createRunAwayAnimation,
  createCelebrationAnimation,
  createSlideInAnimation,
  createBounceAnimation,
} from './marketingAnimations';

const DEFAULT_RIGHT = BUBBLE.RIGHT_OFFSET;
const DEFAULT_BOTTOM = BUBBLE.BOTTOM_OFFSET;
const TAB_BAR = BUBBLE.TAB_BAR_HEIGHT;

/**
 * Clamp bubble position to safe area and tab bar; optionally nudge inward if very close to edge.
 */
function clampPosition(
  left: number,
  top: number,
  size: number,
  winWidth: number,
  winHeight: number,
  insets: { top: number; right: number; bottom: number; left: number }
): { left: number; top: number } {
  const minLeft = insets.left;
  const maxLeft = winWidth - size - insets.right;
  const minTop = insets.top;
  const maxTop = winHeight - size - insets.bottom - TAB_BAR;
  let l = Math.max(minLeft, Math.min(maxLeft, left));
  let t = Math.max(minTop, Math.min(maxTop, top));
  return { left: l, top: t };
}

/**
 * AI Coach Bubble - Playful Guardian.
 * Draggable, persisted position, reaction speech bubble, micro-expressions from triggers.
 * Position clamped to safe area and above tab bar; memoized for performance.
 * 
 * Supports marketing mode for pre-authentication screens with special behaviors.
 */
interface AICoachBubbleProps {
  marketingMode?: boolean;
  navigationRef?: any; // Navigation container ref for marketing mode
}

const AICoachBubbleInner: React.FC<AICoachBubbleProps> = ({ marketingMode = false, navigationRef }) => {
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { theme, gender } = useTheme();
  
  // This component is rendered outside Screen components (at NavigationContainer level)
  // So we must use navigationRef instead of useNavigation() hook
  // useNavigation() only works when component is inside a Screen component
  const navigation = useMemo(() => {
    if (marketingMode) return null;
    
    // Use navigationRef to create navigation object (works outside Screen components)
    // NavigationContainerRef uses dispatch with CommonActions instead of navigate()
    if (navigationRef && navigationRef.isReady && navigationRef.isReady()) {
      return {
        navigate: (name: string, params?: any) => {
          if (navigationRef.dispatch) {
            navigationRef.dispatch(
              CommonActions.navigate({
                name: name as never,
                params,
              })
            );
          }
        },
      };
    }
    
    // Return null if navigationRef not ready - navigation will be unavailable
    return null;
  }, [marketingMode, navigationRef]);
  const char = useCoachCharacter();
  const charRef = useRef(char);
  charRef.current = char;
  const { mode, setActiveBriefly } = useBubbleState();
  const { expression, eyelidState } = useBubbleExpression({
    mode,
    gender: gender === 'female' ? 'female' : 'male',
    eventTrigger: char?.eventTrigger ?? null,
    nutritionScore: char?.nutritionScore ?? null,
    mood: char?.mood ?? 'observing',
    inConversation: char?.inConversation ?? false,
  });
  const [longPressActive, setLongPressActive] = useState(false);

  const size = BUBBLE.SIZE_IDLE;
  const isFemaleProfile = gender === 'female';
  const rawBrandColor = isFemaleProfile ? theme.accent : theme.primary;
  const brandColor = isFemaleProfile ? rawBrandColor : lighten(rawBrandColor, 0.25);

  const [blinkTrigger, setBlinkTrigger] = useState(0);
  const blinkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [fingerRelative, setFingerRelative] = useState<{ x: number; y: number } | null>(null);
  const [glowPulse, setGlowPulse] = useState(false);
  const fingerClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [miniChatOpen, setMiniChatOpen] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const [jumpAnim] = useState(new Animated.Value(0));
  const [burstVisible, setBurstVisible] = useState(false);
  const lastReactionRef = useRef<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Marketing mode state and animations
  const registerCallbacks = useMarketingBubbleRegistration();
  const marketingBehavior = useMarketingBubbleBehavior(marketingMode, navigationRef);

  const [marketingPositionAnim] = useState(new Animated.ValueXY({ x: 0, y: 0 }));
  const [marketingScaleAnim] = useState(new Animated.Value(1));
  const [marketingOpacityAnim] = useState(new Animated.Value(1));
  const [marketingRotationAnim] = useState(new Animated.Value(0));
  const marketingAnimationsRef = useRef<{
    peek?: Animated.CompositeAnimation;
    runAway?: Animated.CompositeAnimation;
    celebration?: Animated.CompositeAnimation;
    slideIn?: Animated.CompositeAnimation;
    bounce?: Animated.CompositeAnimation;
  }>({});

  // Register callbacks with context so screens can trigger behaviors
  useEffect(() => {
    if (marketingMode && registerCallbacks) {
      registerCallbacks({
        setFocusedInput: marketingBehavior.setFocusedInput,
        setFormProgress: marketingBehavior.setFormProgress,
        setHasError: marketingBehavior.setHasError,
        setIsTyping: marketingBehavior.setIsTyping,
        triggerCelebration: marketingBehavior.triggerCelebration,
      });
    }
  }, [marketingMode, registerCallbacks, marketingBehavior]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const reaction = char?.reaction ?? null;
  const isMealScanStarted = char?.eventTrigger?.type === 'mealScanStarted';
  const isMealScanned = char?.eventTrigger?.type === 'mealScanned';
  const nutritionScore = typeof char?.nutritionScore === 'number' ? char.nutritionScore : null;

  // Use marketing speech text if in marketing mode, otherwise use normal reactions
  let speechText: string | null = marketingMode 
    ? marketingBehavior.behaviorState.speechText 
    : reaction;
  
  const scanPhrase = useMemo(() => {
    if (!isMealScanStarted || marketingMode) return null;
    const p = isFemaleProfile ? 'ratifah' : 'tyson';
    return pickRandom(SCAN_START_PHRASES[p]);
  }, [isMealScanStarted, isFemaleProfile, marketingMode]);

  if (!marketingMode) {
    if (isMealScanStarted) {
      speechText = scanPhrase;
    } else if (isMealScanned) {
      // Priority: Dynamic AI quip from the scan result
      const customQuip = char?.eventTrigger?.payload?.customQuip;
      if (customQuip) {
        speechText = customQuip;
      } else {
        // Fallback: If no AI quip, show nothing (heart eyes only)
        speechText = '';
      }
    }
  }
  const showSpeech = Boolean(speechText);

  const defaultLeft = winWidth - size - DEFAULT_RIGHT;
  const defaultTop = winHeight - size - DEFAULT_BOTTOM;

  const resolveInitialPosition = useCallback(() => {
    const raw = char?.bubblePosition && char.bubblePosition.normalized !== false
      ? {
          left: char.bubblePosition.x * (winWidth - size),
          top: char.bubblePosition.y * (winHeight - size),
        }
      : { left: defaultLeft, top: defaultTop };
    return clampPosition(raw.left, raw.top, size, winWidth, winHeight, insets);
  }, [char?.bubblePosition, winWidth, winHeight, size, defaultLeft, defaultTop, insets]);

  const [position, setPosition] = useState(resolveInitialPosition);
  const positionRef = useRef(position);
  positionRef.current = position;
  const [speechWidth, setSpeechWidth] = useState(140);
  const clampRef = useRef({ size, winWidth, winHeight, insets, speechWidth });
  clampRef.current = { size, winWidth, winHeight, insets, speechWidth };
  const moveProgressRef = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setPosition(resolveInitialPosition());
  }, [winWidth, winHeight, resolveInitialPosition]);

  // Marketing mode animations
  useEffect(() => {
    if (!marketingMode) return;

    const behaviorState = marketingBehavior.behaviorState;
    const { animationType, fromEdge, shouldPeek, shouldRunAway, shouldCelebrate } = behaviorState;

    // Clean up previous animations
    Object.values(marketingAnimationsRef.current).forEach(anim => anim?.stop());

    // Handle peek animation
    if (shouldPeek && animationType === 'peek' && fromEdge) {
      const finalPos = resolveInitialPosition();
      const peekAnim = createPeekAnimation(
        marketingOpacityAnim,
        {
          fromEdge,
          finalPosition: finalPos,
          screenWidth: winWidth,
          screenHeight: winHeight,
        }
      );
      marketingAnimationsRef.current.peek = peekAnim;
      peekAnim.start();
    }

    // Handle slide in animation
    if (animationType === 'slide' && fromEdge) {
      const finalPos = resolveInitialPosition();
      const slideAnim = createSlideInAnimation(
        marketingPositionAnim,
        marketingOpacityAnim,
        {
          fromEdge,
          finalPosition: finalPos,
          screenWidth: winWidth,
          screenHeight: winHeight,
        }
      );
      marketingAnimationsRef.current.slideIn = slideAnim;
      slideAnim.start();
    }

    // Handle run-away animation (privacy)
    if (shouldRunAway) {
      const currentPos = positionRef.current;
      const runAwayAnim = createRunAwayAnimation(
        marketingPositionAnim,
        marketingScaleAnim,
        marketingOpacityAnim,
        {
          currentPosition: currentPos,
          direction: 'right',
          distance: 60,
        }
      );
      marketingAnimationsRef.current.runAway = runAwayAnim;
      runAwayAnim.start(() => {
        // Return to normal position after running away
        setTimeout(() => {
          Animated.parallel([
            Animated.spring(marketingPositionAnim, {
              toValue: { x: currentPos.left, y: currentPos.top },
              useNativeDriver: false,
              damping: 12,
              stiffness: 100,
            }),
            Animated.spring(marketingScaleAnim, {
              toValue: 1,
              useNativeDriver: true,
              damping: 12,
              stiffness: 100,
            }),
            Animated.spring(marketingOpacityAnim, {
              toValue: 1,
              useNativeDriver: true,
              damping: 12,
              stiffness: 100,
            }),
          ]).start();
        }, 2000);
      });
    }

    // Handle celebration animation
    if (shouldCelebrate) {
      const celebrationAnim = createCelebrationAnimation(
        jumpAnim,
        marketingScaleAnim,
        marketingRotationAnim
      );
      marketingAnimationsRef.current.celebration = celebrationAnim;
      celebrationAnim.start();
    }

    return () => {
      Object.values(marketingAnimationsRef.current).forEach(anim => anim?.stop());
    };
  }, [
    marketingMode,
    marketingBehavior.behaviorState,
    winWidth,
    winHeight,
    resolveInitialPosition,
    marketingPositionAnim,
    marketingScaleAnim,
    marketingOpacityAnim,
    marketingRotationAnim,
    jumpAnim,
  ]);

  useEffect(() => {
    char?.setInConversation(miniChatOpen);
  }, [miniChatOpen, char]);

  // When user taps a Daily Pulse metric, animate bubble toward that element
  useEffect(() => {
    const target = char?.bubbleTargetPosition;
    if (!target || !char) return;
    const end = clampPosition(
      target.x - size / 2,
      target.y - size / 2,
      size,
      winWidth,
      winHeight,
      insets
    );
    const start = positionRef.current;
    moveProgressRef.setValue(0);
    const listenerId = moveProgressRef.addListener(({ value }) => {
      setPosition({
        left: start.left + (end.left - start.left) * value,
        top: start.top + (end.top - start.top) * value,
      });
    });
    Animated.spring(moveProgressRef, {
      toValue: 1,
      useNativeDriver: false,
      damping: 18,
      stiffness: 120,
      mass: 0.9,
    }).start(({ finished }) => {
      moveProgressRef.removeListener(listenerId);
      if (finished) {
        const finalPos = { left: end.left, top: end.top };
        setPosition(finalPos);
        positionRef.current = finalPos;
        char.setBubblePosition({
          x: end.left / (winWidth - size),
          y: end.top / (winHeight - size),
          normalized: true as const,
        });
        char.setBubbleTargetPosition(null);
      }
    });
  }, [char?.bubbleTargetPosition]);

  const panStart = useRef({ x: 0, y: 0 });
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const center = size / 2;
        const dx = locationX - center;
        const dy = locationY - center;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Only trigger if the touch is within the actual circular bubble bounds
        return dist <= center;
      },
      onMoveShouldSetPanResponder: (evt, g) => {
        // Only take over if it's a move of more than 4px, but only if it started inside the circle
        return Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4;
      },
      onPanResponderGrant: (evt) => {
        panStart.current = { x: positionRef.current.left, y: positionRef.current.top };
        const x = evt.nativeEvent.locationX ?? evt.nativeEvent.pageX - positionRef.current.left;
        const y = evt.nativeEvent.locationY ?? evt.nativeEvent.pageY - positionRef.current.top;
        setFingerRelative({ x, y });
        if (fingerClearRef.current) clearTimeout(fingerClearRef.current);
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = setTimeout(() => {
          longPressTimerRef.current = null;
          longPressFiredRef.current = true;
          setLongPressActive(true);
          setTimeout(() => setLongPressActive(false), 800);
          setActiveBriefly();
        }, TIMING.LONG_PRESS_MS);
      },
      onPanResponderMove: (_, g) => {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        const left = panStart.current.x + g.dx;
        const top = panStart.current.y + g.dy;
        const { size: s, winWidth: w, winHeight: h, insets: inz } = clampRef.current;
        setPosition(clampPosition(left, top, s, w, h, inz));
        const fingerX = g.moveX - left;
        const fingerY = g.moveY - top;
        setFingerRelative({ x: fingerX, y: fingerY });
      },
      onPanResponderRelease: (_, g) => {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        fingerClearRef.current = setTimeout(() => setFingerRelative(null), 150);
        const moved = Math.abs(g.dx) > 10 || Math.abs(g.dy) > 10;
        const c = charRef.current;
        if (moved && c) {
          c.incrementDragCount();
          const pos = positionRef.current;
          c.setBubblePosition({
            x: pos.left / (winWidth - size),
            y: pos.top / (winHeight - size),
            normalized: true as const,
          });
        } else if (!moved && !longPressFiredRef.current) {
          setActiveBriefly();
          setGlowPulse(true);
          setTimeout(() => setGlowPulse(false), 500);
          setMiniChatOpen(true);
        }
        longPressFiredRef.current = false;
      },
    })
  ).current;

  useEffect(() => {
    const scheduleNext = () => {
      const inConv = char?.inConversation;
      const minMs = inConv ? TIMING.BLINK_INTERVAL_ACTIVE_MS_MIN : TIMING.BLINK_INTERVAL_MS_MIN;
      const maxMs = inConv ? TIMING.BLINK_INTERVAL_ACTIVE_MS_MAX : TIMING.BLINK_INTERVAL_MS_MAX;
      const delay = minMs + Math.random() * (maxMs - minMs);
      blinkIntervalRef.current = setTimeout(() => {
        setBlinkTrigger((t) => t + 1);
        scheduleNext();
      }, delay);
    };
    scheduleNext();
    return () => {
      if (blinkIntervalRef.current) clearTimeout(blinkIntervalRef.current);
    };
  }, [char?.inConversation]);

  useEffect(() => {
    const triggerId = `${char?.eventTrigger}_${char?.nutritionScore}_${char?.reaction}`;
    const isNutritionEvent = isMealScanStarted || isMealScanned;
    if (!isNutritionEvent || triggerId === lastReactionRef.current) return;

    lastReactionRef.current = triggerId;
    setActiveBriefly();
    if (isMealScanned && nutritionScore != null && nutritionScore >= 7) {
      setBurstVisible(true);
      Animated.sequence([
        Animated.spring(jumpAnim, {
          toValue: -32,
          speed: 14,
          bounciness: 12,
          useNativeDriver: true,
        }),
        Animated.spring(jumpAnim, {
          toValue: 0,
          speed: 12,
          bounciness: 8,
          useNativeDriver: true,
        }),
      ]).start(() => setBurstVisible(false));
    }
  }, [isMealScanStarted, isMealScanned, nutritionScore, setActiveBriefly, jumpAnim]);

  useEffect(() => {
    return () => {
      if (fingerClearRef.current) clearTimeout(fingerClearRef.current);
    };
  }, []);

  const lookToward = fingerRelative
    ? { dx: fingerRelative.x - size / 2, dy: fingerRelative.y - size / 2 }
    : null;

  const bubbleCenterX = position.left + size / 2;
  const bubbleCenterY = position.top + size / 2;
  const screenAwareIdle = {
    bubbleCenterX,
    bubbleCenterY,
    screenWidth: winWidth,
    screenHeight: winHeight,
  };

  const isAttentive = mode === 'active' || char?.inConversation || miniChatOpen;

  // Map marketing expression to eye expression
  const marketingExpression = marketingMode ? marketingBehavior.behaviorState.expression : null;
  const effectiveExpression = useMemo(() => {
    if (!marketingMode || !marketingExpression) return expression;
    
    switch (marketingExpression) {
      case 'curious':
        return 'curiousTilt';
      case 'excited':
        return 'wide';
      case 'encouraging':
        return 'happy';
      case 'celebrating':
        return 'celebration';
      case 'privacy':
        return 'lookRight'; // Look away
      case 'idle':
      default:
        return expression;
    }
  }, [marketingMode, marketingExpression, expression]);

  // ── Speech bubble animation ────────────────────────────────────
  const speechAnim = useRef(new Animated.Value(0)).current;
  const prevSpeechRef = useRef<string | null>(null);
  useEffect(() => {
    if (showSpeech && speechText !== prevSpeechRef.current) {
      prevSpeechRef.current = speechText;
      speechAnim.setValue(0);
      Animated.spring(speechAnim, {
        toValue: 1,
        useNativeDriver: true,
        damping: 14,
        stiffness: 180,
        mass: 0.8,
      }).start();
    } else if (!showSpeech) {
      Animated.timing(speechAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(() => { prevSpeechRef.current = null; });
    }
  }, [showSpeech, speechText, speechAnim]);

  // ── Speech bubble layout logic (Dynamic Tail) ──────────────────
  const MAX_SPEECH_WIDTH = winWidth * 0.7;
  // Ideal: Center speech bubble over AI bubble
  let idealSpeechLeft = size / 2 - speechWidth / 2;
  // Clamp to screen edges
  const absoluteLeft = position.left + idealSpeechLeft;
  const padding = 16;
  let speechOffset = 0;

  if (absoluteLeft < padding) {
    speechOffset = padding - absoluteLeft;
  } else if (absoluteLeft + speechWidth > winWidth - padding) {
    speechOffset = (winWidth - padding) - (absoluteLeft + speechWidth);
  }

  const finalSpeechLeft = idealSpeechLeft + speechOffset;
  // Tail should always point to size/2
  // Final tail center = finalSpeechLeft + speechWidth/2 + tailShift = size/2
  const tailShift = (size / 2) - (finalSpeechLeft + speechWidth / 2);

  // Animation origin trick: move more when scaling up
  const scaleAnim = speechAnim.interpolate({ inputRange: [0, 1], outputRange: [0.1, 1] });
  const translateAnim = speechAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [15, 0], // Move up as it grows
  });

  const finalPosition = position;

  // Marketing mode: disable dragging and mini chat
  const canInteract = !marketingMode;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill} collapsable={false}>
      <Animated.View
        style={[
          styles.wrapper,
          {
            left: marketingMode ? marketingPositionAnim.x : finalPosition.left,
            top: marketingMode 
              ? marketingPositionAnim.y 
              : finalPosition.top - (miniChatOpen && keyboardHeight > 0 ? Math.max(0, (finalPosition.top + size + 16) - (winHeight - keyboardHeight)) : 0),
            zIndex: miniChatOpen ? 10001 : 9999,
            opacity: marketingMode ? marketingOpacityAnim : 1,
            transform: marketingMode ? [
              { scale: marketingScaleAnim },
              { rotate: marketingRotationAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '15deg'],
              })},
            ] : [],
          },
        ]}
        hitSlop={{ left: 0, right: 0, top: 0, bottom: 0 }}
        {...(canInteract ? panResponder.panHandlers : {})}
      >
        <Animated.View style={{ transform: [{ translateY: jumpAnim }] }} pointerEvents="none">
          <NutritionRatingReaction score={nutritionScore ?? 0} visible={burstVisible} />
        </Animated.View>

        {/* ── Premium speech bubble ─────────────────────────────── */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.speechOuter,
            {
              maxWidth: MAX_SPEECH_WIDTH,
              bottom: size + 16,
              left: finalSpeechLeft,
              opacity: speechAnim,
              transform: [
                { scale: scaleAnim },
                { translateY: translateAnim },
              ],
            },
          ]}
          onLayout={(e) => setSpeechWidth(e.nativeEvent.layout.width)}
        >
          <View style={styles.speechCard}>
            <BlurView
              intensity={85}
              tint="light"
              style={[
                styles.speechGlassBase,
                {
                  borderColor:
                    nutritionScore != null && nutritionScore >= 9
                      ? 'rgba(255,215,0,0.65)'
                      : 'rgba(255,255,255,0.45)',
                },
              ]}
            >
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFillObject,
                  styles.speechTint,
                  { backgroundColor: `${brandColor}14` },
                ]}
              />
              <Text
                style={[
                  styles.speechText,
                  {
                    color: '#0F172A',
                    fontWeight: nutritionScore != null && nutritionScore >= 9 ? '800' : '700',
                  },
                ]}
              >
                {speechText}
              </Text>
            </BlurView>

            {/* Tail triangle pointing down toward bubble (legacy style) */}
            <View
              style={[
                styles.speechTailOuter,
                {
                  borderTopColor: nutritionScore != null && nutritionScore >= 9 ? 'rgba(255,215,0,0.55)' : `${brandColor}2A`,
                  transform: [{ translateX: tailShift }],
                },
              ]}
            />
            <View
              style={[
                styles.speechTailInner,
                {
                  borderTopColor: 'rgba(255, 255, 255, 0.95)',
                  transform: [{ translateX: tailShift }],
                },
              ]}
            />
          </View>
        </Animated.View>

        <Animated.View style={[styles.touchable, { transform: [{ translateY: jumpAnim }] }]}>
          <BubbleContainer
            size={size}
            brandColor={brandColor}
            saturation={char?.saturation ?? 1}
            variant={isFemaleProfile ? 'cute' : 'default'}
          >
            <BubbleEyes
              expression={expression}
              eyelidState={eyelidState}
              blinkTrigger={blinkTrigger}
              gender={gender === 'female' ? 'female' : 'male'}
              size={size}
              bodyColor={brandColor}
              cuteVariant={isFemaleProfile}
              lookToward={lookToward}
              screenAwareIdle={screenAwareIdle}
              inConversation={char?.inConversation ?? false}
              longPressActive={longPressActive}
              isAttentive={isAttentive}
            />
          </BubbleContainer>
        </Animated.View>
      </Animated.View>
      {canInteract && miniChatOpen && (
        <BubbleMiniChat
          bubbleLeft={position.left}
          bubbleTop={position.top}
          bubbleSize={size}
          screenWidth={winWidth}
          screenHeight={winHeight}
          insets={insets}
          onClose={() => setMiniChatOpen(false)}
          onGoToOffice={() => navigation?.navigate('AIChat')}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    zIndex: 9999,
    alignSelf: 'flex-start',
  },
  touchable: {
    alignSelf: 'flex-start',
  },
  // ── Premium speech bubble ──────────────────────────────────────
  speechOuter: {
    position: 'absolute',
    alignItems: 'center',
  },
  speechCard: {
    alignItems: 'center',
  },
  speechGlassBase: {
    minWidth: 190,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: 'hidden',
    backgroundColor: Platform.OS === 'ios' ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.9)',
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    // Android
    elevation: 10,
  },
  speechTint: {
    borderRadius: 16,
  },
  speechText: {
    fontSize: 12,
    lineHeight: 15.5,
    textAlign: 'left',
    letterSpacing: -0.1,
  },
  // Downward-pointing tail (legacy arrow)
  speechTailOuter: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  speechTailInner: {
    position: 'absolute',
    bottom: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(255,255,255,0.8)',
    alignSelf: 'center',
  },
});

// Separate component for marketing mode that doesn't use useNavigation
const AICoachBubbleMarketingMode: React.FC<{ navigationRef: any }> = React.memo(({ navigationRef }) => {
  // This component doesn't call useNavigation, so it can be rendered outside navigator
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { theme, gender } = useTheme();
  const char = useCoachCharacter();
  const { mode } = useBubbleState();
  
  // Use a default expression for marketing mode
  const { expression, eyelidState } = useBubbleExpression({
    mode,
    gender: gender === 'female' ? 'female' : 'male',
    eventTrigger: null,
    nutritionScore: null,
    mood: 'observing',
    inConversation: false,
  });
  
  const marketingBehavior = useMarketingBubbleBehavior(true, navigationRef);
  const registerCallbacks = useMarketingBubbleRegistration();
  const [blinkTrigger, setBlinkTrigger] = useState(0);
  
  // Blink animation
  useEffect(() => {
    const scheduleNext = () => {
      const delay = TIMING.BLINK_INTERVAL_MS_MIN + Math.random() * (TIMING.BLINK_INTERVAL_MS_MAX - TIMING.BLINK_INTERVAL_MS_MIN);
      setTimeout(() => {
        setBlinkTrigger((t) => t + 1);
        scheduleNext();
      }, delay);
    };
    scheduleNext();
  }, []);
  
  // Register callbacks
  useEffect(() => {
    registerCallbacks({
      setFocusedInput: marketingBehavior.setFocusedInput,
      setFormProgress: marketingBehavior.setFormProgress,
      setHasError: marketingBehavior.setHasError,
      setIsTyping: marketingBehavior.setIsTyping,
      triggerCelebration: marketingBehavior.triggerCelebration,
    });
  }, [registerCallbacks, marketingBehavior]);
  
  // Use marketing speech text
  const speechText = marketingBehavior.behaviorState.speechText;
  const showSpeech = Boolean(speechText);
  
  // Use default position for marketing mode
  const size = BUBBLE.SIZE_IDLE;
  const isFemaleProfile = gender === 'female';
  const rawBrandColor = isFemaleProfile ? theme.accent : theme.primary;
  const brandColor = isFemaleProfile ? rawBrandColor : lighten(rawBrandColor, 0.25);
  
  const defaultLeft = winWidth - size - DEFAULT_RIGHT;
  const defaultTop = winHeight - size - DEFAULT_BOTTOM;
  const [position] = useState(() => clampPosition(defaultLeft, defaultTop, size, winWidth, winHeight, insets));
  
  // Speech bubble animation
  const speechAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (showSpeech) {
      Animated.spring(speechAnim, {
        toValue: 1,
        useNativeDriver: true,
        damping: 14,
        stiffness: 180,
        mass: 0.8,
      }).start();
    } else {
      Animated.timing(speechAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
    }
  }, [showSpeech, speechAnim]);
  
  const scaleAnim = speechAnim.interpolate({ inputRange: [0, 1], outputRange: [0.1, 1] });
  const translateAnim = speechAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [15, 0],
  });
  
  // Render simplified bubble for marketing mode (without drag, mini chat, etc.)
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill} collapsable={false}>
      <View style={[styles.wrapper, { left: position.left, top: position.top, zIndex: 9999 }]}>
        {showSpeech && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.speechOuter,
              {
                maxWidth: winWidth * 0.7,
                bottom: size + 16,
                left: size / 2 - 100,
                opacity: speechAnim,
                transform: [{ scale: scaleAnim }, { translateY: translateAnim }],
              },
            ]}
          >
            <View style={styles.speechCard}>
              <BlurView intensity={85} tint="light" style={styles.speechGlassBase}>
                <View
                  pointerEvents="none"
                  style={[StyleSheet.absoluteFillObject, styles.speechTint, { backgroundColor: `${brandColor}14` }]}
                />
                <Text style={[styles.speechText, { color: '#0F172A', fontWeight: '700' }]}>{speechText}</Text>
              </BlurView>
            </View>
          </Animated.View>
        )}
        <BubbleContainer size={size} brandColor={brandColor} saturation={1} variant={isFemaleProfile ? 'cute' : 'default'}>
          <BubbleEyes
            expression={expression}
            eyelidState={eyelidState}
            blinkTrigger={blinkTrigger}
            gender={gender === 'female' ? 'female' : 'male'}
            size={size}
            bodyColor={brandColor}
            cuteVariant={isFemaleProfile}
            lookToward={null}
            screenAwareIdle={null}
            inConversation={false}
            longPressActive={false}
            isAttentive={false}
          />
        </BubbleContainer>
      </View>
    </View>
  );
});

AICoachBubbleMarketingMode.displayName = 'AICoachBubbleMarketingMode';

// Main export - conditionally renders based on marketingMode
export const AICoachBubble: React.FC<AICoachBubbleProps> = ({ marketingMode = false, navigationRef }) => {
  if (marketingMode) {
    return <AICoachBubbleMarketingMode navigationRef={navigationRef} />;
  }
  return <AICoachBubbleInner marketingMode={false} navigationRef={navigationRef} />;
};

AICoachBubble.displayName = 'AICoachBubble';
