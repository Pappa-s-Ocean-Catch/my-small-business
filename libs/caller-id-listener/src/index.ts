import { NativeModulesProxy, EventEmitter, Subscription } from 'expo-modules-core';
import { requireNativeModule } from 'expo-modules-core';

export type CallerIdListenerState = 'starting' | 'listening' | 'stopped' | 'error';

export interface CallerIdIncomingCall {
  phoneNumber: string;
  callId?: string;
  timestamp: number;
}

export interface CallerIdListenerStatus {
  state: CallerIdListenerState;
  port?: number;
  message?: string;
}

// Attempt to load the native module. It will be null in web, Expo Go, or if not compiled.
let CallerIdListenerModule: any = null;
let emitter: EventEmitter | null = null;

try {
  CallerIdListenerModule = requireNativeModule('CallerIdListener');
  if (CallerIdListenerModule) {
    emitter = new EventEmitter(CallerIdListenerModule);
  }
} catch (e) {
  console.warn('CallerIdListener native module is not available.');
}

/**
 * Starts the caller ID listener on the specified port (default 5060).
 */
export function start(port: number = 5060): void {
  if (CallerIdListenerModule?.start) {
    CallerIdListenerModule.start(port);
  } else {
    console.warn('CallerIdListener.start called but native module is unavailable');
  }
}

/**
 * Stops the caller ID listener and releases the port.
 */
export function stop(): void {
  if (CallerIdListenerModule?.stop) {
    CallerIdListenerModule.stop();
  }
}

/**
 * Returns true if the listener is currently bound to a port and listening.
 */
export function isRunning(): boolean {
  if (CallerIdListenerModule?.isRunning) {
    return CallerIdListenerModule.isRunning();
  }
  return false;
}

/**
 * Subscribes to incoming call events.
 */
export function addIncomingCallListener(
  listener: (event: CallerIdIncomingCall) => void
): Subscription {
  if (emitter) {
    return emitter.addListener('CallerIdIncomingCall', listener);
  }
  // Return a dummy subscription if not available
  return { remove: () => {} } as Subscription;
}

/**
 * Subscribes to status change events.
 */
export function addStatusListener(
  listener: (event: CallerIdListenerStatus) => void
): Subscription {
  if (emitter) {
    return emitter.addListener('CallerIdListenerStatus', listener);
  }
  // Return a dummy subscription
  return { remove: () => {} } as Subscription;
}
