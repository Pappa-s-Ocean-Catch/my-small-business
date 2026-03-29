import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, ActivityIndicator } from 'react-native';
import { fetchCustomerSummary, CustomerSummary } from './utils/customerSummary';

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

    useEffect(() => {
        if (!visible) return;
        setLoading(true);
        setError(null);
        setCustomer(null);
        fetchCustomerSummary({ email, phone })
            .then((data) => {
                setCustomer(data);
                setLoading(false);
                if (!data) setError('No customer data found.');
            })
            .catch((err) => {
                setError('Failed to load customer data.');
                setLoading(false);
            });
    }, [email, phone, visible]);

    if (!visible) return null;

    return (
        <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
                <Text style={styles.title}>Customer Summary</Text>
                {loading && <ActivityIndicator size="large" color="#2563eb" style={{ marginVertical: 24 }} />}
                {error && <Text style={{ color: 'red', marginBottom: 12 }}>{error}</Text>}
                {!loading && !error && customer && (
                    <ScrollView>
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Customer Information</Text>
                            <Text>Name: {customer.name}</Text>
                            <Text>Email: {customer.email}</Text>
                            <Text>Phone: {customer.phone}</Text>
                            <Text>Sign Up: {customer.signUpDate}</Text>
                        </View>
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Order Summary</Text>
                            <Text>Total Orders: {customer.totalOrders}</Text>
                            <Text>Last Order: {customer.lastOrderDate}</Text>
                            <Text>Total Spent: ${customer.totalAmount.toFixed(2)}</Text>
                            <Text>Reward Points: {customer.rewardPoints}</Text>
                        </View>
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Orders</Text>
                            <FlatList
                                data={customer.orders}
                                keyExtractor={item => item.id}
                                renderItem={({ item }) => (
                                    <View style={styles.orderRow}>
                                        <Text style={styles.orderNumber}>{item.orderNumber}</Text>
                                        <Text>{item.date}</Text>
                                        <Text>${item.total.toFixed(2)}</Text>
                                        <Text>{item.status}</Text>
                                    </View>
                                )}
                            />
                        </View>
                    </ScrollView>
                )}
                <Text style={styles.closeButton} onPress={onClose}>Close</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    modalBackdrop: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        width: '90%',
        maxHeight: '90%',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 12,
        textAlign: 'center',
    },
    section: {
        marginBottom: 16,
    },
    sectionTitle: {
        fontWeight: 'bold',
        marginBottom: 6,
    },
    orderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    orderNumber: {
        fontWeight: 'bold',
        marginRight: 8,
    },
    closeButton: {
        marginTop: 16,
        color: '#2563eb',
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
