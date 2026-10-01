import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Modal, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Appbar, Button, Card, Checkbox, Chip, HelperText, IconButton, RadioButton, Searchbar, SegmentedButtons, Surface, Text, TextInput } from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { Customer, getMarketingCustomers } from '@/lib/customers';
import { generateMarketingCampaign, generateMarketingImage, sendMarketingCampaign, type MarketingChannel } from '@/lib/marketing';
import { matchesContactFilter, type ContactFilters } from '@/lib/marketing-contact-filter';
import { compareMarketingPriority } from '@/lib/marketing-priority';
import { getPendingRecipients, matchesMarketingHistory, compareNeverContacted, canSelectRecipient, removeRecipients, type MarketingHistoryFilter } from '@/lib/marketing-audience';
import { BRAND_COLORS } from '@/utils/brand';

type MarketingCustomer = Customer & {
  profileId?: string;
  optInMarketing?: boolean;
  lastMarketingEmailSentAt?: string | null;
  lastMarketingSmsSentAt?: string | null;
};

type SortOption = 'never-contacted' | 'marketing-priority' | 'last-order' | 'last-email' | 'last-sms' | 'total-orders';
type SortDirection = 'asc' | 'desc';

type CustomerRow = {
  customer: MarketingCustomer;
  listKey: string;
};

const PAGE_SIZE = 25;
const HISTORY_OPTIONS = [
  { value: 'all', label: 'All customers' },
  { value: 'never-contacted', label: 'Never contacted' },
  { value: 'never-email', label: 'Never emailed' },
  { value: 'never-sms', label: 'Never sent SMS' },
] as const;
const SORT_OPTIONS = [
  { value: 'never-contacted', label: 'Never contacted first' },
  { value: 'marketing-priority', label: 'Inactive customers first' },
  { value: 'last-sms', label: 'Last SMS' },
  { value: 'last-email', label: 'Last email' },
  { value: 'total-orders', label: 'Total orders' },
] as const;

