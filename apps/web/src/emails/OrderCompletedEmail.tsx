import * as React from 'react';
import { EmailLayout } from './components/EmailLayout';
import { Tailwind } from '@react-email/tailwind';
import { Container, Section, Text } from '@react-email/components';

interface OrderCompletedEmailProps {
    customerName?: string | null;
    orderNumber: string;
    businessName?: string;
    logoUrl?: string;
}

export const OrderCompletedEmail = ({
    customerName,
    orderNumber,
    businessName = 'OperateFlow',
    logoUrl,
}: OrderCompletedEmailProps) => {
    const greetingName = customerName && customerName.trim().length > 0 ? customerName : 'there';
    return (
        <EmailLayout
            title={`${businessName} - Order Completed`}
            companyName={businessName}
            logoUrl={logoUrl}
            previewText={`Order #${orderNumber} is completed. Please leave a review!`}
        >
            <Tailwind>
                <Container className="max-w-lg mx-auto font-sans">
                    <Section className="p-0">
                        <Text className="text-base text-gray-800 m-0 mb-3">
                            Hi {greetingName},
                        </Text>
                        <Text className="text-base text-gray-700 mb-4 m-0">
                            Your order <strong>#{orderNumber}</strong> has been <strong>completed</strong> and picked up.
                        </Text>
                        <Text className="text-base text-gray-700 mb-4 m-0">
                            <strong>We value your feedback!</strong> Please let us know how we did:
                            <br />
                            <a
                                href={`${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.pappasfishnchips.com.au'}/order/confirmation?order=${orderNumber}&review=1`}
                                style={{
                                    display: 'inline-block',
                                    marginTop: '8px',
                                    padding: '10px 20px',
                                    backgroundColor: '#2563eb',
                                    color: '#fff',
                                    borderRadius: '6px',
                                    textDecoration: 'none',
                                    fontWeight: 600,
                                }}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Leave a Review
                            </a>
                        </Text>
                        <Text className="text-base text-gray-700 mb-0 m-0">
                            Thank you for ordering with {businessName}.
                        </Text>
                    </Section>
                </Container>
            </Tailwind>
        </EmailLayout>
    );
};
