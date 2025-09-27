import * as React from 'react';
import { EmailLayout } from './components/EmailLayout';
import { Tailwind } from '@react-email/tailwind';
import { Container, Section, Text, Button } from '@react-email/components';

export function MagicLinkInviteEmail({ 
  inviteeEmail, 
  actionUrl, 
  isExistingUser = false,
  businessName = 'OperateFlow',
  logoUrl
}: { 
  inviteeEmail: string; 
  actionUrl: string; 
  isExistingUser?: boolean;
  businessName?: string;
  logoUrl?: string;
}) {
  return (
    <EmailLayout 
      title={`You're invited to ${businessName}`} 
      companyName={businessName} 
      logoUrl={logoUrl}
      previewText={`Your ${businessName} sign-in link`}
    >
      <Tailwind>
        <Container className="max-w-lg mx-auto font-sans">
          <Section className="p-6">
            <Text className="text-base text-gray-800 m-0 mb-3">
              Hello,
            </Text>
            {isExistingUser ? (
              <Text className="text-base text-gray-600 mb-4 m-0">
                Here is your secure sign-in link for <strong>{businessName}</strong>.
              </Text>
            ) : (
            <Text className="text-base text-gray-600 mb-4 m-0">
              You&apos;ve been invited to join <strong>{businessName}</strong> with the email <strong>{inviteeEmail}</strong>.
            </Text>
            )}
            <Text className="text-base text-gray-600 mb-4 m-0">
              Click the button below to securely sign in.
            </Text>
            <Section className="mt-4">
              <Button
                href={actionUrl}
                className="inline-block bg-blue-500 text-white no-underline px-4 py-3 rounded-lg font-semibold text-sm"
              >
                Sign in to {businessName}
              </Button>
            </Section>
            <Text className="text-xs text-gray-500 mt-4 mb-0">
              If you didn&apos;t request this, you can safely ignore this email.
            </Text>
          </Section>
        </Container>
      </Tailwind>
    </EmailLayout>
  );
}