import { EmailLayout } from "./components/EmailLayout";

interface PasswordResetProps {
  resetUrl: string;
  userEmail: string;
}

export const PasswordReset = ({ resetUrl, userEmail }: PasswordResetProps) => {
  return (
    <EmailLayout title="Password Reset">
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <h1 style={{ 
          color: '#1f2937', 
          fontSize: '28px', 
          fontWeight: 'bold', 
          marginBottom: '16px' 
        }}>
          Reset Your Password
        </h1>
        
        <p style={{ 
          color: '#6b7280', 
          fontSize: '16px', 
          lineHeight: '1.6', 
          marginBottom: '32px' 
        }}>
          You requested to reset your password for your OperateFlow account.
        </p>
        
        <div style={{ 
          backgroundColor: '#f9fafb', 
          border: '1px solid #e5e7eb', 
          borderRadius: '8px', 
          padding: '24px', 
          marginBottom: '32px' 
        }}>
          <p style={{ 
            color: '#374151', 
            fontSize: '14px', 
            marginBottom: '16px' 
          }}>
            <strong>Account:</strong> {userEmail}
          </p>
          <p style={{ 
            color: '#6b7280', 
            fontSize: '14px', 
            margin: '0' 
          }}>
            Click the button below to reset your password. This link will expire in 1 hour.
          </p>
        </div>
        
        <a 
          href={resetUrl}
          style={{
            display: 'inline-block',
            backgroundColor: '#1f2937',
            color: '#ffffff',
            padding: '12px 32px',
            borderRadius: '8px',
            textDecoration: 'none',
            fontSize: '16px',
            fontWeight: '600',
            marginBottom: '32px'
          }}
        >
          Reset Password
        </a>
        
        <div style={{ 
          borderTop: '1px solid #e5e7eb', 
          paddingTop: '24px', 
          marginTop: '32px' 
        }}>
          <p style={{ 
            color: '#9ca3af', 
            fontSize: '12px', 
            lineHeight: '1.5' 
          }}>
            If you didn&apos;t request this password reset, you can safely ignore this email.<br/>
            The link will expire in 1 hour for security reasons.
          </p>
        </div>
      </div>
    </EmailLayout>
  );
};
