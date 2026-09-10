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

export interface CallerIdAITranscript {
  callId: string;
  role: 'customer' | 'ai';
  text: string;
}

export interface CallerIdAIToolCall {
  callId: string;
  toolCallId: string;
  name: string;
  arguments: string; // JSON string
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
 * Starts the caller ID listener on the specified port (default 5060)
 * with an optional array of SIP responses to send back on INVITE,
 * and AI Call Assistant options.
 */
export function start(
  port: number = 5060,
  sipResponses: string[] = [],
  aiCallAssistantEnabled: boolean = false,
  ephemeralToken?: string,
  fallbackNumber?: string
): void {
  if (CallerIdListenerModule?.start) {
    CallerIdListenerModule.start(port, sipResponses, aiCallAssistantEnabled, ephemeralToken, fallbackNumber);
  } else {
    console.warn('CallerIdListener.start called but native module is unavailable');
  }
}

export function endCall(callId: string): void {
  if (CallerIdListenerModule?.endCall) {
    CallerIdListenerModule.endCall(callId);
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
 * Sends a tool output back to the OpenAI Realtime API.
 */
export function sendAIToolOutput(callId: string, toolCallId: string, output: string): void {
  if (CallerIdListenerModule?.sendAIToolOutput) {
    CallerIdListenerModule.sendAIToolOutput(callId, toolCallId, output);
  } else {
    console.warn('CallerIdListener.sendAIToolOutput called but native module is unavailable');
  }
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
 * Subscribes to AI transcript events.
 */
export function addAITranscriptListener(
  listener: (event: CallerIdAITranscript) => void
): Subscription {
  if (emitter) {
    return emitter.addListener('CallerIdAITranscript', listener);
  }
  return { remove: () => {} } as Subscription;
}

/**
 * Subscribes to AI tool call events.
 */
export function addAIToolCallListener(
  listener: (event: CallerIdAIToolCall) => void
): Subscription {
  if (emitter) {
    return emitter.addListener('CallerIdAIToolCall', listener);
  }
  return { remove: () => {} } as Subscription;
}

/**
 * Subscribes to error events.
 */
export function addErrorListener(
  listener: (event: { message: string }) => void
): Subscription {
  if (emitter) {
    return emitter.addListener('CallerIdError', listener);
  }
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

/**
 * Subscribes to raw UDP packet events for debugging.
 */
export function addRawPacketListener(
  listener: (event: { content: string }) => void
): Subscription {
  if (emitter) {
    return emitter.addListener('CallerIdRawPacket', listener);
  }
  // Return a dummy subscription
  return { remove: () => {} } as Subscription;
}
