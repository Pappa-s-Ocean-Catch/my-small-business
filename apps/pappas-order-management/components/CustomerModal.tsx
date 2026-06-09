import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Modal, TouchableWithoutFeedback, Linking, Alert } from 'react-native';
import { 
    Text, 
    Avatar, 
    Card, 
    IconButton, 
    Divider, 
    Surface,
    Button,
    useTheme,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { OrderStatus } from '@my-small-business/types';
import { fetchCustomerSummary, CustomerSummary } from '@/utils/customerSummary';
import { getFriendlyOrderNumber } from '../utils/orderNumber';
import { STATUS_COLORS, STATUS_LABELS } from '../utils/constants';
import { getApiUrl } from '../utils/orderUtils';

function orderStatusColor(status: string): string {
    if (Object.prototype.hasOwnProperty.call(STATUS_COLORS, status)) {
        return STATUS_COLORS[status as OrderStatus];
    }
    return '#64748b';
}

function orderStatusLabel(status: string): string {
    if (Object.prototype.hasOwnProperty.call(STATUS_LABELS, status)) {
        return STATUS_LABELS[status as OrderStatus];
    }
    return status.replace(/_/g, ' ');
}

export function CustomerModal({
    email,
    phone,
    visible,
    onClose,
    onOrderPress,
}: {
    email?: string;
    phone?: string;
    visible: boolean;
    onClose: () => void;
    /** Open the same order detail UI as the order list (e.g. OrderDetailModal). */
    onOrderPress: (orderId: string) => void;
}) {
    const [customer, setCustomer] = useState<CustomerSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sendingMarketing, setSendingMarketing] = useState(false);
    const theme = useTheme();

    useEffect(() => {
        if (!visible) return;
        setLoading(true);
        setError(null);
        setCustomer(null);
        fetchCustomerSummary({ email, phone })
            .then((data) => {
                setCustomer(data);
                setLoading(false);
                if (!data) setError('No customer data found for this contact.');
            })
            .catch((err) => {
                setError('Failed to load customer details. Please try again.');
                setLoading(false);
            });
    }, [email, phone, visible]);

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || '??';
    };

    const formatDate = (dateString: string) => {
        try {
            return new Date(dateString).toLocaleDateString('en-AU', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
        } catch (e) {
            return dateString;
        }
    };

    const handleCall = (phoneNumber: string) => {
        if (!phoneNumber) return;
        const url = `tel:${phoneNumber.replace(/\s+/g, '')}`;
        Linking.canOpenURL(url).then(supported => {
            if (supported) {
                Linking.openURL(url);
            } else {
                Alert.alert('Error', 'Calling is not supported on this device.');
            }
        });
    };

    const handleEmail = (emailAddress: string) => {
        if (!emailAddress) return;
        const url = `mailto:${emailAddress}`;
        Linking.canOpenURL(url).then(supported => {
            if (supported) {
                Linking.openURL(url);
            } else {
                Alert.alert('Error', 'No email app found on this device.');
            }
        });
    };

    const handleSendMarketing = async () => {
        if (!customer?.profileId) {
            Alert.alert('Error', 'This customer does not have a registered profile ID and cannot receive marketing emails.');
            return;
        }

        Alert.alert(
            'Confirm',
            `Send a marketing email with a 1-time coupon to ${customer.name}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Send',
                    onPress: async () => {
                        setSendingMarketing(true);
                        try {
                            const url = getApiUrl('/api/marketing/send');
                            const response = await fetch(url, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ customerIds: [customer.profileId] }),
                            });

                            const result = await response.json();
                            if (!response.ok) {
                                throw new Error(result.error || 'Failed to send marketing email');
                            }

                            Alert.alert('Success', `Marketing email sent successfully to ${customer.name}`);
                        } catch (err: any) {
                            Alert.alert('Error', err.message);
                        } finally {
                            setSendingMarketing(false);
                        }
                    }
                }
            ]
        );
    };

    const renderHeader = () => {
        if (!customer) return null;
        return (
            <View>
                {/* Phone Section (Callable) */}
                {customer.phone && (
                    <View style={styles.phoneActionBox}>
                        <View style={styles.phoneNumberContainer}>
                            <MaterialCommunityIcons name="phone" size={24} color={theme.colors.primary} />
                            <Text variant="titleLarge" style={styles.phoneNumberText}>
                                {customer.phone}
                            </Text>
                        </View>
                        <IconButton 
                            icon="phone-outline"
                            mode="contained"
                            containerColor={theme.colors.primary}
                            iconColor="#fff"
                            size={28}
                            onPress={() => handleCall(customer.phone)}
                        />
                    </View>
                )}

                {/* Stats Strip */}
                <View style={styles.statsContainer}>
                    <View style={styles.statBox}>
                        <MaterialCommunityIcons name="cart-outline" size={20} color={theme.colors.primary} />
                        <Text variant="titleMedium" style={styles.statValue}>{customer.totalOrders}</Text>
                        <Text variant="labelSmall" style={styles.statLabel}>Orders</Text>
                    </View>
                    <View style={styles.statBox}>
                        <MaterialCommunityIcons name="currency-usd" size={20} color="#16a34a" />
                        <Text variant="titleMedium" style={styles.statValue}>${customer.totalAmount.toFixed(2)}</Text>
                        <Text variant="labelSmall" style={styles.statLabel}>Spent</Text>
                    </View>
                    <View style={styles.statBox}>
                        <MaterialCommunityIcons name="star-outline" size={20} color="#ca8a04" />
                        <Text variant="titleMedium" style={styles.statValue}>{customer.rewardPoints}</Text>
                        <Text variant="labelSmall" style={styles.statLabel}>Points</Text>
                    </View>
                </View>

                {/* Info Section */}
                <View style={styles.section}>
                    <View style={styles.infoRow}>
                        <MaterialCommunityIcons name="calendar-account" size={18} color="#64748b" />
                        <Text variant="bodyMedium" style={styles.infoText}>
                            Member since: <Text style={styles.bold}>{formatDate(customer.signUpDate)}</Text>
                        </Text>
                    </View>
                    <View style={styles.infoRow}>
                        <MaterialCommunityIcons name="clock-outline" size={18} color="#64748b" />
                        <Text variant="bodyMedium" style={styles.infoText}>
                            Last order: <Text style={styles.bold}>{formatDate(customer.lastOrderDate)}</Text>
                        </Text>
                    </View>
                </View>

                {/* Actions Section */}
                <View style={styles.section}>
                    <Button
                        mode="contained-tonal"
                        icon="email-fast"
                        loading={sendingMarketing}
                        disabled={sendingMarketing || !customer.profileId}
                        onPress={handleSendMarketing}
                        style={{ marginTop: 8 }}
                    >
                        Send Marketing Email
                    </Button>
                </View>

                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>Recent Orders</Text>
                    {customer.orders.length === 0 && (
                        <Text variant="bodyMedium" style={styles.emptyText}>No recent orders found.</Text>
                    )}
                </View>
            </View>
        );
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.modalBackdrop}>
                    <TouchableWithoutFeedback>
                        <Surface style={styles.modalContent} elevation={5}>
                            {/* Header Section (Fixed) */}
                            <View style={styles.header}>
                                <View style={styles.headerInfo}>
                                    <Avatar.Text 
                                        size={56} 
                                        label={customer ? getInitials(customer.name) : '??'} 
                                        style={styles.avatar}
                                    />
                                    <View style={styles.headerTextContainer}>
                                        <Text variant="headlineSmall" style={styles.customerName}>
                                            {loading ? 'Loading...' : customer?.name || 'Customer Summary'}
                                        </Text>
                                        <View style={styles.contactRow}>
                                            {customer?.email ? (
                                                <Text 
                                                    style={styles.customerContact} 
                                                    onPress={() => handleEmail(customer.email)}
                                                >
                                                    {customer.email}
                                                </Text>
                                            ) : (
                                                <Text style={{ color: '#64748b' }}>{email || phone || 'Details'}</Text>
                                            )}
                                        </View>
                                    </View>
                                </View>
                                <IconButton 
                                    icon="close" 
                                    size={24} 
                                    onPress={onClose} 
                                    style={styles.closeIcon}
                                />
                            </View>

                            <Divider />

                            {loading && (
                                <View style={styles.centerContainer}>
                                    <ActivityIndicator size="large" color={theme.colors.primary} />
                                    <Text style={styles.loadingText}>Fetching profile...</Text>
                                </View>
                            )}

                            {error && (
                                <View style={styles.centerContainer}>
                                    <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#ef4444" />
                                    <Text style={styles.errorText}>{error}</Text>
                                </View>
                            )}

                             {!loading && !error && customer && (
                                <ScrollView 
                                    style={{ flexShrink: 1 }} 
                                    contentContainerStyle={{ paddingBottom: 40 }}
                                    showsVerticalScrollIndicator={true}
                                >
                                    {renderHeader()}
                                    {customer.orders.map((item) => (
                                        <View key={item.id} style={{ paddingHorizontal: 20 }}>
                                            <Card
                                                style={styles.orderCard}
                                                mode="contained"
                                                onPress={() => onOrderPress(item.id)}
                                            >
                                                <Card.Content style={styles.orderCardContent}>
                                                    <View style={styles.orderTopRow}>
                                                        <View style={styles.orderInfo}>
                                                            <Text variant="titleSmall" style={styles.orderNumber}>
                                                                {getFriendlyOrderNumber(item.orderNumber)}
                                                            </Text>
                                                            <View style={styles.orderDateStatusRow}>
                                                                <Text variant="bodySmall" style={styles.orderDateMuted}>
                                                                    {formatDate(item.date)}
                                                                </Text>
                                                                <Text
                                                                    variant="bodySmall"
                                                                    style={[
                                                                        styles.orderStatusLabel,
                                                                        { color: orderStatusColor(item.status) },
                                                                    ]}
                                                                >
                                                                    {orderStatusLabel(item.status)}
                                                                </Text>
                                                            </View>
                                                        </View>
                                                        <View style={styles.orderPriceChevron}>
                                                            <Text variant="titleSmall" style={styles.orderPrice}>
                                                                ${item.total.toFixed(2)}
                                                            </Text>
                                                            <MaterialCommunityIcons name="chevron-right" size={18} color="#94a3b8" />
                                                        </View>
                                                    </View>
                                                </Card.Content>
                                            </Card>
                                        </View>
                                    ))}
                                </ScrollView>
                            )}
                        </Surface>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 24,
        width: '90%',
        maxWidth: 500,
        maxHeight: '85%',
        minHeight: 200,
        flexShrink: 1,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 20,
        backgroundColor: '#f8fafc',
    },
    headerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatar: {
        backgroundColor: '#e2e8f0',
        marginRight: 16,
    },
    headerTextContainer: {
        flex: 1,
    },
    customerName: {
        fontWeight: 'bold',
        color: '#1e293b',
    },
    contactRow: {
        marginTop: 2,
    },
    customerContact: {
        color: '#2563eb',
        textDecorationLine: 'underline',
    },
    closeIcon: {
        margin: 0,
    },
    centerContainer: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 12,
        color: '#64748b',
    },
    errorText: {
        marginTop: 12,
        color: '#ef4444',
        textAlign: 'center',
    },
    phoneActionBox: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        margin: 20,
        padding: 16,
        backgroundColor: '#eff6ff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#bfdbfe',
    },
    phoneNumberContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    phoneNumberText: {
        marginLeft: 12,
        fontWeight: 'bold',
        color: '#1e3a8a',
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        padding: 20,
        paddingTop: 0,
        backgroundColor: '#fff',
    },
    statBox: {
        alignItems: 'center',
        padding: 10,
        flex: 1,
    },
    statValue: {
        fontWeight: 'bold',
        marginTop: 4,
        color: '#1e293b',
    },
    statLabel: {
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    section: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    sectionTitle: {
        fontWeight: 'bold',
        marginBottom: 12,
        color: '#1e293b',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    infoText: {
        marginLeft: 10,
        color: '#64748b',
    },
    bold: {
        fontWeight: 'bold',
        color: '#1e293b',
    },
    orderCard: {
        marginBottom: 10,
        borderRadius: 12,
        backgroundColor: '#f8fafc',
    },
    orderCardContent: {
        paddingVertical: 10,
    },
    orderTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 10,
    },
    orderInfo: {
        flex: 1,
        minWidth: 0,
    },
    orderDateStatusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
        width: '100%',
        gap: 8,
    },
    orderDateMuted: {
        color: '#64748b',
        flexShrink: 0,
    },
    orderStatusLabel: {
        fontWeight: '600',
        textAlign: 'right',
        flexGrow: 1,
        flexShrink: 1,
        minWidth: 0,
    },
    orderPriceChevron: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        flexShrink: 0,
    },
    orderNumber: {
        fontWeight: 'bold',
        color: '#1e293b',
    },
    orderPrice: {
        fontWeight: 'bold',
        color: '#1e293b',
    },
    emptyText: {
        color: '#94a3b8',
        textAlign: 'center',
        fontStyle: 'italic',
        marginTop: 10,
    },
});


