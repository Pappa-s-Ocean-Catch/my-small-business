import React, { useContext } from 'react';
import { Modal as NativeModal, View } from 'react-native';
import { appDialogStore } from '@/lib/app-dialog';
import { AppDialogOverlay, DialogLayerContext, useAppDialogHost } from './AppDialogHost';

/** Keeps application alerts in the currently presented native window, including nested editors. */
export function AppModal({ children, visible = true, onRequestClose, ...props }: React.ComponentProps<typeof NativeModal>) {
  const layer = useContext(DialogLayerContext) + 1;
  const host = useAppDialogHost(visible, 100 + layer);
  return <DialogLayerContext.Provider value={layer}><NativeModal {...props} visible={visible} onRequestClose={event => {
    if (appDialogStore.getSnapshot().dialog) { appDialogStore.dismiss(); return; }
    onRequestClose?.(event);
  }}><View style={{ flex: 1 }}><View style={{ flex: 1 }} pointerEvents={host.active ? 'none' : 'auto'} accessibilityElementsHidden={host.active} importantForAccessibility={host.active ? 'no-hide-descendants' : 'auto'}>{children}</View><AppDialogOverlay hostId={host.active ? host.hostId : null} /></View></NativeModal></DialogLayerContext.Provider>;
}
