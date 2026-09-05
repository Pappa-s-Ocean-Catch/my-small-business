import * as CallerIdListener from '../index';

describe('CallerIdListener JS Adapter', () => {
  it('should not throw when calling start/stop without native module', () => {
    // Since the native module isn't loaded in a pure JS test environment,
    // these should gracefully fall back or console.warn without throwing.
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    
    expect(() => CallerIdListener.start(5060)).not.toThrow();
    expect(() => CallerIdListener.stop()).not.toThrow();
    expect(CallerIdListener.isRunning()).toBe(false);
    
    warnSpy.mockRestore();
  });

  it('should provide dummy subscriptions when native module is missing', () => {
    const sub1 = CallerIdListener.addIncomingCallListener(() => {});
    const sub2 = CallerIdListener.addStatusListener(() => {});
    
    expect(sub1.remove).toBeDefined();
    expect(sub2.remove).toBeDefined();
    
    expect(() => sub1.remove()).not.toThrow();
    expect(() => sub2.remove()).not.toThrow();
  });
});
