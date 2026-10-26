import { ActionButton as Button } from '@/components/ui/ActionButton';
import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import { ProfilePrompt } from '@/components/navigation/ProfilePrompt';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { ActivityIndicator, Icon, IconButton, Searchbar as PaperSearchbar, Text, TextInput, type TextInputProps } from 'react-native-paper';
import { designTokens as t, getWindowSizeClass } from '@/lib/redesign';
import { useWindowDimensions } from 'react-native';

export { designTokens } from '@/lib/redesign';
export function AppScreen({ children, style, scroll = false }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; scroll?: boolean }) {
  const { width } = useWindowDimensions();
  const padding = width >= 1100 ? 16 : 12;
  return scroll ? <ScrollView style={s.screen} contentContainerStyle={[{ padding, gap: 16, paddingBottom: 32 }, style]} keyboardShouldPersistTaps="handled">{children}</ScrollView>
    : <View style={[s.screen, { padding, gap: 16 }, style]}>{children}</View>;
}
export function Panel({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.panel, style]}>{children}</View>;
}
export function PageHeader({ title, subtitle, actions, onBack }: { title: string; subtitle?: string; actions?: React.ReactNode; onBack?: () => void }) {
  return <View style={s.pageHeader}>{onBack && <IconButton icon="arrow-left" accessibilityLabel="Go back" onPress={onBack} style={s.back} />}<View style={s.heading}><Text accessibilityRole="header" style={s.title}>{title}</Text>{subtitle && <Text style={s.subtitle}>{subtitle}</Text>}</View>{actions && <View style={s.actions}>{actions}</View>}</View>;
}
/** Main workspace header; editors continue to use the simpler PageHeader. */
export function WorkspaceHeader({ title, actions, leading, hideTitleOnPhone = false, subtitle, onBack, showNewOrder = false, showProfile = true, onNewOrder }: { title: string; actions?: React.ReactNode; leading?: React.ReactNode; hideTitleOnPhone?: boolean; subtitle?: string; onBack?: () => void; showNewOrder?: boolean; showProfile?: boolean; onNewOrder?: () => void }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  return <View style={[s.workspaceHeader, { paddingHorizontal: width >= 1100 ? 16 : 12 }]}>
    {onBack && <HeaderIconButton icon="arrow-left" accessibilityLabel="Go back" onPress={onBack} />}
    <View style={[s.workspaceHeading, !!leading && { flexDirection: 'row', alignItems: 'center', gap: width >= 1100 ? 20 : 14 }]}>
      {!(hideTitleOnPhone && width < 600) && <Text accessibilityRole="header" accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title} numberOfLines={1} style={[s.workspaceTitle, !!leading && { flexShrink: 1 }]}>{title}</Text>}
      {leading}
    </View>
    <View style={s.headerActions}>{actions}{showNewOrder && <HeaderNewOrderButton onPress={onNewOrder || (() => router.navigate('/pos'))} />}{showProfile && <ProfilePrompt>{(open) => <HeaderIconButton icon="account-circle-outline" accessibilityLabel="Profile" onPress={open} />}</ProfilePrompt>}</View>
  </View>;
}
export function HeaderNewOrderButton({ onPress }: { onPress: () => void }) {
  const { width } = useWindowDimensions();
  return <Pressable accessibilityRole="button" accessibilityLabel="New order" hitSlop={4} onPress={onPress} style={({ pressed }) => ({ height: 40, minWidth: 40, paddingHorizontal: width < 600 ? 9 : 12, borderRadius: 8, backgroundColor: pressed ? t.color.primaryPressed : t.color.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 })}>
    <HeaderStrokeIcon name="plus" color={t.color.surface} />{width >= 600 && <Text style={{ color: t.color.surface, fontSize: 14, fontWeight: '700' }}>New order</Text>}
  </Pressable>;
}

