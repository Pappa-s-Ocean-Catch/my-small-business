import * as React from 'react';
import { EmailLayout } from './components/EmailLayout';
import { Tailwind } from '@react-email/tailwind';
import { Container, Section, Text } from '@react-email/components';

export function WelcomeEmail({ fullName, businessName = "Pappa's Ocean Catch", logoUrl }: { fullName?: string; businessName?: string; logoUrl?: string }) {
    const websiteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pappasfishnchips.com.au';
    const shopPhone = '+61397438150';
    const greetingName = fullName && fullName.trim().length > 0 ? fullName : 'there';
    return (
        <EmailLayout
            title={`${businessName} - Welcome!`}
            companyName={businessName}
            logoUrl={logoUrl}
            previewText={`Welcome to ${businessName}, ${greetingName}!`}
        >
            <Tailwind>
                <Container className="max-w-lg mx-auto font-sans">
                    <Section className="p-0">
                        <Text className="text-base text-gray-800 m-0 mb-3">
                            Hi {greetingName},
                        </Text>
                        <Text className="text-base text-gray-700 mb-4 m-0">
                            Thank you for signing up with <strong>{businessName}</strong>.
                        </Text>
                        <Text className="text-base text-gray-700 mb-2 m-0">
                            Your account has been created successfully. You can now place orders, track your history, and enjoy member benefits.
                        </Text>
                        <Text className="text-base text-gray-700 mb-2 m-0">
                            Visit our website: <a href={websiteUrl} style={{ color: '#2563eb', textDecoration: 'underline' }} target="_blank" rel="noopener noreferrer">{websiteUrl}</a>
                        </Text>
                        <Text className="text-base text-gray-700 mb-2 m-0">
                            If you have any questions, please call us at <a href={`tel:${shopPhone}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>{shopPhone}</a>.
                        </Text>
                        <Text className="text-base text-gray-700 mb-0 m-0 mt-4">
                            Welcome to the family, Enjoy your upcomming crispy fish!
                        </Text>
                    </Section>
                </Container>
            </Tailwind>
        </EmailLayout>
    );
}
