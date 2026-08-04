import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Button, Card, Checkbox, Chip, HelperText, Searchbar, SegmentedButtons, Surface, Text, TextInput } from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { Customer, getRecentCustomers, searchCustomers } from '@/lib/customers';
import { generateMarketingCampaign, generateMarketingImage, sendMarketingCampaign, type MarketingChannel } from '@/lib/marketing';
import { matchesContactFilter, type ContactFilters } from '@/lib/marketing-contact-filter';

type MarketingCustomer = Customer & {
  profileId?: string;
  optInMarketing?: boolean;
  lastMarketingEmailSentAt?: string | null;
  lastMarketingSmsSentAt?: string | null;
};

type SortOption = 'last-order' | 'last-email' | 'last-sms' | 'total-orders';
type SortDirection = 'asc' | 'desc';

type CustomerRow = {
  customer: MarketingCustomer;
  listKey: string;
};

const PAGE_SIZE = 25;

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
}: {
  title: string;
  rows: CustomerRow[];
  selected: boolean;
  emptyText: string;
  onToggleCustomer: (customer: MarketingCustomer) => void;
}) {
  return (
    <View style={styles.dualListColumn}>
      <Text variant="titleSmall" style={styles.columnTitle}>{title}</Text>
      {rows.length === 0 ? <Text style={styles.emptyColumnText}>{emptyText}</Text> : null}
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderText, styles.colName]}>Customer</Text>
        <Text style={[styles.tableHeaderText, styles.colOrders]}>Orders</Text>
        <Text style={[styles.tableHeaderText, styles.colDate]}>Last Order</Text>
        <Text style={[styles.tableHeaderText, styles.colDate]}>Email</Text>
        <Text style={[styles.tableHeaderText, styles.colDate]}>SMS</Text>
        <Text style={[styles.tableHeaderText, styles.colAction]}>Action</Text>
      </View>

      {rows.map(({ customer, listKey }) => (
        <View
          key={selected ? `${listKey}-selected` : listKey}
          style={[styles.tableRow, selected ? styles.selectedListItem : null]}
        >
          <View style={styles.colName}>
            <View style={styles.checkboxCell}>
              <Checkbox status={selected ? 'checked' : 'unchecked'} disabled={!customer.profileId} />
              <View style={styles.customerCell}>
                <Text numberOfLines={1} style={styles.tablePrimaryText}>{customer.name || 'Customer'}</Text>
                <Text numberOfLines={1} style={styles.tableSecondaryText}>{customer.email || customer.phone || 'No contact'}</Text>
              </View>
            </View>
          </View>
          <Text style={[styles.tableCellText, styles.colOrders]}>{customer.totalOrders || 0}</Text>
          <Text style={[styles.tableCellText, styles.colDate]}>{formatDateLabel(customer.lastOrderDate)}</Text>
          <Text style={[styles.tableCellText, styles.colDate]}>{formatDateLabel(customer.lastMarketingEmailSentAt)}</Text>
          <Text style={[styles.tableCellText, styles.colDate]}>{formatDateLabel(customer.lastMarketingSmsSentAt)}</Text>
          <View style={styles.colAction}>
            {selected ? (
              <Button compact mode="contained-tonal" onPress={() => onToggleCustomer(customer)}>
                Remove
              </Button>
            ) : customer.optInMarketing === false ? (
              <Chip compact>Opted out</Chip>
            ) : (
              <Button compact mode="contained" disabled={!customer.profileId} onPress={() => onToggleCustomer(customer)}>
                Add
              </Button>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

export default function MarketingScreen() {
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [allCustomers, setAllCustomers] = useState<MarketingCustomer[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<Map<string, MarketingCustomer>>(new Map());
  const [contactFilters, setContactFilters] = useState<ContactFilters>({ email: false, phone: false });
  const [sortOption, setSortOption] = useState<SortOption>('last-order');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
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
  const [sendingChannel, setSendingChannel] = useState<MarketingChannel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(searchQuery), 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const loadCustomers = async (query = debouncedQuery, nextPage = 0) => {
    setLoading(true);
    setError(null);
    try {
      const response = query.trim()
        ? await searchCustomers(query, 0, 500)
        : await getRecentCustomers(0, 500);
      if (response.error) {
        throw new Error(response.error);
      }

      const nextCustomers = (response.data || []) as MarketingCustomer[];
      setAllCustomers(nextCustomers);
      setPage(nextPage);
    } catch (loadError: any) {
      setError(loadError?.message || 'Failed to load customers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      void loadCustomers(debouncedQuery, 0);
    }, [debouncedQuery])
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
    () => customerListRows.filter(({ customer }) => matchesContactFilter(customer, contactFilters)),
    [customerListRows, contactFilters]
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
    () => sortedCustomerRows.filter(({ customer }) => !customer.profileId || !selectedIds.has(customer.profileId)),
    [sortedCustomerRows, selectedIds]
  );

  const pagedAvailableCustomerRows = useMemo(() => {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE;
    return availableCustomerRows.slice(from, to);
  }, [availableCustomerRows, page]);

  const eligibleSelectedCustomers = useMemo(
    () => selectedCustomerRows.map(({ customer }) => customer).filter((customer) => customer.profileId),
    [selectedCustomerRows]
  );

  const selectedCount = selectedCustomerRows.length;
  const parsedDiscount = Number(discountPercentage);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(availableCustomerRows.length / PAGE_SIZE) - 1);
    setHasMore(page < maxPage);
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [availableCustomerRows.length, page]);

  const toggleCustomer = (customer: MarketingCustomer) => {
    const profileId = customer.profileId;
    if (!profileId) return;

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
      const result = await generateMarketingCampaign(parsedDiscount || 10);
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
    setSendingChannel(channel);
    setError(null);
    setResultMessage(null);
    try {
      if (channel === 'email' && (!subject || !emailBody)) {
        Alert.alert('Send Email', 'Please generate or enter the email subject and email body first.');
        return;
      }
      if (channel === 'sms' && !smsBody) {
        Alert.alert('Send SMS', 'Please generate or enter the SMS body first.');
        return;
      }

      const payloadCustomers = eligibleSelectedCustomers.map((customer) => ({
        id: customer.profileId!,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
      }));

      const result = await sendMarketingCampaign({
        customers: payloadCustomers,
        discountPercentage: parsedDiscount || 10,
        subject,
        htmlBody: emailBody,
        smsBody,
        channels: [channel],
      });

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

      setSelectedCustomers(new Map());
      await loadCustomers(debouncedQuery, page);
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
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
          setRefreshing(true);
          void loadCustomers(debouncedQuery, page);
        }} />}
      >
        <Surface style={styles.panel} elevation={1}>
          <Text variant="titleMedium" style={styles.panelTitle}>Campaign</Text>
          <View style={styles.row}>
            <TextInput
              mode="outlined"
              label="Discount %"
              value={discountPercentage}
              onChangeText={setDiscountPercentage}
              keyboardType="number-pad"
              style={styles.discountInput}
            />
            <Button mode="contained" onPress={handleGenerateContent} loading={generatingContent} disabled={generatingContent}>
              Generate Copy
            </Button>
            <Button mode="outlined" onPress={handleGenerateImage} loading={generatingImage} disabled={generatingImage || !subject}>
              Generate Image
            </Button>
          </View>

          <HelperText type="info" visible>
            Email and SMS are sent separately. Server-side rules still respect opt-in and skip recent duplicates.
          </HelperText>

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
        </Surface>

        <Surface style={styles.panel} elevation={1}>
          <Text variant="titleMedium" style={styles.panelTitle}>Recipients</Text>
          <Searchbar
            placeholder="Search customers"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchbar}
          />

          <View style={styles.contactFilterRow}>
            <Text style={styles.contactFilterLabel}>Show customers with</Text>
            <Checkbox.Item
              label="Email"
              status={contactFilters.email ? 'checked' : 'unchecked'}
              onPress={() => setContactFilters((current) => ({ ...current, email: !current.email }))}
              style={styles.contactFilterItem}
            />
            <Checkbox.Item
              label="Phone"
              status={contactFilters.phone ? 'checked' : 'unchecked'}
              onPress={() => setContactFilters((current) => ({ ...current, phone: !current.phone }))}
              style={styles.contactFilterItem}
            />
          </View>

          <SegmentedButtons
            value={sortOption}
            onValueChange={(value) => setSortOption(value as SortOption)}
            buttons={[
              { value: 'last-order', label: 'Last order' },
              { value: 'last-email', label: 'Last email' },
              { value: 'last-sms', label: 'Last SMS' },
              { value: 'total-orders', label: 'Total orders' },
            ]}
            style={styles.segmented}
          />

          <View style={styles.sortDirectionRow}>
            <Text style={styles.sortDirectionLabel}>Direction</Text>
            <SegmentedButtons
              value={sortDirection}
              onValueChange={(value) => setSortDirection(value as SortDirection)}
              buttons={[
                { value: 'asc', label: 'Asc' },
                { value: 'desc', label: 'Desc' },
              ]}
              style={styles.sortDirectionButtons}
            />
          </View>

          <View style={styles.selectionSummaryRow}>
            <Button
              mode="text"
              onPress={() => setSelectedCustomers((current) => {
                const next = new Map(current);
                for (const { customer } of pagedAvailableCustomerRows) {
                  if (customer.profileId) {
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

          <View style={styles.dualListWrapper}>
            <CustomerTable
              title={`Selected (${selectedCustomerRows.length})`}
              rows={selectedCustomerRows}
              selected
              emptyText="Selected customers will appear here."
              onToggleCustomer={toggleCustomer}
            />
            <CustomerTable
              title={`Available (${availableCustomerRows.length})`}
              rows={pagedAvailableCustomerRows}
              selected={false}
              emptyText="No more visible customers to add."
              onToggleCustomer={toggleCustomer}
            />
          </View>

          {!loading && sortedCustomerRows.length === 0 ? (
            <Text style={styles.emptyText}>No customers found for this search.</Text>
          ) : null}
        </Surface>

        {error ? <HelperText type="error" visible>{error}</HelperText> : null}
        {resultMessage ? <HelperText type="info" visible>{resultMessage}</HelperText> : null}

        <View style={styles.sendActions}>
          <Button
            mode="contained"
            onPress={() => handleSend('email')}
            loading={sendingChannel === 'email'}
            disabled={sendingChannel !== null || selectedCount === 0 || !subject || !emailBody}
            style={[styles.sendButton, styles.sendButtonHalf]}
          >
            Send Email
          </Button>
          <Button
            mode="outlined"
            onPress={() => handleSend('sms')}
            loading={sendingChannel === 'sms'}
            disabled={sendingChannel !== null || selectedCount === 0 || !smsBody}
            style={[styles.sendButton, styles.sendButtonHalf]}
          >
            Send SMS
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fb',
  },
  appbar: {
    backgroundColor: '#0f766e',
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
  contactFilterLabel: {
    color: '#334155',
    fontWeight: '600',
  },
  contactFilterItem: {
    flexGrow: 1,
    minWidth: 110,
    paddingVertical: 0,
  },
  segmented: {
    marginBottom: 12,
  },
  sortDirectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  sortDirectionLabel: {
    color: '#334155',
    fontWeight: '600',
  },
  sortDirectionButtons: {
    flexGrow: 1,
    minWidth: 140,
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
  dualListWrapper: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
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
  checkboxCell: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerCell: {
    flex: 1,
    minWidth: 0,
    flexBasis: 160,
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
