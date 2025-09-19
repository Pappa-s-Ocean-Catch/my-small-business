import * as React from 'react';
import { EmailLayout } from './components/EmailLayout';

export function MagicLinkInviteEmail({ inviteeEmail, actionUrl, isExistingUser = false }: { inviteeEmail: string; actionUrl: string; isExistingUser?: boolean }) {
  return (
    <EmailLayout title="You're invited to OperateFlow" companyName="OperateFlow" previewText="Your OperateFlow sign-in link">
      <p style={{ margin: 0, fontSize: 14, color: '#111827' }}>Hello,</p>
      {isExistingUser ? (
        <p style={{ margin: '12px 0 0', fontSize: 14, color: '#374151' }}>
          Here is your secure sign-in link for <strong>OperateFlow</strong>.
        </p>
      ) : (
        <p style={{ margin: '12px 0 0', fontSize: 14, color: '#374151' }}>
          You&apos;ve been invited to join <strong>OperateFlow</strong> with the email <strong>{inviteeEmail}</strong>.
        </p>
      )}
      <p style={{ margin: '12px 0 0', fontSize: 14, color: '#374151' }}>
        Click the button below to securely sign in.
      </p>
      <div style={{ marginTop: 16 }}>
        <a href={actionUrl} style={{ display: 'inline-block', background: '#0ea5e9', color: '#ffffff', textDecoration: 'none', padding: '10px 14px', borderRadius: 10, fontWeight: 600, fontSize: 14 }}>
          Sign in to OperateFlow
        </a>
      </div>
      <p style={{ margin: '16px 0 0', fontSize: 12, color: '#6b7280' }}>
        If you didn’t request this, you can safely ignore this email.
      </p>
    </EmailLayout>
  );
}


