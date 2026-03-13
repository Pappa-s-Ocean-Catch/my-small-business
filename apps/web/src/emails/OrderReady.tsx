import * as React from 'react';
import { EmailLayout } from './components/EmailLayout';
import { Tailwind } from '@react-email/tailwind';
import { Container, Section, Text } from '@react-email/components';

interface OrderReadyEmailProps {
  customerName?: string | null;
  orderNumber: string;
  pickupType: 'pickup' | 'delivery';
  businessName?: string;
  logoUrl?: string;
}

export const OrderReadyEmail = ({
  customerName,
  orderNumber,
  pickupType,
  businessName = 'OperateFlow',
  logoUrl,
}: OrderReadyEmailProps) => {
  const greetingName = customerName && customerName.trim().length > 0 ? customerName : 'there';
  const isPickup = pickupType === 'pickup';

  return (
    <EmailLayout
      title={`${businessName} - Order Ready`}
      companyName={businessName}
      logoUrl={logoUrl}
      previewText={isPickup ? 'Your order is ready for pickup.' : 'Your order is ready.'}
    >
      <Tailwind>
        <Container className="max-w-lg mx-auto font-sans">
          <Section className="p-0">
            <Text className="text-base text-gray-800 m-0 mb-3">
              Hi {greetingName},
            </Text>
            <Text className="text-base text-gray-700 mb-4 m-0">
              Your order <strong>#{orderNumber}</strong> is now <strong>ready</strong>
              {isPickup ? ' for pickup.' : '.'}
            </Text>

            {isPickup && (
              <Text className="text-base text-gray-700 mb-4 m-0">
                Please come to the counter and let our staff know your order number so we can hand it to you quickly.
              </Text>
            )}

            <Text className="text-base text-gray-700 mb-0 m-0">
              Thank you for ordering with {businessName}.
            </Text>
          </Section>
        </Container>
      </Tailwind>
    </EmailLayout>
  );
};

