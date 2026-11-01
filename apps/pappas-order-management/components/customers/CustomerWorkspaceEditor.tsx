import React from 'react';
import { EditorSheet } from '@/components/ui/EditorSheet';

type Props = {
  visible: boolean;
  title: string;
  children: React.ReactNode;
  footer: (dismiss: () => void) => React.ReactNode;
  onDismiss: () => void;
  dirty: boolean;
  pending: boolean;
};

/** Customer inputs retain discard protection in the shared editor frame. */
export function CustomerWorkspaceEditor(props: Props) {
  return <EditorSheet {...props} />;
}
