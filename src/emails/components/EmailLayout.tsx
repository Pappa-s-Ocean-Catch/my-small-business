import * as React from 'react';
import { Html, Head, Preview, Body, Container, Section, Text, Img } from '@react-email/components';
import { Tailwind } from '@react-email/tailwind';

type EmailLayoutProps = {
  title: string;
  children: React.ReactNode;
  companyName?: string;
  logoUrl?: string;
  footerText?: string;
  previewText?: string;
};

export function EmailLayout({
  title,
  children,
  companyName = 'OperateFlow',
  logoUrl = `${process.env.NEXT_PUBLIC_SITE_URL || ''}/favicon.ico`,
  footerText = '© OperateFlow. All rights reserved.',
  previewText,
}: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      {previewText ? <Preview>{previewText}</Preview> : null}
      <Body className="bg-gray-100 p-6">
        <Tailwind>
          <Container className="max-w-2xl mx-auto bg-white rounded-xl overflow-hidden shadow-lg">
            <Section className="bg-blue-500 text-white p-5">
              <Section className="flex items-center gap-3">
                {logoUrl && (
                  <Img 
                    src={logoUrl} 
                    alt={companyName} 
                    width={24} 
                    height={24} 
                    className="rounded" 
                  />
                )}
                <Text className="font-bold text-lg text-white m-0">{companyName}</Text>
              </Section>
              <Text className="mt-1 text-sm text-blue-100 mb-0">{title}</Text>
            </Section>

            <Section className="p-6">
              {children}
            </Section>

            <Section className="bg-gray-50 p-4 text-center">
              <Text className="text-gray-500 text-xs m-0">{footerText}</Text>
            </Section>
          </Container>
        </Tailwind>
      </Body>
    </Html>
  );
}