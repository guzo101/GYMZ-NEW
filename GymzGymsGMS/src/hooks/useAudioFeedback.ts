import { useCallback, useRef, useState, useEffect } from 'react';

export type SoundProfile = 'modern' | 'retro' | 'minimal';

export function useAudioFeedback() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const [profile, setProfile] = useState<SoundProfile>(() => {
    const saved = localStorage.getItem('gms_scan_sound_profile');
    return (saved as SoundProfile) || 'modern';
  });
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('gms_scan_sound_enabled');
    return saved === null ? true : saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('gms_scan_sound_profile', profile);
  }, [profile]);
  useEffect(() => {
    localStorage.setItem('gms_scan_sound_enabled', String(soundEnabled));
  }, [soundEnabled]);

  /** Only create context on user gesture so it can actually play. Returns null if never unlocked. */
  const getAudioContext = useCallback((): AudioContext | null => {
    return audioContextRef.current;
  }, []);

  /** Call from a user gesture (click/touch/key). Creates context and resumes so sounds can play. */
  const ensureAudioResumed = useCallback(async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      return ctx.state === 'running';
    } catch (e) {
      console.warn('Audio resume failed:', e);
      return false;
    }
  }, []);

  const playTone = useCallback((frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.3) => {
    try {
      if (!soundEnabled) return;
      const ctx = getAudioContext();
      if (!ctx || ctx.state !== 'running') return;

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration + 0.05);
    } catch (err) {
      console.warn('Audio feedback failed:', err);
    }
  }, [getAudioContext, soundEnabled]);

  /** Short click sound played as soon as a barcode is scanned (before success/error). */
  const playClick = useCallback(() => {
    playTone(1200, 0.04, 'sine', 0.12);
  }, [playTone]);

  // Success = rising pitch (low → high) or single high bright tone
  const playSuccess = useCallback(() => {
    switch (profile) {
      case 'retro':
        playTone(523.25, 0.1, 'square', 0.16);   // C5
        setTimeout(() => playTone(659.25, 0.12, 'square', 0.16), 90);  // E5 — ascending
        break;
      case 'minimal':
        playTone(880, 0.08, 'sine', 0.24);
        setTimeout(() => playTone(1320, 0.1, 'sine', 0.22), 60);       // up to higher tone
        break;
      case 'modern':
      default:
        playTone(523.25, 0.12, 'sine', 0.22);   // C5
        setTimeout(() => playTone(659.25, 0.14, 'sine', 0.2), 80);      // E5 — ascending
        break;
    }
  }, [playTone, profile]);

  // Error = descending pitch (high → low) or low buzz — clearly opposite of success
  const playError = useCallback(() => {
    switch (profile) {
      case 'retro':
        playTone(220, 0.14, 'sawtooth', 0.18);
        setTimeout(() => playTone(165, 0.2, 'sawtooth', 0.16), 120);   // descending
        break;
      case 'minimal':
        playTone(400, 0.1, 'sine', 0.26);
        setTimeout(() => playTone(280, 0.14, 'sine', 0.24), 80);        // descending
        break;
      case 'modern':
      default:
        playTone(330, 0.12, 'square', 0.18);
        setTimeout(() => playTone(220, 0.18, 'square', 0.16), 140);     // descending
        break;
    }
  }, [playTone, profile]);

  // Unlock audio on first user interaction (no sound here—only success/error play on scans)
  useEffect(() => {
    const onFirstInteraction = () => {
      window.removeEventListener('click', onFirstInteraction);
      window.removeEventListener('touchstart', onFirstInteraction);
      window.removeEventListener('keydown', onFirstInteraction);
      ensureAudioResumed().catch(() => {});
    };
    window.addEventListener('click', onFirstInteraction, true);
    window.addEventListener('touchstart', onFirstInteraction, true);
    window.addEventListener('keydown', onFirstInteraction, true);
    return () => {
      window.removeEventListener('click', onFirstInteraction, true);
      window.removeEventListener('touchstart', onFirstInteraction, true);
      window.removeEventListener('keydown', onFirstInteraction, true);
    };
  }, [ensureAudioResumed]);

  return { playSuccess, playError, playClick, ensureAudioResumed, profile, setProfile, soundEnabled, setSoundEnabled };
}
