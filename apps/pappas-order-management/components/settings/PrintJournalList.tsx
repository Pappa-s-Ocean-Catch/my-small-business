import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SearchField } from '@/components/ui';
import { ChoiceTabs } from '@/components/ui/ChoiceTabs';
import { ActionButton } from '@/components/ui/ActionButton';
import { designTokens as t } from '@/lib/redesign';
import type { JournalEntry } from '@/stores/printerAutomationStore';

export function PrintJournalList({ entries, onClear }: { entries: JournalEntry[]; onClear: () => void }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const visible = entries.filter((entry) => {
    const text = [entry.scope, entry.message, entry.details, entry.orderNumber, entry.orderId].filter(Boolean).join(' ').toLowerCase();
    const scope = entry.scope.toLowerCase();
    const category = scope.includes('performance') ? 'performance' : /connect|discovery/.test(scope) ? 'connection' : 'print';
    return (filter === 'all' || filter === category) && text.includes(query.trim().toLowerCase());
  });
  return <View style={{ gap: 20 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      <SearchField placeholder="Search journal" accessibilityLabel="Search journal" value={query} onChangeText={setQuery} style={{ flex: 1, minWidth: 220 }} />
      <ChoiceTabs variant="choices" value={filter} onValueChange={setFilter} buttons={[{ value: 'all', label: 'All' }, { value: 'print', label: 'Print' }, { value: 'connection', label: 'Connection' }, { value: 'performance', label: 'Performance' }]} />
      <ActionButton mode="outlined" icon="delete-outline" disabled={!entries.length} onPress={onClear} contentStyle={{ minHeight: 44 }} labelStyle={{ fontSize: 13 }}>Clear journal</ActionButton>
    </View>
    <View style={{ borderWidth: 1, borderColor: t.color.border, borderRadius: 16, overflow: 'hidden', backgroundColor: t.color.surface }}>
      {!visible.length && <Text style={{ padding: 20, color: t.color.muted }}>{entries.length ? 'No matching journal entries.' : 'No journal entries yet.'}</Text>}
      {visible.map((entry, index) => <View key={entry.id} style={{ borderTopWidth: index ? 1 : 0, borderColor: t.color.border }}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: expanded === entry.id }} onPress={() => setExpanded(expanded === entry.id ? null : entry.id)} style={{ minHeight: 78, paddingHorizontal: 18, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: t.color.text }}>{entry.message}</Text>
            <Text style={{ fontSize: 13, lineHeight: 18, color: t.color.muted }}>{new Date(entry.timestamp).toLocaleString()} · {entry.scope}{entry.details ? ' · Tap for diagnostic detail' : ''}</Text>
          </View>
          <View style={{ borderRadius: 7, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: entry.level === 'error' ? t.color.dangerTint : t.color.navyTint }}><Text style={{ color: entry.level === 'error' ? t.color.danger : t.color.muted, fontWeight: '700', fontSize: 12 }}>{entry.level}</Text></View>
        </Pressable>
        {expanded === entry.id && <View style={{ paddingHorizontal: 18, paddingBottom: 16, gap: 8 }}>
          {entry.orderNumber || entry.orderId ? <Text style={{ fontSize: 13, color: t.color.muted }}>Order: {entry.orderNumber || entry.orderId}</Text> : null}
          <Text selectable style={{ fontSize: 13, lineHeight: 20, color: t.color.text }}>{entry.details || 'No additional diagnostic detail.'}</Text>
        </View>}
      </View>)}
    </View>
  </View>;
}
