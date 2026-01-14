import { Audio } from 'expo-av';
import { Platform } from 'react-native';

import {
  SOUND_ASSETS,
  SOUND_OPTIONS,
  type SoundId,
} from './sound-assets.generated';

export { SOUND_OPTIONS };
export type { SoundId };

let soundObject: Audio.Sound | null = null;
let cachedSoundId: SoundId | null = null;
let audioModeInitialized = false;
let playingSequence = false;

async function ensureAudioMode() {
  if (audioModeInitialized) return;
  audioModeInitialized = true;
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch (error) {
    console.error('Error setting audio mode:', error);
  }
}

async function getOrCreateSound(soundId: SoundId): Promise<Audio.Sound> {
  if (soundObject && cachedSoundId === soundId) return soundObject;

  if (soundObject && cachedSoundId !== soundId) {
    try {
      await soundObject.unloadAsync();
    } catch {
      // ignore
    } finally {
      soundObject = null;
      cachedSoundId = null;
    }
  }

  const { sound } = await Audio.Sound.createAsync(SOUND_ASSETS[soundId], {
    shouldPlay: false,
    volume: 1.0,
  });
  soundObject = sound;
  cachedSoundId = soundId;
  return sound;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function waitForFinish(sound: Audio.Sound): Promise<void> {
  return new Promise((resolve) => {
    const onStatus = (status: any) => {
      if (!status?.isLoaded) return;
      if (status.didJustFinish) {
        sound.setOnPlaybackStatusUpdate(null);
        resolve();
      }
    };

    sound.setOnPlaybackStatusUpdate(onStatus);
  });
}

export async function playNewOrderSound(options?: {
  soundId?: SoundId;
  repeatCount?: number;
  delayMs?: number;
}) {
  try {
    if (playingSequence) return;
    playingSequence = true;

    await ensureAudioMode();

    const soundId: SoundId = options?.soundId ?? 'so-proud-notification';
    const repeatCountRaw = options?.repeatCount ?? 3;
    const delayMsRaw = options?.delayMs ?? 2000;
    const repeatCount = Math.min(10, Math.max(1, Math.trunc(repeatCountRaw)));
    const delayMs = Math.max(0, Math.trunc(delayMsRaw));

    const sound = await getOrCreateSound(soundId);

    for (let i = 0; i < repeatCount; i++) {
      // Ensure it replays even if called rapidly.
      try {
        await sound.setPositionAsync(0);
      } catch {
        // Ignore if sound isn't loaded/ready yet
      }

      // iOS sometimes blocks autoplay until an interaction; in that case this can fail.
      await sound.playAsync();
      await waitForFinish(sound);

      // Delay between repeats (but not after the last play)
      if (i < repeatCount - 1 && delayMs > 0) {
        await sleep(delayMs);
      }
    }

    // On web, also try to resume context (best-effort).
    if (Platform.OS === 'web') {
      try {
        const status = await sound.getStatusAsync();
        if ('isLoaded' in status && status.isLoaded && 'shouldPlay' in status) {
          // no-op; just touching status can help debug.
        }
      } catch {
        // ignore
      }
    }
  } catch (error) {
    console.error('Error playing sound:', error);
    // Silently fail - sound is not critical
  } finally {
    playingSequence = false;
  }
}

export async function unloadSounds() {
  if (!soundObject) return;
  try {
    await soundObject.unloadAsync();
  } catch {
    // ignore
  } finally {
    soundObject = null;
  }
}
