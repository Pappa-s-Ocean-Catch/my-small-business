import * as React from 'react';
import { Html, Head, Preview, Body, Container, Section, Text, Heading, Img } from '@react-email/components';

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
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={headerStyle}>
            <div style={brandRowStyle as React.CSSProperties}>
              {logoUrl ? (
                <Img src={logoUrl} alt={companyName} width={24} height={24} style={{ borderRadius: 6 }} />
              ) : null}
              <Text style={brandNameStyle}>{companyName}</Text>
            </div>
            <Text style={subtitleStyle}>{title}</Text>
          </Section>

          <Section style={contentStyle}>
            {children}
          </Section>

          <Section style={footerStyle}>
            <Text style={footerTextStyle}>{footerText}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const bodyStyle = { backgroundColor: '#f6f8fb', padding: '24px' } as const;
const containerStyle = { maxWidth: 560, margin: '0 auto', backgroundColor: '#ffffff', borderRadius: 12, overflow: 'hidden' } as const;
const headerStyle = { padding: '20px 24px', backgroundColor: '#0ea5e9', color: '#ffffff' } as const;
const brandRowStyle = { display: 'flex', alignItems: 'center', gap: 12 };
const brandNameStyle = { fontWeight: 700, fontSize: 16, color: '#ffffff', margin: 0 } as const;
const subtitleStyle = { marginTop: 4, fontSize: 12, color: '#e6f6ff', marginBottom: 0 } as const;
const contentStyle = { padding: '24px' } as const;
const footerStyle = { padding: '16px 24px', backgroundColor: '#f9fafb' } as const;
const footerTextStyle = { color: '#6b7280', fontSize: 12, textAlign: 'center' as const, margin: 0 } as const;


