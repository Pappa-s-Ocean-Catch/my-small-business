export type AppDialogButton = {
  text?: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void | Promise<unknown>;
  isPreferred?: boolean;
};
export type AppDialogOptions = { cancelable?: boolean; onDismiss?: () => void; userInterfaceStyle?: 'light' | 'dark' | 'unspecified' };
export type AppDialogRequest = { id: number; title: string; message: string; buttons: AppDialogButton[]; options: AppDialogOptions };
type Snapshot = { dialog: AppDialogRequest | null; hostId: number | null };

/** One queue for application-owned alerts; callbacks retain their existing meaning. */
export function createAppDialogStore() {
  let nextId = 0;
  const queue: AppDialogRequest[] = [];
  const hosts = new Map<number, number>();
  const listeners = new Set<() => void>();
  let snapshot: Snapshot = { dialog: null, hostId: null };
  const publish = () => {
    const dialog = queue[0] ?? null;
    // Opening an ordinary editor must not rerender every dialog subscriber when no alert exists.
    const hostId = dialog ? [...hosts].sort(([aId, aLayer], [bId, bLayer]) => bLayer - aLayer || bId - aId)[0]?.[0] ?? null : null;
    if (snapshot.dialog === dialog && snapshot.hostId === hostId) return;
    snapshot = { dialog, hostId };
    listeners.forEach(listener => listener());
  };
  const alert = (title: string, message?: string, buttons?: AppDialogButton[], options: AppDialogOptions = {}) => {
    const actions = buttons?.length ? [...buttons] : [{ text: 'OK' }];
    if (!actions.some(button => button.style === 'cancel') && (actions.length > 1 || actions.some(button => button.style === 'destructive'))) actions.push({ text: 'Cancel', style: 'cancel' });
    queue.push({ id: ++nextId, title, message: message || '', buttons: actions, options });
    publish();
  };
  const invoke = async (callback?: () => void | Promise<unknown>) => {
    try { await callback?.(); }
    catch (error) { alert('Action failed', error instanceof Error ? error.message : 'Unable to complete this action. Please try again.'); }
  };
  const choose = async (id: number, index: number) => {
    const request = queue[0];
    const button = request?.id === id ? request.buttons[index] : undefined;
    if (!button) return;
    queue.shift();
    publish();
    await invoke(button.onPress);
  };
  const dismiss = () => {
    const request = queue[0];
    if (!request) return false;
    const cancel = request.buttons.find(button => button.style === 'cancel');
    if (!cancel && !request.options.cancelable) return false;
    queue.shift();
    publish();
    void invoke(cancel?.onPress);
    void invoke(request.options.onDismiss);
    return true;
  };
  return {
    alert, choose, dismiss,
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    registerHost: (layer: number) => { const id = ++nextId; hosts.set(id, layer); publish(); return id; },
    unregisterHost: (id: number) => { hosts.delete(id); publish(); },
  };
}
export const appDialogStore = createAppDialogStore();
export const appDialog = { alert: appDialogStore.alert };
