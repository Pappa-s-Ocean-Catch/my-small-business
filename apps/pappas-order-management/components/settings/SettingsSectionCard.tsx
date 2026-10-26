import React from 'react';
import { Panel, SectionHeader } from '@/components/ui';
import { SettingsActionTile } from './SettingsActionTile';

type SettingsSectionCardProps = { title: string; description: string; children: React.ReactNode };

export function SettingsSectionCard({ title, description, children }: SettingsSectionCardProps) {
  const rows = React.Children.toArray(children);
  const lastTileIndex = rows.reduce<number>((last, child, index) => React.isValidElement(child) && child.type === SettingsActionTile ? index : last, -1);
  return <Panel style={{ flexGrow: 1, flexBasis: 440, flexShrink: 1, maxWidth: '100%', minWidth: 0, padding: 20, gap: 0 }}><SectionHeader title={title} />{rows.map((child, index) => React.isValidElement<React.ComponentProps<typeof SettingsActionTile>>(child) && child.type === SettingsActionTile ? React.cloneElement(child, { last: index === lastTileIndex }) : child)}</Panel>;
}
