/**
 * BubbleActor
 *
 * A self-contained drama-aware bubble renderer.
 * Reads:
 *  - ActorAnimatedValues for position/opacity/scale/rotation (from DramaAnimationEngine)
 *  - ActorStateComplete for expression/speech/lookTarget
 *
 * Renders BubbleContainer + BubbleEyes + a speech bubble label.
 * Positioned absolutely on screen using the animated X/Y values.
 */

import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { BubbleContainer } from '../BubbleContainer';
import { BubbleEyes } from '../BubbleEyes';
import type { ActorAnimatedValues } from './DramaAnimationEngine';
import type { ActorStateComplete, LookTarget } from './types';
import type { EyeExpression } from '../constants';
import { BUBBLE_SIZE } from './useDramaDirector';

// ─── Props ────────────────────────────────────────────────────────────────────

interface BubbleActorProps {
  /** Male = Tyson (blue), Female = Lily (pink) */
  gender: 'male' | 'female';
  brandColor: string;
  anims: ActorAnimatedValues;
  state: ActorStateComplete;
  characterName: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const BubbleActor: React.FC<BubbleActorProps> = React.memo(({
  gender,
  brandColor,
  anims,
  state,
  characterName,
}) => {
  const blinkCountRef = useRef(0);
  const [blinkTrigger, setBlinkTrigger] = useState(0);

  // Autonomous blink loop
  useEffect(() => {
    const blink = () => {
      setBlinkTrigger(n => n + 1);
      const next = 5000 + Math.random() * 6000;
      return setTimeout(blink, next);
    };
    const t = setTimeout(blink, 3000 + Math.random() * 4000);
    return () => clearTimeout(t);
  }, []);

  if (!state.visible) return null;

  // Speech bubble to the left of Tyson, to the right of Lily
  const speechPosition = gender === 'male'
    ? { position: 'absolute' as const, bottom: BUBBLE_SIZE + 8, right: BUBBLE_SIZE + 4, left: undefined }
    : { position: 'absolute' as const, bottom: BUBBLE_SIZE + 8, left: BUBBLE_SIZE + 4, right: undefined };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            { translateX: anims.positionX },
            { translateY: anims.positionY },
          ],
          opacity: anims.opacity,
        },
      ]}
      pointerEvents="none"
    >
      {/* Speech bubble right next to the character (above, left of Tyson / right of Lily) */}
      {state.speech && (
        <View style={[styles.speechBubble, speechPosition]} pointerEvents="none">
          <Text style={styles.speechText} numberOfLines={3}>
            {state.speech}
          </Text>
          <View style={[
            styles.speechTail,
            gender === 'female' ? styles.speechTailLeft : styles.speechTailRight,
          ]} />
        </View>
      )}

      <BubbleContainer
        size={BUBBLE_SIZE}
        brandColor={brandColor}
        saturation={1}
        variant={gender === 'female' ? 'cute' : 'default'}
        externalScale={anims.scale}
        externalRotation={anims.rotation}
      >
        <BubbleEyes
          expression={state.expression as EyeExpression}
          eyelidState="neutralAttentive"
          blinkTrigger={blinkTrigger}
          gender={gender}
          size={BUBBLE_SIZE}
          bodyColor={brandColor}
          cuteVariant={gender === 'female'}
          lookAtNamedTarget={state.lookTarget as LookTarget}
          peeking={state.peeking}
        />
      </BubbleContainer>

      <View style={styles.nameBadge}>
        <Text style={styles.nameText}>{characterName}</Text>
      </View>
    </Animated.View>
  );
});

BubbleActor.displayName = 'BubbleActor';

// ─── Styles ────────────────────────────────────────────────────────────────────

const SPEECH_BUBBLE_MAX_WIDTH = 200;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: BUBBLE_SIZE,
    alignItems: 'center',
    overflow: 'visible',
  },
  speechBubble: {
    position: 'absolute',
    bottom: BUBBLE_SIZE + 8,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: SPEECH_BUBBLE_MAX_WIDTH,
    minWidth: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
  },
  speechText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#1a1a2e',
    fontWeight: '600',
    textAlign: 'center',
  },
  speechTail: {
    position: 'absolute',
    bottom: -7,
    width: 14,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.96)',
    transform: [{ rotate: '45deg' }],
  },
  speechTailLeft: {
    left: 20,
  },
  speechTailRight: {
    right: 20,
  },
  nameBadge: {
    marginTop: 4,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  nameText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