function formatDateLabel(value?: string | null) {
  if (!value) return 'Never';
  return new Date(value).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function htmlToPlainText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function sortCustomerRows(rows: CustomerRow[], sortOption: SortOption, sortDirection: SortDirection) {
  const getTime = (value?: string | null) => {
    if (!value) return 0;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const sorted = [...rows].sort((a, b) => {
    if (sortOption === 'never-contacted') return compareNeverContacted(a.customer, b.customer);
    if (sortOption === 'marketing-priority') {
      return compareMarketingPriority(a.customer, b.customer);
    }
    if (sortOption === 'last-email') {
      return getTime(a.customer.lastMarketingEmailSentAt) - getTime(b.customer.lastMarketingEmailSentAt);
    }
    if (sortOption === 'last-sms') {
      return getTime(a.customer.lastMarketingSmsSentAt) - getTime(b.customer.lastMarketingSmsSentAt);
    }
    if (sortOption === 'total-orders') {
      return Number(b.customer.totalOrders || 0) - Number(a.customer.totalOrders || 0);
    }
    return getTime(a.customer.lastOrderDate) - getTime(b.customer.lastOrderDate);
  });

  return sortDirection === 'desc' ? sorted.reverse() : sorted;
}

function CustomerTable({
  title,
  rows,
  selected,
  emptyText,
  onToggleCustomer,
  checkedIds,
  onCheckCustomer,
  disabled = false,
}: {
  title: string;
  rows: CustomerRow[];
  selected: boolean;
  emptyText: string;
  onToggleCustomer: (customer: MarketingCustomer) => void;
  disabled?: boolean;
  checkedIds: Set<string>;
  onCheckCustomer: (customer: MarketingCustomer) => void;
}) {
  const { width } = useWindowDimensions();
  const isPhonePortrait = width < 700;

  return (
    <View style={styles.dualListColumn}>
      <Text variant="titleSmall" style={styles.columnTitle}>{title}</Text>
      {rows.length === 0 ? <Text style={styles.emptyColumnText}>{emptyText}</Text> : null}
      {!isPhonePortrait ? (
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.colName]}>Customer</Text>
          <Text style={[styles.tableHeaderText, styles.colOrders]}>Orders</Text>
          <Text style={[styles.tableHeaderText, styles.colDate]}>Last Order</Text>
          <Text style={[styles.tableHeaderText, styles.colDate]}>SMS</Text>
          <Text style={[styles.tableHeaderText, styles.colDate]}>Email</Text>
          <Text style={[styles.tableHeaderText, styles.colAction]}>Action</Text>
        </View>
      ) : null}

      {rows.map(({ customer, listKey }) => (
        <View
          key={selected ? `${listKey}-selected` : listKey}
          style={[styles.tableRow, isPhonePortrait ? styles.mobileTableRow : null, selected ? styles.selectedListItem : null]}
        >
          {isPhonePortrait ? (
            <>
              <View style={styles.mobileCustomerRow}>
                <Checkbox.Item label="" style={styles.rowCheckbox} status={customer.profileId && checkedIds.has(customer.profileId) ? 'checked' : 'unchecked'} disabled={disabled || (!selected && !canSelectRecipient(customer))} onPress={() => onCheckCustomer(customer)} accessibilityLabel={`${selected ? 'Mark for removal' : 'Select'} ${customer.name || 'customer'}`} />
                <View style={styles.mobileCustomerCell}>
                  <Text numberOfLines={1} style={styles.tablePrimaryText}>{customer.name || 'Customer'}</Text>
                  <Text numberOfLines={1} style={styles.tableSecondaryText}>{customer.email || customer.phone || 'No contact'}</Text>
                </View>
                {selected || (customer.profileId && checkedIds.has(customer.profileId)) ? (
                  <Button compact mode="contained-tonal" disabled={disabled} onPress={() => onToggleCustomer(customer)}>Remove</Button>
                ) : customer.optInMarketing === false ? (
                  <Chip compact>Opted out</Chip>
                ) : (
                  <Button compact mode="contained" disabled={disabled || !canSelectRecipient(customer)} onPress={() => onToggleCustomer(customer)}>Add</Button>
                )}
              </View>
              <View style={styles.mobileStatsRow}>
                <Text style={styles.mobileStatText}>Orders: {customer.totalOrders || 0}</Text>
                <Text style={styles.mobileStatText}>Last order: {formatDateLabel(customer.lastOrderDate)}</Text>
                <Text style={styles.mobileStatText}>SMS: {formatDateLabel(customer.lastMarketingSmsSentAt)}</Text>
                <Text style={styles.mobileStatText}>Email: {formatDateLabel(customer.lastMarketingEmailSentAt)}</Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.colName}>
                <View style={styles.checkboxCell}>
                  <Checkbox.Item label="" style={styles.rowCheckbox} status={customer.profileId && checkedIds.has(customer.profileId) ? 'checked' : 'unchecked'} disabled={disabled || (!selected && !canSelectRecipient(customer))} onPress={() => onCheckCustomer(customer)} accessibilityLabel={`${selected ? 'Mark for removal' : 'Select'} ${customer.name || 'customer'}`} />
                  <View style={styles.customerCell}>
                    <Text numberOfLines={1} style={styles.tablePrimaryText}>{customer.name || 'Customer'}</Text>
                    <Text numberOfLines={1} style={styles.tableSecondaryText}>{customer.email || customer.phone || 'No contact'}</Text>
                  </View>
                </View>
              </View>
              <Text style={[styles.tableCellText, styles.colOrders]}>{customer.totalOrders || 0}</Text>
              <Text style={[styles.tableCellText, styles.colDate]}>{formatDateLabel(customer.lastOrderDate)}</Text>
              <Text style={[styles.tableCellText, styles.colDate]}>{formatDateLabel(customer.lastMarketingSmsSentAt)}</Text>
              <Text style={[styles.tableCellText, styles.colDate]}>{formatDateLabel(customer.lastMarketingEmailSentAt)}</Text>
              <View style={styles.colAction}>
                {selected || (customer.profileId && checkedIds.has(customer.profileId)) ? (
                  <Button compact mode="contained-tonal" disabled={disabled} onPress={() => onToggleCustomer(customer)}>Remove</Button>
                ) : customer.optInMarketing === false ? (
                  <Chip compact>Opted out</Chip>
                ) : (
                  <Button compact mode="contained" disabled={disabled || !canSelectRecipient(customer)} onPress={() => onToggleCustomer(customer)}>Add</Button>
                )}
              </View>
            </>
          )}
        </View>
      ))}
    </View>
  );
}

