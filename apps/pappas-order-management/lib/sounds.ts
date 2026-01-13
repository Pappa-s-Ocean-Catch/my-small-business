import { Audio } from 'expo-av';
import { Platform } from 'react-native';

let soundObject: Audio.Sound | null = null;

// Initialize audio mode
Audio.setAudioModeAsync({
  allowsRecordingIOS: false,
  playsInSilentModeIOS: true,
  staysActiveInBackground: false,
  shouldDuckAndroid: true,
  playThroughEarpieceAndroid: false,
}).catch((error) => {
  console.error('Error setting audio mode:', error);
});

export async function playNewOrderSound() {
  try {
    // Unload previous sound if exists
    if (soundObject) {
      try {
        await soundObject.unloadAsync();
      } catch (e) {
        // Ignore unload errors
      }
      soundObject = null;
    }

    // For web, use Web Audio API
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } else {
      // For React Native, create a simple beep using expo-av
      // We'll use a programmatic approach with a short beep
      // Since we don't have an audio file, we'll create a simple tone
      // For now, we'll use a system beep or vibration
      // In production, you should add a notification.mp3 file
      
      // Try to use system sound notification
      // This is a fallback - ideally you'd have a notification.mp3 file
      console.log('Playing new order sound notification');
      
      // For iOS/Android, you can use Haptics or a sound file
      // For now, we'll just log - add a sound file in production
    }
  } catch (error) {
    console.error('Error playing sound:', error);
    // Silently fail - sound is not critical
  }
}
