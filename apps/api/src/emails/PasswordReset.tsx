import * as React from 'react';
import { Button, Container, Section, Text } from '@react-email/components';
import { Tailwind } from '@react-email/tailwind';
import { EmailLayout } from './components/EmailLayout';

interface PasswordResetProps {
  resetUrl: string;
  userEmail: string;
  businessName?: string;
  logoUrl?: string;
}

export function PasswordReset({
  resetUrl,
  userEmail,
  businessName = 'Pappas Ocean Catch',
  logoUrl,
}: PasswordResetProps) {
  return (
    <EmailLayout
      title={`Reset your ${businessName} password`}
      companyName={businessName}
      logoUrl={logoUrl}
      previewText={`Your ${businessName} password reset link`}
    >
      <Tailwind>
        <Container className="max-w-lg mx-auto font-sans">
          <Section className="p-6">
            <Text className="text-base text-gray-800 m-0 mb-3">Hello,</Text>
            <Text className="text-base text-gray-600 mb-4 m-0">
              We received a request to reset the password for <strong>{userEmail}</strong>.
            </Text>
            <Text className="text-base text-gray-600 mb-4 m-0">
              Click the button below to choose a new password. This link expires in one hour.
            </Text>
            <Section className="mt-4">
              <Button
                href={resetUrl}
                className="inline-block bg-blue-500 text-white no-underline px-4 py-3 rounded-lg font-semibold text-sm"
              >
                Reset password
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
