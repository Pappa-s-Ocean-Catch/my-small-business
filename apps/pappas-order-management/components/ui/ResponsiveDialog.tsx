import React from 'react';
import { View } from 'react-native';
import { Dialog as PaperDialog } from 'react-native-paper';
import { EditorSheet } from './EditorSheet';

type Props = React.ComponentProps<typeof PaperDialog>;

/** Preserve the existing compound API while sharing the reference modal frame. */
function DialogFrame({ children, visible, onDismiss, dismissable = true }: Props) {
  let title = '';
  let footer: React.ReactNode;
  const body: React.ReactNode[] = [];
  React.Children.forEach(children, (child, index) => {
    if (!React.isValidElement(child)) return;
    const element = child as React.ReactElement<{ children?: React.ReactNode; style?: React.ComponentProps<typeof View>['style'] }>;
    if (element.type === PaperDialog.Title) {
      title = React.Children.toArray(element.props.children).filter(value => typeof value === 'string' || typeof value === 'number').join('');
    } else if (element.type === PaperDialog.Actions) {
      footer = element.props.children;
    } else if (element.type === PaperDialog.Content || element.type === PaperDialog.ScrollArea) {
      body.push(<View key={index} style={element.props.style}>{element.props.children}</View>);
    } else {
      body.push(child);
    }
  });
  return <EditorSheet visible={visible} title={title} onDismiss={() => { if (dismissable) onDismiss?.(); }} footer={footer}>
    {body}
  </EditorSheet>;
}
export const ResponsiveDialog = Object.assign(DialogFrame, { Title: PaperDialog.Title, Content: PaperDialog.Content, Actions: PaperDialog.Actions, ScrollArea: PaperDialog.ScrollArea, Icon: PaperDialog.Icon });
