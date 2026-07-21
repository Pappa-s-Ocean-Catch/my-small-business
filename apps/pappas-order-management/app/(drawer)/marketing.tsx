import React, { useEffect, useMemo, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Button, Card, Checkbox, Chip, HelperText, List, Searchbar, SegmentedButtons, Surface, Text, TextInput } from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { Customer, getRecentCustomers, searchCustomers } from '@/lib/customers';
import { generateMarketingCampaign, generateMarketingImage, sendMarketingCampaign, type MarketingChannel } from '@/lib/marketing';

type MarketingCustomer = Customer & {
  profileId?: string;
  optInMarketing?: boolean;
  lastMarketingEmailSentAt?: string | null;
  lastMarketingSmsSentAt?: string | null;
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

export default function MarketingScreen() {
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [customers, setCustomers] = useState<MarketingCustomer[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [discountPercentage, setDiscountPercentage] = useState('10');
  const [subject, setSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [smsBody, setSmsBody] = useState('');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [channels, setChannels] = useState<MarketingChannel[]>(['email']);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingContent, setGeneratingContent] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(searchQuery), 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const loadCustomers = async (query = debouncedQuery) => {
    setLoading(true);
    setError(null);
    try {
      const response = query.trim()
        ? await searchCustomers(query, 0, PAGE_SIZE)
        : await getRecentCustomers(0, PAGE_SIZE);
      if (response.error) {
        throw new Error(response.error);
      }
      setCustomers((response.data || []) as MarketingCustomer[]);
    } catch (loadError: any) {
      setError(loadError?.message || 'Failed to load customers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      void loadCustomers(debouncedQuery);
    }, [debouncedQuery])
  );

  const eligibleSelectedCustomers = useMemo(
    () => customers.filter((customer) => customer.profileId && selectedIds.has(customer.profileId)),
    [customers, selectedIds]
  );

  const selectedCount = eligibleSelectedCustomers.length;
  const parsedDiscount = Number(discountPercentage);
  const requiresEmailContent = channels.includes('email');
  const requiresSmsContent = channels.includes('sms');

  const toggleChannel = (channel: MarketingChannel) => {
    setChannels((current) => {
      if (current.includes(channel)) {
        return current.filter((item) => item !== channel);
      }
      return [...current, channel];
    });
  };

  const toggleCustomer = (profileId?: string) => {
    if (!profileId) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(profileId)) next.delete(profileId);
      else next.add(profileId);
      return next;
    });
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
    } catch (generateError: any) {
      setError(generateError?.message || 'Failed to generate campaign content');
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
      setError(imageError?.message || 'Failed to generate campaign image');
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleSend = async () => {
    setSending(true);
    setError(null);
    setResultMessage(null);
    try {
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
        channels,
      });

      const success = result.results?.filter((item) => item.success).length || 0;
      const failed = result.results?.filter((item) => !item.success).length || 0;
      setResultMessage(`Campaign processed. Success: ${success}. Failed or skipped: ${failed}.`);
      setSelectedIds(new Set());
      await loadCustomers(debouncedQuery);
    } catch (sendError: any) {
      setError(sendError?.message || 'Failed to send campaign');
    } finally {
      setSending(false);
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
          void loadCustomers(debouncedQuery);
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

          <View style={styles.channelRow}>
            <Chip selected={channels.includes('email')} onPress={() => toggleChannel('email')} icon="email-outline">Email</Chip>
            <Chip selected={channels.includes('sms')} onPress={() => toggleChannel('sms')} icon="message-outline">SMS</Chip>
          </View>
          <HelperText type={channels.length === 0 ? 'error' : 'info'} visible>
            {channels.length === 0 ? 'Select at least one channel.' : 'Server-side rules will respect opt-in and skip recent duplicate sends.'}
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

          <SegmentedButtons
            value={selectedCount > 0 && selectedCount === customers.filter((customer) => customer.profileId).length ? 'all' : 'custom'}
            onValueChange={(value) => {
              if (value === 'all') {
                setSelectedIds(new Set(customers.map((customer) => customer.profileId).filter(Boolean) as string[]));
              } else {
                setSelectedIds(new Set());
              }
            }}
            buttons={[
              { value: 'all', label: 'Select all' },
              { value: 'custom', label: 'Clear' },
            ]}
            style={styles.segmented}
          />

          {customers.map((customer) => {
            const profileId = customer.profileId;
            const selected = profileId ? selectedIds.has(profileId) : false;
            return (
              <List.Item
                key={profileId || `${customer.email}-${customer.phone}`}
                title={customer.name || 'Customer'}
                description={`${customer.email || 'No email'} • ${customer.phone || 'No phone'}\nOpt-in: ${customer.optInMarketing === false ? 'No' : 'Yes'} • Email: ${formatDateLabel(customer.lastMarketingEmailSentAt)} • SMS: ${formatDateLabel(customer.lastMarketingSmsSentAt)}`}
                onPress={() => toggleCustomer(profileId)}
                left={() => (
                  <Checkbox status={selected ? 'checked' : 'unchecked'} disabled={!profileId} />
                )}
                right={() => customer.optInMarketing === false ? <Chip compact>Opted out</Chip> : null}
                titleNumberOfLines={1}
                descriptionNumberOfLines={3}
                style={styles.listItem}
              />
            );
          })}

          {!loading && customers.length === 0 ? (
            <Text style={styles.emptyText}>No customers found for this search.</Text>
          ) : null}
        </Surface>

        {error ? <HelperText type="error" visible>{error}</HelperText> : null}
        {resultMessage ? <HelperText type="info" visible>{resultMessage}</HelperText> : null}

        <Button
          mode="contained"
          onPress={handleSend}
          loading={sending}
          disabled={
            sending
            || selectedCount === 0
            || channels.length === 0
            || (requiresEmailContent && (!subject || !emailBody))
            || (requiresSmsContent && !smsBody)
          }
          style={styles.sendButton}
        >
          Send to {selectedCount} customer{selectedCount === 1 ? '' : 's'}
        </Button>
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
    padding: 16,
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
  channelRow: {
    flexDirection: 'row',
    gap: 10,
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
  segmented: {
    marginBottom: 12,
  },
  listItem: {
    paddingHorizontal: 0,
  },
  emptyText: {
    color: '#64748b',
    textAlign: 'center',
    paddingVertical: 24,
  },
  sendButton: {
    marginBottom: 24,
  },
});
