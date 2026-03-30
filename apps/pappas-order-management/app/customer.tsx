import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, FlatList, ActivityIndicator, Modal, TouchableWithoutFeedback, Linking, Alert } from 'react-native';
import { 
    Text, 
    Avatar, 
    Card, 
    IconButton, 
    Divider, 
    Chip, 
    Surface,
    useTheme,
    MD3Theme
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fetchCustomerSummary, CustomerSummary } from './utils/customerSummary';

const STATUS_COLORS: Record<string, string> = {
    pending: '#f59e0b',
    confirmed: '#3b82f6',
    preparing: '#8b5cf6',
    ready: '#10b981',
    completed: '#6b7280',
    cancelled: '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    preparing: 'Preparing',
    ready: 'Ready',
    completed: 'Completed',
    cancelled: 'Cancelled',
};

export function CustomerModal({
    email, phone, visible, onClose
}: {
    email?: string;
    phone?: string;
    visible: boolean;
    onClose: () => void;
}) {
    const [customer, setCustomer] = useState<CustomerSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
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
                                <FlatList
                                    data={customer.orders}
                                    keyExtractor={(item) => item.id}
                                    ListHeaderComponent={renderHeader}
                                    contentContainerStyle={{ paddingBottom: 40 }}
                                    renderItem={({ item }) => (
                                        <View style={{ paddingHorizontal: 20 }}>
                                            <Card style={styles.orderCard} mode="contained">
                                                <Card.Content style={styles.orderCardContent}>
                                                    <View style={styles.orderInfo}>
                                                        <Text variant="titleSmall" style={styles.orderNumber}>#{item.orderNumber}</Text>
                                                        <Text variant="bodySmall" style={styles.orderDate}>{formatDate(item.date)}</Text>
                                                    </View>
                                                    <View style={styles.orderMeta}>
                                                        <Text variant="titleSmall" style={styles.orderPrice}>${item.total.toFixed(2)}</Text>
                                                        <Chip 
                                                            compact 
                                                            textStyle={{ fontSize: 10, color: '#fff' }} 
                                                            style={[styles.statusChip, { backgroundColor: STATUS_COLORS[item.status] || '#64748b' }]}
                                                        >
                                                            {STATUS_LABELS[item.status] || item.status}
                                                        </Chip>
                                                    </View>
                                                </Card.Content>
                                            </Card>
                                        </View>
                                    )}
                                />
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
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
    },
    orderInfo: {
        flex: 1,
    },
    orderNumber: {
        fontWeight: 'bold',
        color: '#1e293b',
    },
    orderDate: {
        color: '#64748b',
    },
    orderMeta: {
        alignItems: 'flex-end',
    },
    orderPrice: {
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 4,
    },
    statusChip: {
        height: 22,
    },
    emptyText: {
        color: '#94a3b8',
        textAlign: 'center',
        fontStyle: 'italic',
        marginTop: 10,
    },
});


