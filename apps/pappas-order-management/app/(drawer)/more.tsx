import { ActionButton as Button } from '@/components/ui/ActionButton';
import React, { useState } from 'react';
import { Alert, ScrollView, View, useWindowDimensions } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { WorkspaceHeader, Panel, SectionHeader } from '@/components/ui';
import { ProfilePrompt } from '@/components/navigation/ProfilePrompt';
import { EditorSheet } from '@/components/ui/EditorSheet';
import { SettingsActionTile } from '@/components/settings/SettingsActionTile';
import { supabase } from '@/lib/supabase';
import { designTokens as t } from '@/lib/redesign';

export default function MoreScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const signOut = async () => {
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setConfirmSignOut(false);
      router.replace('/login');
    } catch { Alert.alert('Couldn’t sign out', 'Please try again.'); }
    finally { setSigningOut(false); }
  };
  const groups: { title: string; rows: [string, string | (() => void)][] }[] = [
    { title: 'Service', rows: [['Live orders', '/(drawer)/(tabs)/live-orders'], ['Take an order', '/pos'], ['Pre-orders', '/pre-orders'], ['Order history', '/(drawer)/(tabs)/orders'], ['Deliveries', '/delivery-management']] },
    { title: 'Customers', rows: [['Customers', '/customers'], ['Marketing', '/marketing'], ['Coupons', '/coupons'], ['Call history', '/call-history']] },
    { title: 'Manage', rows: [['Marketplace', '/marketplace'], ['Menu catalogue', '/menu-management'], ['Sales reports', '/report'], ['TV menus', '/tv-menu']] },
    { title: 'Register', rows: [['Settings', '/settings'], ['About', '/about'], ['Profile', () => {}], ['Sign out', () => setConfirmSignOut(true)]] },
  ];
  return <View style={{ flex: 1, backgroundColor: t.color.background }}>
    <WorkspaceHeader title="More" />
    <ScrollView contentContainerStyle={{ padding: width < 600 ? 12 : 16 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>{groups.map((group) => <Panel key={group.title} style={{ flexBasis: width >= 1000 ? '47%' : '100%', flexGrow: 1, minWidth: 0, gap: 0, padding: width < 600 ? 18 : 20 }}><View style={{ marginBottom: 16 }}><SectionHeader title={group.title} /></View>{group.rows.map(([title, target], index) => <React.Fragment key={title}>{title === 'Profile' ? <ProfilePrompt>{(open) => <SettingsActionTile last={index === group.rows.length - 1} title={title} onPress={open} />}</ProfilePrompt> : <SettingsActionTile last={index === group.rows.length - 1} title={title} onPress={() => typeof target === 'string' ? router.navigate(target as any) : target()} />}</React.Fragment>)}</Panel>)}</View>
    </ScrollView>
    <EditorSheet visible={confirmSignOut} title="Sign out of this register?" subtitle="Please confirm before continuing" size="confirm" pending={signingOut} onDismiss={() => setConfirmSignOut(false)} footer={<><Button mode="outlined" contentStyle={{ minHeight: 48 }} disabled={signingOut} onPress={() => setConfirmSignOut(false)}>Cancel</Button><Button mode="outlined" textColor={t.color.danger} style={{ backgroundColor: t.color.dangerTint, borderColor: t.color.dangerTint }} contentStyle={{ minHeight: 48 }} loading={signingOut} disabled={signingOut} onPress={() => void signOut()}>Sign out</Button></>}><View style={{ minHeight: 190, alignItems: 'center', justifyContent: 'center', gap: 20, paddingVertical: 4 }}><View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: t.color.primaryTint, alignItems: 'center', justifyContent: 'center' }}><Icon source="alert-outline" size={32} color={t.color.primary} /></View><Text style={{ textAlign: 'center', color: t.color.muted, fontSize: 16, lineHeight: 25 }}>Your current session will end. Any unsaved order draft will be discarded.</Text></View></EditorSheet>
  </View>;
}
