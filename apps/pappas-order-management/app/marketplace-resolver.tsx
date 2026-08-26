import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Appbar, Button, Card, Text } from 'react-native-paper';
import { useRouter } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { buildMarketplacePosOrderDraft, type MarketplaceResolutionIssue } from '@/lib/marketplace-pos-order';
import { groupResolverAddonTargets, type ResolverAddonChoice } from '@/lib/marketplace-resolver-groups';
import { useMarketplacePosDraftStore } from '@/stores/marketplacePosDraftStore';
import { BRAND_COLORS } from '@/utils/brand';

type ResolverTarget = { id: string; name: string; detail?: string } & Partial<ResolverAddonChoice>;

function normalize(value: string) {
  return value.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function money(value: string | null) {
  return value?.trim() || 'Price not supplied by marketplace';
}

function formatResolverError(cause: unknown, fallback: string) {
  if (!cause || typeof cause !== 'object') return cause instanceof Error ? cause.message : fallback;
  const error = cause as { message?: string; code?: string; details?: string | null; hint?: string | null };
  return [
    error.message || fallback,
    error.code ? `Code: ${error.code}` : '',
    error.details ? `Details: ${error.details}` : '',
    error.hint ? `Hint: ${error.hint}` : '',
  ].filter(Boolean).join('\n');
}

export default function MarketplaceResolverScreen() {
  const router = useRouter();
  const marketplaceDraft = useMarketplacePosDraftStore((state) => state.draft);
  const setMarketplacePosDraft = useMarketplacePosDraftStore((state) => state.setDraft);
  const clearMarketplaceDraft = useMarketplacePosDraftStore((state) => state.clearDraft);
  const mappingEdit = useMarketplacePosDraftStore((state) => state.mappingEdit);
  const clearMappingEdit = useMarketplacePosDraftStore((state) => state.clearMappingEdit);
  const [issues, setIssues] = useState<MarketplaceResolutionIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targets, setTargets] = useState<ResolverTarget[]>([]);

  const currentIssue = issues[0] ?? null;
  const editIssue = useMemo<MarketplaceResolutionIssue | null>(() => mappingEdit ? ({
    kind: mappingEdit.entityType, externalName: mappingEdit.externalName,
    mappingExternalName: mappingEdit.externalName, parentExternalName: mappingEdit.parentNormalizedExternalName,
    marketplacePrice: null,
  }) : null, [mappingEdit]);
  const resolverIssue = currentIssue ?? editIssue;

  const loadTargets = useCallback(async (issue: MarketplaceResolutionIssue) => {
    if (issue.kind === 'product') {
      const { data, error: queryError } = await supabase
        .from('sale_products').select('id, name, sale_price').eq('is_active', true).order('name');
      if (queryError) throw new Error(queryError.message);
      return (data || []).map((row: any) => ({ id: row.id, name: row.name, detail: `$${Number(row.sale_price || 0).toFixed(2)}` }));
    }

    let productId: string | null = null;
    if (marketplaceDraft) {
      const draft = await buildMarketplacePosOrderDraft(marketplaceDraft.orderDetail);
      const product = draft.cartItems.find((item) => item.product_name === issue.parentExternalName)
        ?? draft.cartItems.find((item) => normalize(item.product_name) === normalize(issue.parentExternalName));
      productId = product?.product_id ?? null;
    } else if (mappingEdit) {
      const { data, error: mappingError } = await supabase.from('marketplace_name_mappings')
        .select('internal_entity_id').eq('provider', mappingEdit.provider).eq('entity_type', 'product')
        .eq('normalized_external_name', mappingEdit.parentNormalizedExternalName).maybeSingle();
      if (mappingError) throw new Error(mappingError.message);
      productId = data?.internal_entity_id ?? null;
    }
    if (!productId) throw new Error('This modifier needs its parent marketplace product mapped first.');

    if (issue.kind === 'addon_group') {
      const { data, error: queryError } = await supabase
        .from('sale_product_addon_groups').select('addon_groups(id, name)').eq('sale_product_id', productId);
      if (queryError) throw new Error(queryError.message);
      return (data || []).flatMap((row: any) => {
        const group = Array.isArray(row.addon_groups) ? row.addon_groups[0] : row.addon_groups;
        return group ? [{ id: group.id, name: group.name }] : [];
      });
    }

    if (issue.kind === 'addon') {
      const { data, error: queryError } = await supabase
        .from('sale_product_addon_groups')
        .select('addon_groups(id, name, addon_items(id, name, extra_price, is_active))')
        .eq('sale_product_id', productId);
      if (queryError) throw new Error(queryError.message);
      return (data || []).flatMap((row: any) => {
        const group = Array.isArray(row.addon_groups) ? row.addon_groups[0] : row.addon_groups;
        return (group?.addon_items || []).filter((item: any) => item.is_active !== false).map((item: any) => ({
          id: item.id, name: item.name, groupId: group.id, groupName: group.name,
          extraPrice: Number(item.extra_price || 0),
        }));
      });
    }

    const { data, error: queryError } = await supabase
      .from('sale_product_ingredients')
      .select('id, products!product_id(name)')
      .eq('sale_product_id', productId)
      .eq('customer_can_remove', true);
    if (queryError) throw new Error(queryError.message);
    return (data || []).map((row: any) => {
      const ref = Array.isArray(row.products) ? row.products[0] : row.products;
      return { id: row.id, name: ref?.name || 'Unknown ingredient' };
    });
  }, [mappingEdit, marketplaceDraft]);

  const refresh = useCallback(async () => {
    if (!marketplaceDraft && !editIssue) return;
    setLoading(true);
    setError(null);
    try {
      if (marketplaceDraft) {
        const draft = await buildMarketplacePosOrderDraft(marketplaceDraft.orderDetail);
        setIssues(draft.unresolvedIssues);
        if (draft.unresolvedIssues.length === 0) {
          setMarketplacePosDraft(marketplaceDraft);
          router.replace('/pos');
          return;
        }
        setTargets(await loadTargets(draft.unresolvedIssues[0]));
      } else if (editIssue) {
        setIssues([]);
        setTargets(await loadTargets(editIssue));
      }
    } catch (cause) {
      setError(formatResolverError(cause, 'Could not load marketplace resolver.'));
    } finally {
      setLoading(false);
    }
  }, [editIssue, loadTargets, marketplaceDraft, router, setMarketplacePosDraft]);

  useEffect(() => { void refresh(); }, [refresh]);

  const selectTarget = async (target: ResolverTarget) => {
    if (!resolverIssue) return;
    setSaving(true);
    setError(null);
    try {
      const { error: saveError } = await supabase.from('marketplace_name_mappings').upsert({
        provider: marketplaceDraft?.provider ?? mappingEdit!.provider,
        entity_type: resolverIssue.kind,
        external_name: resolverIssue.mappingExternalName,
        normalized_external_name: mappingEdit?.normalizedExternalName ?? normalize(resolverIssue.mappingExternalName),
        parent_normalized_external_name: mappingEdit?.parentNormalizedExternalName ?? normalize(resolverIssue.parentExternalName),
        internal_name: target.name,
        internal_entity_id: target.id,
        is_active: true,
      }, { onConflict: 'provider,entity_type,normalized_external_name,parent_normalized_external_name' });
      if (saveError) throw saveError;

      if (resolverIssue.kind === 'addon' && resolverIssue.marketplaceGroupName && target.groupId && target.groupName) {
        const { error: groupSaveError } = await supabase.from('marketplace_name_mappings').upsert({
          provider: marketplaceDraft?.provider ?? mappingEdit!.provider,
          entity_type: 'addon_group', external_name: resolverIssue.marketplaceGroupName,
          normalized_external_name: normalize(resolverIssue.marketplaceGroupName),
          parent_normalized_external_name: normalize(resolverIssue.parentExternalName),
          internal_name: target.groupName, internal_entity_id: target.groupId, is_active: true,
        }, { onConflict: 'provider,entity_type,normalized_external_name,parent_normalized_external_name' });
        if (groupSaveError) throw groupSaveError;
      }

      if (marketplaceDraft) {
        await supabase.from('marketplace_unmatched_names').delete()
          .eq('provider', marketplaceDraft.provider).eq('entity_type', resolverIssue.kind)
          .eq('normalized_external_name', normalize(resolverIssue.mappingExternalName))
          .eq('parent_external_name', resolverIssue.parentExternalName);
        await refresh();
      } else {
        clearMappingEdit();
        router.back();
      }
    } catch (cause) {
      setError(formatResolverError(cause, 'Could not save this mapping.'));
    } finally {
      setSaving(false);
    }
  };

  const title = useMemo(() => resolverIssue?.kind === 'product' ? 'Choose POS product' : resolverIssue?.kind === 'addon_group' ? 'Choose POS add-on group' : resolverIssue?.kind === 'addon' ? 'Choose POS add-on' : 'Choose removable ingredient', [resolverIssue]);
  const groupedAddonTargets = useMemo(() => groupResolverAddonTargets(targets.filter((target): target is ResolverAddonChoice => (
    Boolean(target.groupId && target.groupName && target.extraPrice != null)
  ))), [targets]);

  if (!marketplaceDraft && !mappingEdit) {
    return <View style={styles.center}><Text>No marketplace order is ready to resolve.</Text><Button onPress={() => router.back()}>Back</Button></View>;
  }

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.appbar}>
        <Appbar.BackAction color="#fff" onPress={() => { clearMarketplaceDraft(); clearMappingEdit(); router.back(); }} disabled={saving} />
        <Appbar.Content title="Resolve marketplace order" titleStyle={styles.appbarTitle} />
      </Appbar.Header>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.summary}><Card.Content>
          <Text style={styles.kicker}>MARKETPLACE ORDER</Text>
          <Text variant="titleLarge">{marketplaceDraft ? `${marketplaceDraft.sourceName} #${marketplaceDraft.orderDetail.orderId}` : 'Edit saved mapping'}</Text>
          <Text style={styles.muted}>Resolve every item before it is added to POS. Each choice is saved for future orders.</Text>
        </Card.Content></Card>
        {loading ? <ActivityIndicator style={styles.loader} size="large" /> : resolverIssue ? <>
          <Text style={styles.step}>Step 1 of {issues.length} remaining</Text>
          <Card style={styles.issue}><Card.Content>
            {resolverIssue.parentExternalName ? <Text style={styles.parent}>{resolverIssue.parentExternalName}</Text> : null}
            <Text variant="headlineSmall">{resolverIssue.externalName}</Text>
            {marketplaceDraft ? <Text style={styles.price}>Marketplace value: {money(resolverIssue.marketplacePrice)}</Text> : null}
            <Text style={styles.muted}>{title}. Only choices valid for this POS product are shown.</Text>
          </Card.Content></Card>
          {resolverIssue.kind === 'addon' ? groupedAddonTargets.map((group) => (
            <View key={group.id} style={styles.addonGroup}>
              <View style={styles.addonGroupLabel}><Text style={styles.addonGroupTitle}>{group.name}</Text></View>
              <View style={styles.optionGrid}>{group.items.map((target) => (
                <TouchableOpacity key={target.id} style={styles.optionButton} onPress={() => void selectTarget(target)} disabled={saving}>
                  <Text style={styles.optionText} numberOfLines={2}>{target.name}</Text>
                  {target.extraPrice > 0 ? <Text style={styles.optionPrice}>+${target.extraPrice.toFixed(2)}</Text> : null}
                </TouchableOpacity>
              ))}</View>
            </View>
          )) : resolverIssue.kind === 'ingredient' ? (
            <View style={styles.removableBlock}>
              <View style={[styles.addonGroupLabel, styles.removeGroupLabel]}><Text style={styles.addonGroupTitle}>Remove Ingredients</Text></View>
              <View style={styles.optionGrid}>{targets.map((target) => (
                <TouchableOpacity key={target.id} style={styles.optionButton} onPress={() => void selectTarget(target)} disabled={saving}>
                  <Text style={styles.optionText} numberOfLines={2}>No {target.name}</Text>
                </TouchableOpacity>
              ))}</View>
            </View>
          ) : targets.map((target) => <TouchableOpacity key={target.id} onPress={() => void selectTarget(target)} disabled={saving}>
            <Card style={styles.target}><Card.Content><Text variant="titleMedium">{target.name}</Text>{target.detail ? <Text style={styles.muted}>{target.detail}</Text> : null}</Card.Content></Card>
          </TouchableOpacity>)}
          {targets.length === 0 ? <Text style={styles.error}>There are no valid POS choices for this item. Add one to the POS menu, then return here.</Text> : null}
        </> : null}
        {saving ? <ActivityIndicator style={styles.loader} /> : null}
        {error ? <View style={styles.errorPanel}>
          <Text style={styles.errorTitle}>Resolver error — press and hold to copy</Text>
          <Text selectable style={styles.error}>{error}</Text>
        </View> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f8' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  appbar: { backgroundColor: BRAND_COLORS.header }, appbarTitle: { color: '#fff', fontWeight: '700' }, content: { padding: 16, gap: 12 },
  summary: { backgroundColor: '#fff' }, kicker: { color: '#557084', fontWeight: '700', fontSize: 12, letterSpacing: 1 },
  muted: { color: '#64748b', marginTop: 6 }, loader: { marginVertical: 28 }, step: { color: '#36566b', fontWeight: '700', marginTop: 4 },
  issue: { backgroundColor: '#e8f2f8', borderColor: '#b8d5e6', borderWidth: 1 }, parent: { color: '#36566b', fontWeight: '700', marginBottom: 6 },
  price: { color: '#0f766e', fontWeight: '700', marginTop: 8 }, target: { backgroundColor: '#fff', marginBottom: 10 },
  addonGroup: { marginTop: 10, borderRadius: 8, borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingTop: 18, paddingBottom: 10 },
  removableBlock: { marginTop: 10, borderRadius: 8, borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fff1f2', paddingHorizontal: 10, paddingTop: 18, paddingBottom: 10 },
  addonGroupLabel: { position: 'absolute', top: -9, left: 10, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: '#1d4ed8' },
  removeGroupLabel: { backgroundColor: '#dc2626' }, addonGroupTitle: { color: '#fff', fontSize: 13, lineHeight: 16, fontWeight: '900' },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  optionButton: { width: '31%', minHeight: 52, borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 7, justifyContent: 'center' },
  optionText: { color: '#111827', fontSize: 13, lineHeight: 16, fontWeight: '900', textAlign: 'center' }, optionPrice: { color: '#6b7280', fontSize: 12, marginTop: 2, fontWeight: '800', textAlign: 'center' },
  error: { color: '#b91c1c', marginTop: 12, fontWeight: '600' },
  errorPanel: { marginTop: 12, padding: 12, borderRadius: 8, backgroundColor: '#fff1f2', borderColor: '#fecaca', borderWidth: 1 },
  errorTitle: { color: '#991b1b', fontWeight: '800' },
});