export default function MarketingScreen() {
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const { width, height } = useWindowDimensions();
  const isPhonePortrait = width < 700;
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [allCustomers, setAllCustomers] = useState<MarketingCustomer[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<Map<string, MarketingCustomer>>(new Map());
  const [contactFilters, setContactFilters] = useState<ContactFilters>({ email: false, phone: false });
  const [sortOption, setSortOption] = useState<SortOption>('never-contacted');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [step, setStep] = useState(1);
  const [historyFilter, setHistoryFilter] = useState<MarketingHistoryFilter>('never-email');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [draftContactFilters, setDraftContactFilters] = useState<ContactFilters>({ email: false, phone: false });
  const [draftHistoryFilter, setDraftHistoryFilter] = useState<MarketingHistoryFilter>('never-email');
  const [draftSortOption, setDraftSortOption] = useState<SortOption>('never-contacted');
  const [draftSortDirection, setDraftSortDirection] = useState<SortDirection>('asc');
  const [removalIds, setRemovalIds] = useState<Set<string>>(new Set());
  const [reviewPage, setReviewPage] = useState(0);
  const loadRequest = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [discountPercentage, setDiscountPercentage] = useState('10');
  const [subject, setSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [smsBody, setSmsBody] = useState('');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingContent, setGeneratingContent] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [sentIds, setSentIds] = useState<Record<MarketingChannel, Set<string>>>({ email: new Set(), sms: new Set() });
  const [sendingChannel, setSendingChannel] = useState<MarketingChannel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(searchQuery), 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const loadCustomers = async (nextPage = 0) => {
    const request = ++loadRequest.current;
    setLoading(true);
    setError(null);
    try {
      const response = await getMarketingCustomers();
      if (request !== loadRequest.current) return;
      if (response.error) {
        throw new Error(response.error);
      }

      const nextCustomers = (response.data || []) as MarketingCustomer[];
      setAllCustomers(nextCustomers);
      setSelectedCustomers((current) => {
        const latest = new Map(nextCustomers.filter(canSelectRecipient).map((customer) => [customer.profileId!, customer]));
        return new Map([...current].flatMap(([id]) => latest.has(id) ? [[id, latest.get(id)!] as const] : []));
      });
      setPage(nextPage);
    } catch (loadError: any) {
      if (request !== loadRequest.current) return;
      setError(loadError?.message || 'Failed to load customers');
    } finally {
      if (request === loadRequest.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      void loadCustomers();
      return () => { loadRequest.current++; };
    }, [])
  );

  const customerListRows = useMemo(() => {
    const seen = new Map<string, number>();
    return allCustomers.map((customer) => {
      const baseKey = customer.profileId || [
        customer.email || 'no-email',
        customer.phone || 'no-phone',
        customer.name || 'no-name',
      ].join('|');
      const count = (seen.get(baseKey) || 0) + 1;
      seen.set(baseKey, count);

      return {
        customer,
        listKey: `${baseKey}#${count}`,
      };
    });
  }, [allCustomers]);

  const selectedIds = useMemo(() => new Set(selectedCustomers.keys()), [selectedCustomers]);

  const filteredCustomerRows = useMemo(
    () => customerListRows.filter(({ customer }) => matchesContactFilter(customer, contactFilters) && matchesMarketingHistory(customer, historyFilter) && (!debouncedQuery.trim() || [customer.name, customer.email, customer.phone].some((value) => value?.toLowerCase().includes(debouncedQuery.trim().toLowerCase())))),
    [customerListRows, contactFilters, historyFilter, debouncedQuery]
  );

  const sortedCustomerRows = useMemo(
    () => sortCustomerRows(filteredCustomerRows, sortOption, sortDirection),
    [filteredCustomerRows, sortOption, sortDirection]
  );

  const selectedCustomerRows = useMemo(() => {
    const rows = Array.from(selectedCustomers.values()).map((customer, index) => ({
      customer,
      listKey: `${customer.profileId || customer.email || customer.phone || 'selected'}#${index + 1}`,
    }));
    return sortCustomerRows(rows, sortOption, sortDirection);
  }, [selectedCustomers, sortOption, sortDirection]);

  const availableCustomerRows = useMemo(
    () => sortedCustomerRows,
    [sortedCustomerRows, selectedIds]
  );

  const pagedAvailableCustomerRows = useMemo(() => {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE;
    return availableCustomerRows.slice(from, to);
  }, [availableCustomerRows, page]);

  const eligibleSelectedCustomers = useMemo(
    () => selectedCustomerRows.map(({ customer }) => customer).filter(canSelectRecipient),
    [selectedCustomerRows]
  );

  const selectedCount = selectedCustomerRows.length;
  const parsedDiscount = Number(discountPercentage);
  const validDiscount = Number.isFinite(parsedDiscount) && parsedDiscount > 0 && parsedDiscount <= 100;
  const campaignReady = validDiscount && ((Boolean(subject.trim()) && Boolean(emailBody.trim())) || Boolean(smsBody.trim()));
  const emailRecipientCount = getPendingRecipients(eligibleSelectedCustomers, 'email', sentIds.email).length;
  const smsRecipientCount = getPendingRecipients(eligibleSelectedCustomers, 'sms', sentIds.sms).length;
  const busy = sendingChannel !== null || generatingContent || generatingImage;
  const openRecipientSettings = () => {
    setDraftContactFilters({ ...contactFilters });
    setDraftHistoryFilter(historyFilter);
    setDraftSortOption(sortOption);
    setDraftSortDirection(sortDirection);
    setSettingsVisible(true);
  };
  const applyRecipientSettings = () => {
    setContactFilters({ ...draftContactFilters });
    setHistoryFilter(draftHistoryFilter);
    setSortOption(draftSortOption);
    setSortDirection(draftSortDirection);
    setSettingsVisible(false);
  };
  const contactSummary = contactFilters.email && contactFilters.phone ? 'Email & phone'
    : contactFilters.email ? 'Has email' : contactFilters.phone ? 'Has phone' : 'Any contact';
  const directionSummary = sortOption === 'total-orders' ? (sortDirection === 'asc' ? 'Most orders first' : 'Fewest orders first')
    : sortOption === 'last-email' || sortOption === 'last-sms' ? (sortDirection === 'asc' ? 'Oldest first' : 'Newest first') : '';
  const recipientSettingsSummary = [
    HISTORY_OPTIONS.find((option) => option.value === historyFilter)?.label,
    SORT_OPTIONS.find((option) => option.value === sortOption)?.label,
    directionSummary,
    contactSummary,
  ].filter(Boolean).join(' · ');
  const goToStep = (next: number) => {
    if (busy) return;
    setStep(next);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };
  const toggleRemoval = (customer: MarketingCustomer) => {
    if (!customer.profileId || busy) return;
    setRemovalIds((current) => {
      const next = new Set(current);
      if (next.has(customer.profileId!)) next.delete(customer.profileId!);
      else next.add(customer.profileId!);
      return next;
    });
  };
  useEffect(() => setPage(0), [historyFilter, contactFilters, debouncedQuery, sortOption, sortDirection]);
  useEffect(() => {
    setReviewPage((current) => Math.min(current, Math.max(0, Math.ceil(selectedCount / PAGE_SIZE) - 1)));
    setRemovalIds((current) => new Set([...current].filter((id) => selectedIds.has(id))));
  }, [selectedIds, selectedCount]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(availableCustomerRows.length / PAGE_SIZE) - 1);
    setHasMore(page < maxPage);
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [availableCustomerRows.length, page]);

  const toggleCustomer = (customer: MarketingCustomer) => {
    const profileId = customer.profileId;
    if (!profileId || busy || (!selectedIds.has(profileId) && !canSelectRecipient(customer))) return;

    setSelectedCustomers((current) => {
      const next = new Map(current);
      if (next.has(profileId)) {
        next.delete(profileId);
      } else {
        next.set(profileId, customer);
      }
      return next;
    });
  };

  const handlePrevPage = () => {
    if (page === 0 || loading) return;
    setPage((current) => Math.max(0, current - 1));
  };

  const handleNextPage = () => {
    if (!hasMore || loading) return;
    setPage((current) => current + 1);
  };

  const handleGenerateContent = async () => {
    setGeneratingContent(true);
    setError(null);
    setResultMessage(null);
    try {
      const result = await generateMarketingCampaign(parsedDiscount);
      setSubject(result.subject);
      setEmailBody(result.htmlBody);
      setSmsBody(result.smsBody);
      setResultMessage('Campaign copy generated and ready to edit.');
    } catch (generateError: any) {
      const message = generateError?.message || 'Failed to generate campaign content';
      setError(message);
      Alert.alert('Generate Copy', message);
    } finally {
      setGeneratingContent(false);
    }
  };

  const handleGenerateImage = async () => {
    setGeneratingImage(true);
    setError(null);
    try {
      const generatedImage = await generateMarketingImage({
        title: subject || `Pappas ${parsedDiscount || 10}% offer`,
        description: htmlToPlainText(emailBody || smsBody || 'A warm promotional campaign for loyal customers'),
        discountPercentage: parsedDiscount || 10,
      });
      setImageBase64(generatedImage);
    } catch (imageError: any) {
      const message = imageError?.message || 'Failed to generate campaign image';
      setError(message);
      Alert.alert('Generate Image', message);
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleSend = async (channel: MarketingChannel) => {
    if (busy || step !== 3 || !validDiscount || !eligibleSelectedCustomers.length) return;
    setSendingChannel(channel);
    setError(null);
    setResultMessage(null);
    try {
      if (channel === 'email' && (!subject.trim() || !emailBody.trim())) {
        Alert.alert('Send Email', 'Please generate or enter the email subject and email body first.');
        return;
      }
      if (channel === 'sms' && !smsBody.trim()) {
        Alert.alert('Send SMS', 'Please generate or enter the SMS body first.');
        return;
      }

      const payloadCustomers = getPendingRecipients(eligibleSelectedCustomers, channel, sentIds[channel]).map((customer) => ({
        id: customer.profileId!,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
      }));

      if (!payloadCustomers.length) return;

      const result = await sendMarketingCampaign({
        customers: payloadCustomers,
        discountPercentage: parsedDiscount || 10,
        subject,
        htmlBody: emailBody,
        smsBody,
        channels: [channel],
      });

      if (!result) throw new Error('The send returned no results. Please check delivery history before retrying.');
      const success = result.results?.filter((item) => item.success).length || 0;
      const failed = result.results?.filter((item) => !item.success).length || 0;
      const failedItems = (result.results || []).filter((item) => !item.success);
      const debugSummary = failedItems
        .slice(0, 5)
        .map((item) => {
          const customerLabel = item.customer?.email || item.customer?.phone || item.customer?.id || 'unknown-customer';
          const skipped = item.skippedChannels?.length ? ` skipped=${item.skippedChannels.join(',')}` : '';
          const sent = item.channels?.length ? ` sent=${item.channels.join(',')}` : '';
          return `${customerLabel}: ${item.error || 'unknown error'}${sent}${skipped}`;
        })
        .join('\n');

      console.log('[marketing] send results', result.results);
      setResultMessage(
        failedItems.length > 0
          ? `${channel.toUpperCase()} campaign processed. Success: ${success}. Failed or skipped: ${failed}.\n${debugSummary}`
          : `${channel.toUpperCase()} campaign processed. Success: ${success}. Failed or skipped: ${failed}.`
      );

      if (failedItems.length > 0) {
        Alert.alert(
          `Send ${channel.toUpperCase()} Debug`,
          debugSummary || 'Some recipients failed. Check the app logs for full details.'
        );
      }

      const successfulIds = new Set((result.results || []).filter((item) => item.success).map((item) => item.customer?.id).filter((id): id is string => Boolean(id)));
      setSentIds((current) => ({ ...current, [channel]: new Set([...current[channel], ...successfulIds]) }));
      await loadCustomers(page);
    } catch (sendError: any) {
      const message = sendError?.message || 'Failed to send campaign';
      console.error('[marketing] send failed before results', sendError);
      setError(message);
      Alert.alert(channel === 'email' ? 'Send Email' : 'Send SMS', message);
    } finally {
      setSendingChannel(null);
    }
  };

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.appbar}>
        <Appbar.Action icon="menu" onPress={() => navigation.openDrawer()} iconColor="#fff" />
        <Appbar.Content title="Marketing" titleStyle={styles.appbarTitle} />
      </Appbar.Header>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        ref={scrollRef}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
          setRefreshing(true);
          void loadCustomers(page);
        }} />}
      >
        <Surface style={styles.panel} elevation={1}>
          <Text variant="titleLarge" style={styles.panelTitle}>Create a marketing campaign</Text>
          <View style={styles.row}>
            {['Campaign', 'Recipients', 'Review & send'].map((label, index) => (
              <Button key={label} mode={step === index + 1 ? 'contained' : 'outlined'} disabled={busy || (index > 0 && !campaignReady) || (index === 2 && selectedCount === 0)} onPress={() => goToStep(index + 1)} accessibilityLabel={`Step ${index + 1}: ${label}`}>
                {index + 1}. {label}
              </Button>
            ))}
          </View>
          <Text style={styles.stepHint}>Step {step} of 3 · {selectedCount} recipients selected</Text>
        </Surface>
        {step === 1 ? <Surface style={styles.panel} elevation={1}>
          <Text variant="titleMedium" style={styles.panelTitle}>Campaign</Text>
          <View style={[styles.row, isPhonePortrait ? styles.mobileStack : null]}>
            <TextInput
              mode="outlined"
              label="Discount %"
              value={discountPercentage}
              onChangeText={setDiscountPercentage}
              keyboardType="number-pad"
              style={[styles.discountInput, isPhonePortrait ? styles.mobileFullWidth : null]}
            />
            <Button mode="contained" onPress={handleGenerateContent} loading={generatingContent} disabled={busy || !validDiscount}>
              Generate Copy
            </Button>
            <Button mode="outlined" onPress={handleGenerateImage} loading={generatingImage} disabled={busy || !subject || !validDiscount}>
              Generate Image
            </Button>
          </View>

          <HelperText type="info" visible>
            Prepare email, SMS, or both. Each channel is sent separately after review.
          </HelperText>

          {!validDiscount ? <HelperText type="error">Enter a discount greater than 0 and up to 100%.</HelperText> : null}
          <TextInput mode="outlined" label="Email subject" value={subject} onChangeText={setSubject} style={styles.field} />
          <TextInput
            mode="outlined"
            label="Email body (HTML allowed)"
            value={emailBody}
            onChangeText={setEmailBody}
            multiline
            numberOfLines={8}
            style={styles.field}
          />
          <TextInput
            mode="outlined"
            label="SMS body"
            value={smsBody}
            onChangeText={setSmsBody}
            multiline
            numberOfLines={4}
            style={styles.field}
          />

          {imageBase64 ? (
            <Card style={styles.imageCard}>
              <Image source={{ uri: `data:image/png;base64,${imageBase64}` }} style={styles.imagePreview} resizeMode="cover" />
            </Card>
          ) : null}
        </Surface> : null}

        {step === 2 ? <Surface style={styles.panel} elevation={1}>
          <Text variant="titleMedium" style={styles.panelTitle}>Recipients</Text>
          <Searchbar
            placeholder="Search customers"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchbar}
          />

          <View style={styles.recipientSettingsRow}>
            <Text style={styles.recipientSettingsSummary} numberOfLines={2} accessibilityLabel={`Recipient settings: ${recipientSettingsSummary}`}>
              {recipientSettingsSummary}
            </Text>
            <IconButton
              icon="filter-variant"
              mode="contained-tonal"
              size={22}
              disabled={busy}
              onPress={openRecipientSettings}
              accessibilityLabel="Open recipient filters and sorting"
              style={styles.settingsIcon}
            />
          </View>

          <View style={styles.selectionSummaryRow}>
            <Button
              mode="text"
              onPress={() => setSelectedCustomers((current) => {
                const next = new Map(current);
                for (const { customer } of pagedAvailableCustomerRows) {
                  if (canSelectRecipient(customer) && customer.profileId) {
                    next.set(customer.profileId, customer);
                  }
                }
                return next;
              })}
              compact
            >
              Select all visible
            </Button>
            <Button mode="text" onPress={() => setSelectedCustomers(new Map())} compact>
              Clear selection
            </Button>
          </View>

          <View style={styles.paginationRow}>
            <Text style={styles.paginationText}>Page {page + 1}</Text>
            <View style={styles.paginationActions}>
              <Button mode="outlined" compact onPress={handlePrevPage} disabled={page === 0 || loading}>
                Prev
              </Button>
              <Button mode="outlined" compact onPress={handleNextPage} disabled={!hasMore || loading}>
                Next
              </Button>
            </View>
          </View>

          <CustomerTable
            title={loading ? 'Loading customers…' : `Matching customers (${availableCustomerRows.length}) · ${selectedCount} selected`}
            rows={pagedAvailableCustomerRows}
            selected={false}
            disabled={busy} checkedIds={selectedIds}
            onCheckCustomer={toggleCustomer}
            emptyText={loading ? 'Loading the full customer audience…' : 'No customers match these filters.'}
            onToggleCustomer={toggleCustomer}
          />
          {!loading && sortedCustomerRows.length === 0 ? (
            <Text style={styles.emptyText}>No customers found for this search.</Text>
          ) : null}
        </Surface> : null}

        {step === 3 ? <Surface style={styles.panel} elevation={1}>
          <Text variant="titleMedium" style={styles.panelTitle}>Review & send</Text>
          <Text variant="titleSmall">{parsedDiscount}% discount · {selectedCount} recipients</Text>
          <Text style={styles.stepHint}>Ready to send: {emailRecipientCount} email · {smsRecipientCount} SMS</Text>
          {sentIds.email.size || sentIds.sms.size ? <Text style={styles.stepHint}>Sent this session: {sentIds.email.size} email · {sentIds.sms.size} SMS. Successful recipients remain selected for the other channel.</Text> : null}
          {subject.trim() && emailBody.trim() ? <View style={styles.reviewCopy}>
            <Text variant="titleSmall">Email: {subject}</Text>
            <Text>{htmlToPlainText(emailBody)}</Text>
          </View> : null}
          {smsBody.trim() ? <View style={styles.reviewCopy}><Text variant="titleSmall">SMS</Text><Text>{smsBody}</Text></View> : null}
          <HelperText type="info">Recipients who opted out or received a recent duplicate may be skipped. The generated image is a preview and is not included in the send.</HelperText>
          <View style={styles.selectionSummaryRow}>
            <Button disabled={busy || !selectedCount} onPress={() => setRemovalIds(new Set(selectedCustomerRows.slice(reviewPage * PAGE_SIZE, (reviewPage + 1) * PAGE_SIZE).map(({ customer }) => customer.profileId!)))}>Mark visible for removal</Button>
            <Button mode="outlined" disabled={busy || removalIds.size === 0} onPress={() => { setSelectedCustomers((current) => removeRecipients(current, removalIds)); setRemovalIds(new Set()); }}>Remove marked ({removalIds.size})</Button>
            <Button disabled={busy || removalIds.size === 0} onPress={() => setRemovalIds(new Set())}>Clear marks</Button>
          </View>
          <CustomerTable title={`Recipients (${selectedCount}) · check boxes to mark for removal`} rows={selectedCustomerRows.slice(reviewPage * PAGE_SIZE, (reviewPage + 1) * PAGE_SIZE)} selected disabled={busy} checkedIds={removalIds} onCheckCustomer={toggleRemoval} onToggleCustomer={toggleCustomer} emptyText="No recipients selected. Go back to Recipients to add customers." />
          <View style={styles.paginationRow}>
            <Text>Page {reviewPage + 1} of {Math.max(1, Math.ceil(selectedCount / PAGE_SIZE))}</Text>
            <View style={styles.paginationActions}>
              <Button disabled={busy || reviewPage === 0} onPress={() => setReviewPage((current) => current - 1)}>Previous</Button>
              <Button disabled={busy || (reviewPage + 1) * PAGE_SIZE >= selectedCount} onPress={() => setReviewPage((current) => current + 1)}>Next</Button>
            </View>
          </View>
        </Surface> : null}

        <View style={styles.selectionSummaryRow}>
          <Button mode="outlined" disabled={step === 1 || busy} onPress={() => goToStep(step - 1)}>Back</Button>
          {step < 3 ? <Button mode="contained" disabled={busy || !campaignReady || (step === 2 && selectedCount === 0)} onPress={() => goToStep(step + 1)}>{step === 1 ? 'Choose recipients' : `Review ${selectedCount} recipients`}</Button> : <Button disabled={busy} onPress={() => goToStep(2)}>Edit recipients</Button>}
        </View>

        {error ? <HelperText type="error" visible>{error}</HelperText> : null}
        {resultMessage ? <HelperText type="info" visible>{resultMessage}</HelperText> : null}

        {step === 3 ? <View style={[styles.sendActions, isPhonePortrait ? styles.mobileStack : null]}>
          <Button
            mode="contained"
            onPress={() => handleSend('email')}
            loading={sendingChannel === 'email'}
            disabled={sendingChannel !== null || !validDiscount || emailRecipientCount === 0 || !subject.trim() || !emailBody.trim()}
            style={[styles.sendButton, styles.sendButtonHalf, isPhonePortrait ? styles.mobileFullWidth : null]}
          >
            Send Email ({emailRecipientCount})
          </Button>
          <Button
            mode="outlined"
            onPress={() => handleSend('sms')}
            loading={sendingChannel === 'sms'}
            disabled={sendingChannel !== null || !validDiscount || smsRecipientCount === 0 || !smsBody.trim()}
            style={[styles.sendButton, styles.sendButtonHalf, isPhonePortrait ? styles.mobileFullWidth : null]}
          >
            Send SMS ({smsRecipientCount})
          </Button>
        </View> : null}
      </ScrollView>
      <Modal
        visible={settingsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSettingsVisible(false)}
      >
        <View style={styles.settingsBackdrop}>
          <Surface style={[styles.settingsDialog, { maxHeight: height * 0.9 }]} elevation={3}>
            <View style={styles.settingsHeader}>
              <Text variant="titleLarge" style={styles.settingsTitle}>Filters & sort</Text>
              <IconButton icon="close" onPress={() => setSettingsVisible(false)} accessibilityLabel="Cancel recipient settings" />
            </View>
            <ScrollView style={styles.settingsScroll} contentContainerStyle={styles.settingsBody} keyboardShouldPersistTaps="handled">
              <Text variant="titleSmall" style={styles.settingsSectionTitle}>Show customers with</Text>
              <View style={styles.contactFilterRow}>
                <Checkbox.Item
                  label="Email"
                  status={draftContactFilters.email ? 'checked' : 'unchecked'}
                  onPress={() => setDraftContactFilters((current) => ({ ...current, email: !current.email }))}
                  style={styles.contactFilterItem}
                />
                <Checkbox.Item
                  label="Phone"
                  status={draftContactFilters.phone ? 'checked' : 'unchecked'}
                  onPress={() => setDraftContactFilters((current) => ({ ...current, phone: !current.phone }))}
                  style={styles.contactFilterItem}
                />
              </View>
              <Text style={styles.settingsHint}>Select both to require both email and phone. Leave both off to show all contacts.</Text>

              <Text variant="titleSmall" style={styles.settingsSectionTitle}>Send history</Text>
              <RadioButton.Group value={draftHistoryFilter} onValueChange={(value) => setDraftHistoryFilter(value as MarketingHistoryFilter)}>
                {HISTORY_OPTIONS.map(({ value, label }) => <RadioButton.Item key={value} value={value} label={label} style={styles.settingsChoice} />)}
              </RadioButton.Group>

              <Text variant="titleSmall" style={styles.settingsSectionTitle}>Sort recipients</Text>
              <RadioButton.Group value={draftSortOption} onValueChange={(value) => { setDraftSortOption(value as SortOption); setDraftSortDirection('asc'); }}>
                {SORT_OPTIONS.map(({ value, label }) => <RadioButton.Item key={value} value={value} label={label} style={styles.settingsChoice} />)}
              </RadioButton.Group>
              {draftSortOption !== 'marketing-priority' && draftSortOption !== 'never-contacted' ? (
                <>
                  <Text variant="titleSmall" style={styles.settingsSectionTitle}>Sort direction</Text>
                  <SegmentedButtons value={draftSortDirection} onValueChange={(value) => setDraftSortDirection(value as SortDirection)} buttons={[
                    { value: 'asc', label: draftSortOption === 'total-orders' ? 'Most orders' : 'Oldest first' },
                    { value: 'desc', label: draftSortOption === 'total-orders' ? 'Fewest orders' : 'Newest first' },
                  ]} />
                </>
              ) : null}
            </ScrollView>
            <View style={styles.settingsFooter}>
              <Button onPress={() => setSettingsVisible(false)}>Cancel</Button>
              <Button mode="contained" onPress={applyRecipientSettings}>Apply</Button>
            </View>
          </Surface>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  rowCheckbox: { paddingHorizontal: 0, paddingVertical: 0, width: 48 },
  stepHint: { marginTop: 12, color: '#475569' },
  reviewCopy: { marginTop: 16, gap: 8, padding: 12, backgroundColor: '#f8fafc', borderRadius: 8 },
  recipientSettingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  recipientSettingsSummary: { flex: 1, color: '#475569', fontSize: 13 },
  settingsIcon: { margin: 0 },
  settingsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  settingsDialog: { width: '100%', maxWidth: 520, borderRadius: 20, overflow: 'hidden' },
  settingsHeader: { flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 8, paddingTop: 8 },
  settingsTitle: { flex: 1, fontWeight: '700' },
  settingsScroll: { flexShrink: 1 },
  settingsBody: { paddingHorizontal: 20, paddingBottom: 16 },
  settingsSectionTitle: { marginTop: 16, marginBottom: 8, fontWeight: '700' },
  settingsChoice: { paddingHorizontal: 0 },
  settingsHint: { color: '#475569', fontSize: 13 },
  settingsFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  container: {
    flex: 1,
    backgroundColor: '#f5f7fb',
  },
  appbar: {
    backgroundColor: BRAND_COLORS.header,
  },
  appbarTitle: {
    color: '#fff',
    fontWeight: '700',
  },
  content: {
    padding: 12,
    gap: 16,
  },
  panel: {
    padding: 16,
    borderRadius: 16,
  },
  panelTitle: {
    marginBottom: 12,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  mobileStack: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  mobileFullWidth: {
    alignSelf: 'stretch',
    flex: 0,
    width: '100%',
  },
  discountInput: {
    minWidth: 110,
    flex: 1,
  },
  field: {
    marginTop: 12,
  },
  imageCard: {
    marginTop: 12,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: 180,
    backgroundColor: '#dbe4ee',
  },
  searchbar: {
    marginBottom: 12,
  },
  contactFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 12,
  },
  contactFilterItem: {
    flexGrow: 1,
    minWidth: 110,
    paddingVertical: 0,
  },
  segmented: {
    marginBottom: 12,
  },
  selectionSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
    flexWrap: 'wrap',
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
    flexWrap: 'wrap',
  },
  paginationText: {
    color: '#334155',
    fontWeight: '600',
  },
  paginationActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  dualListColumn: {
    flex: 1,
    minWidth: 0,
    flexBasis: 280,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 8,
  },
  columnTitle: {
    marginBottom: 8,
    paddingHorizontal: 8,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptyColumnText: {
    color: '#64748b',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#dbe4ee',
    flexWrap: 'wrap',
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8,
    flexWrap: 'wrap',
  },
  mobileTableRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 10,
    paddingVertical: 12,
  },
  checkboxCell: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerCell: {
    flex: 1,
    minWidth: 0,
    flexBasis: 160,
  },
  mobileCustomerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mobileCustomerCell: {
    flex: 1,
    minWidth: 0,
  },
  mobileStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingLeft: 48,
  },
  mobileStatText: {
    color: '#475569',
    fontSize: 12,
  },
  tablePrimaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  tableSecondaryText: {
    fontSize: 11,
    color: '#64748b',
  },
  tableCellText: {
    fontSize: 12,
    color: '#334155',
  },
  colName: {
    flex: 2.6,
  },
  colOrders: {
    flex: 0.7,
  },
  colDate: {
    flex: 1,
  },
  colAction: {
    flex: 0.9,
    alignItems: 'flex-end',
    minWidth: 72,
  },
  selectedListItem: {
    backgroundColor: '#ecfeff',
    borderRadius: 12,
  },
  emptyText: {
    color: '#64748b',
    textAlign: 'center',
    paddingVertical: 24,
  },
  sendButton: {
    marginBottom: 24,
  },
  sendActions: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  sendButtonHalf: {
    flex: 1,
    minWidth: 140,
    marginBottom: 0,
  },
});
