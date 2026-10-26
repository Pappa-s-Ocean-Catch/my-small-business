import { ActionButton as Button } from '@/components/ui/ActionButton';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { EditorSheet } from '@/components/ui/EditorSheet';
import { supabase } from '@/lib/supabase';
import { designTokens as t } from '@/lib/redesign';

/** A single profile prompt for navigation tiles and workspace headers. */
export function ProfilePrompt({ children }: { children: (open: () => void) => React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [profile, setProfile] = useState<{ email: string; role: string } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!visible) return;
    let active = true;
    setProfile(null);
    setFailed(false);
    void supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      if (error || !data.user) { setFailed(true); return; }
      const role = data.user.app_metadata?.role || data.user.user_metadata?.role;
      setProfile({ email: data.user.email || 'Staff', role: typeof role === 'string' ? role : 'Staff' });
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [visible]);
  const close = () => setVisible(false);
  return <>{children(() => setVisible(true))}<EditorSheet visible={visible} title="Your profile" onDismiss={close} footer={<><Button mode="outlined" onPress={close} contentStyle={{ minHeight: 48 }}>Cancel</Button><Button mode="contained" onPress={close} contentStyle={{ minHeight: 48 }}>Done</Button></>}>
    {failed ? <Text style={{ color: t.color.danger }}>Couldn’t load your profile. Close this window and try again.</Text> : !profile ? <ActivityIndicator accessibilityLabel="Loading profile" /> : [['Signed in as', profile.email], ['Role', profile.role]].map(([label, value]) => <View key={label} style={{ minHeight: 64, paddingVertical: 16, borderBottomWidth: 1, borderColor: t.color.border, flexDirection: 'row', alignItems: 'center', gap: 20 }}><Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: t.color.text }}>{label}</Text><Text style={{ flex: 2, textAlign: 'right', fontSize: 16, color: t.color.text }}>{value}</Text></View>)}
  </EditorSheet></>;
}
