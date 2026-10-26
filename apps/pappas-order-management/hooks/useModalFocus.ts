import { useEffect, useRef, type RefObject } from 'react';
import { Platform, type View } from 'react-native';

/** Web counterpart of native Modal focus containment, including return to the caller. */
export function useModalFocus(ref: RefObject<View | null>, visible: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const caller = document.activeElement as HTMLElement | null;
    const callerIdentity = caller?.id || caller?.closest('[id]')?.id;
    const panel = ref.current as unknown as HTMLElement | null;
    if (!panel) return;
    const controls = () => Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), [tabindex="0"]')).filter((element) => element.offsetParent !== null);
    const focusTimer = setTimeout(() => controls()[0]?.focus(), 0);
    const keydown = (event: KeyboardEvent) => {
      // Only the topmost modal handles keyboard navigation.
      if (!panel.contains(document.activeElement)) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const options = controls();
      const first = options[0];
      const last = options[options.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown, true);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', keydown, true);
      if (caller?.isConnected) caller.focus();
      // If refreshed data replaced the invoking node, recover by its stable identity.
      else if (callerIdentity) {
        const replacement = document.getElementById(callerIdentity);
        const target = replacement?.matches('button, [tabindex="0"]') ? replacement : replacement?.querySelector<HTMLElement>('button, [tabindex="0"]');
        target?.focus();
      }
    };
  }, [ref, visible]);
}
