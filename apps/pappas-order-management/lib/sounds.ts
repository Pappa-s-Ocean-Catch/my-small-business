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
let playbackQueue: Promise<void> = Promise.resolve();

async function ensureAudioMode() {
  if (audioModeInitialized) return;
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    audioModeInitialized = true;
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

async function playAndWaitForFinish(sound: Audio.Sound): Promise<void> {
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (error?: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      sound.setOnPlaybackStatusUpdate(null);
      if (error) reject(error); else resolve();
    };
    // Release the queue even if the native player never delivers its completion event.
    const timeout = setTimeout(() => finish(new Error('Order sound playback timed out')), 60000);
    sound.setOnPlaybackStatusUpdate(status => {
      if (!status.isLoaded) {
        if (status.error) finish(new Error(status.error));
      } else if (status.didJustFinish) finish();
    });
    // Register completion before playback so very short sounds cannot finish unnoticed.
    void sound.playAsync().catch(error => finish(error instanceof Error ? error : new Error(String(error))));
  });
}

type OrderSoundOptions = { soundId?: SoundId; repeatCount?: number; delayMs?: number };

export function playNewOrderSound(options?: OrderSoundOptions): Promise<void> {
  const playback = playbackQueue.then(() => playSoundSequence(options));
  playbackQueue = playback.catch(() => {});
  return playback;
}

async function playSoundSequence(options?: OrderSoundOptions) {
  try {
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
      await playAndWaitForFinish(sound);

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
    // Keep later queued alerts playable if this sequence fails.
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