const headerIconPaths: Record<string, string> = {
  'clipboard-text-outline': 'M8 4H5v17h14V4h-3M9 3h6v4H9V3Zm-1 8h8m-8 4h8',
  monitor: 'M3 4h18v14H3V4Zm9 14v4m-5 0h10',
  'account-group-outline': 'M2 21v-3a5 5 0 0 1 5-5m15 8v-3a5 5 0 0 0-5-5M7 21v-3a5 5 0 0 1 10 0v3',
  'chart-bar': 'M4 3v18h18M9 16V9m5 7V5m5 11v-5',
  menu: 'M3 6h18M3 12h18M3 18h18',
  'arrow-left': 'M19 12H5m6-6-6 6 6 6',
  plus: 'M12 5v14M5 12h14',
  'filter-variant': 'M4 6h16M7 12h10M10 18h4',
  refresh: 'M20 7v5h-5M4 17v-5h5M6.1 7a7 7 0 0 1 11.7-1L20 9M4 15l2.2 3A7 7 0 0 0 18 17',
  magnify: 'm16 16 5 5',
  'storefront-outline': 'M4 10v10h16V10M3 4h18l1 6H2l1-6Zm6 16v-7h6v7',
  'account-circle-outline': 'M6 21v-3a6 6 0 0 1 12 0v3',
};
export function HeaderStrokeIcon({ name, color, size = 20 }: { name: string; color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    {name === 'account-circle-outline' && <Circle cx={12} cy={7} r={3} />}
    {name === 'account-group-outline' && <><Circle cx={7} cy={7} r={3} /><Circle cx={17} cy={7} r={3} /></>}
    {name === 'magnify' && <Circle cx={10.5} cy={10.5} r={6.5} />}
    <Path d={headerIconPaths[name]} />
  </Svg>;
}
/** 40-unit visual control with a 48-unit native touch region. */
export function HeaderIconButton({ badge, ...props }: React.ComponentProps<typeof IconButton> & { badge?: number }) {
  const name = typeof props.icon === 'string' ? props.icon : undefined;
  return <View style={{ width: 40, height: 40 }}><IconButton {...props} iconColor={props.iconColor || '#365260'} icon={name && headerIconPaths[name] ? ({ color }) => <HeaderStrokeIcon name={name} color={color} /> : props.icon} size={20} hitSlop={4} style={[{ width: 40, height: 40, margin: 0, borderRadius: 8, borderWidth: 1, borderColor: t.color.border, backgroundColor: t.color.surface }, props.style]} />{!!badge && <View pointerEvents="none" style={s.headerBadge}><Text style={s.headerBadgeText}>{badge}</Text></View>}</View>;
}
/** Numbered workflow navigation shared by multi-step workspaces. */
export function WorkflowSteps({ steps, current, onSelect, disabled = [] }: { steps: string[]; current: number; onSelect?: (index: number) => void; disabled?: boolean[] }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
    {steps.map((label, index) => <React.Fragment key={label}>{index > 0 && <Text style={{ color: t.color.border }}>—</Text>}<Pressable accessibilityRole="button" accessibilityLabel={`Step ${index + 1}: ${label}`} accessibilityState={{ selected: current === index, disabled: !!disabled[index] }} disabled={disabled[index]} onPress={() => onSelect?.(index)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 }}><View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: current === index ? t.color.primary : t.color.navyTint, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: current === index ? t.color.surface : t.color.muted, fontSize: 14, fontWeight: '700' }}>{index + 1}</Text></View><Text style={{ fontSize: 14, fontWeight: '700', color: current === index ? t.color.primary : t.color.muted }}>{label}</Text></Pressable></React.Fragment>)}
  </View>;
}
export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return <View style={s.sectionHeader}><View style={s.heading}><Text accessibilityRole="header" style={s.sectionTitle}>{title}</Text>{description && <Text style={s.subtitle}>{description}</Text>}</View>{action}</View>;
}
export function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return <View style={{ minHeight: 64, paddingVertical: 16, borderBottomWidth: 1, borderColor: t.color.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}><Text style={{ fontSize: 16, color: t.color.text, fontWeight: '700', flex: 1 }}>{label}</Text><View style={{ flex: 1, alignItems: 'flex-end' }}>{typeof value === 'string' || typeof value === 'number' ? <Text style={{ fontSize: 16, color: t.color.muted, textAlign: 'right' }}>{value}</Text> : value}</View></View>;
}
export function MetricCard({ label, value, detail, style }: { label: string; value: string | number; detail?: string; style?: StyleProp<ViewStyle> }) {
  return <Panel style={[s.metric, style]}><Text style={s.subtitle}>{label}</Text><Text style={s.metricValue}>{value}</Text>{detail && <Text style={s.subtitle}>{detail}</Text>}</Panel>;
}
export type StatusTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
const tones = { neutral: [t.color.navyTint, t.color.muted], primary: [t.color.primaryTint, t.color.primary], success: [t.color.successTint, t.color.success], warning: [t.color.warningTint, t.color.warning], danger: [t.color.dangerTint, t.color.danger] } as const;
export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: StatusTone }) {
  return <View style={[s.badge, { backgroundColor: tones[tone][0] }]}><Text style={[s.badgeText, { color: tones[tone][1] }]}>{label}</Text></View>;
}
export function AsyncState({ loading, title, description, onRetry, icon, retryLabel = 'Retry', retryMode = 'outlined' }: { loading?: boolean; title: string; description?: string; onRetry?: () => void; icon?: string; retryLabel?: string; retryMode?: 'outlined' | 'contained' }) {
  return <View accessibilityRole="summary" accessibilityLiveRegion="polite" style={s.empty}>{loading ? <ActivityIndicator color={t.color.primary} /> : icon && <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: t.color.primaryTint, alignItems: 'center', justifyContent: 'center' }}><Icon source={icon} color={t.color.primary} size={32} /></View>}<Text style={{ fontSize: 24, fontWeight: '700', color: t.color.text, textAlign: 'center' }}>{title}</Text>{description && <Text style={[s.subtitle, { maxWidth: 360, textAlign: 'center' }]}>{description}</Text>}{onRetry && <Button mode={retryMode} contentStyle={{ minHeight: 48 }} onPress={onRetry}>{retryLabel}</Button>}</View>;
}

export function SearchField({ style, inputStyle, ...props }: React.ComponentProps<typeof PaperSearchbar>) {
  return <PaperSearchbar {...props} elevation={0} style={[{ height: 48, borderRadius: t.radius.control, backgroundColor: t.color.surface, borderWidth: 1, borderColor: t.color.border }, style]} inputStyle={[{ minHeight: 48, fontSize: 16 }, inputStyle]} />;
}
export function FormField({ label, style, accessibilityLabel, ...props }: TextInputProps) {
  const { height, minHeight, backgroundColor, ...fieldStyle } = StyleSheet.flatten(style) || {};
  return <View style={fieldStyle}>
    {label != null && <Text style={{ fontSize: 14, fontWeight: '700', color: t.color.text, marginBottom: 6 }}>{label}</Text>}
    <TextInput mode="outlined" dense {...props} accessibilityLabel={accessibilityLabel || (typeof label === 'string' ? label : undefined)} outlineStyle={[{ borderRadius: t.radius.control }, props.outlineStyle]} style={{ backgroundColor: backgroundColor ?? t.color.surface, minHeight: minHeight ?? (props.multiline ? 105 : 48), ...(height !== undefined && { height }), ...(props.multiline && { textAlignVertical: 'top' }) }} />
  </View>;
}

const s = StyleSheet.create({
  workspaceHeader: { height: 56, flexShrink: 0, backgroundColor: t.color.surface, borderBottomWidth: 1, borderBottomColor: t.color.border, flexDirection: 'row', alignItems: 'center', gap: 12 },
  workspaceHeading: { flex: 1, minWidth: 0 },
  workspaceTitle: { color: t.color.text, fontSize: 18, lineHeight: 22.5, letterSpacing: -0.3, fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerBadge: { position: 'absolute', right: 0, top: 0, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8, backgroundColor: t.color.primary, alignItems: 'center', justifyContent: 'center' },
  headerBadgeText: { fontSize: 10, fontWeight: '700', color: t.color.surface },
  screen: { flex: 1, backgroundColor: t.color.background, minWidth: 0 },
  panel: { backgroundColor: t.color.surface, borderWidth: 1, borderColor: t.color.border, borderRadius: t.radius.card, padding: 16, gap: 12 },
  pageHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, paddingVertical: 8 },
  heading: { flex: 1, minWidth: 140, gap: 4 }, title: { fontSize: 28, fontWeight: '700', color: t.color.text },
  subtitle: { fontSize: 14, color: t.color.muted, lineHeight: 21 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }, back: { margin: 0, width: 48, height: 48 },
  sectionHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }, sectionTitle: { color: t.color.text, fontSize: 18, fontWeight: '700' },
  metric: { flex: 1, minWidth: 140 }, metricValue: { color: t.color.text, fontSize: 32, fontWeight: '700', fontVariant: ['tabular-nums'] },
  badge: { borderRadius: 7, paddingHorizontal: 10, paddingVertical: 7, alignSelf: 'flex-start' }, badgeText: { fontSize: 12, lineHeight: 14.4, fontWeight: '700' },
  empty: { padding: 32, alignItems: 'center', justifyContent: 'center', gap: 12, flex: 1 },
});

export { EditorSheet } from './EditorSheet';

export { ActionButton } from './ActionButton';
