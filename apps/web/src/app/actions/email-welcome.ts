import { getBrandSettings } from '@/lib/brand-settings';
const resend = process.env.RESEND_API_KEY ? new (require('resend').Resend)(process.env.RESEND_API_KEY) : null;

const getEmailOverride = (originalEmail: string): string => {
    return process.env.OVERRIDE_EMAIL_ADDRESS || originalEmail;
};

export async function sendWelcomeEmail({ email, fullName }: { email: string; fullName?: string }) {
    try {
        if (!resend || !process.env.RESEND_API_KEY) {
            throw new Error('RESEND_API_KEY is not configured');
        }
        const brandSettings = await getBrandSettings();
        const businessName = brandSettings?.business_name || 'OperateFlow';
        const logoUrl = brandSettings?.logo_url;
        const emailTo = getEmailOverride(email);
        const emailFrom = process.env.EMAIL_FROM!;
        const { data, error } = await resend.emails.send({
            from: emailFrom,
            to: [emailTo],
            subject: `Welcome to ${businessName}!`,
            react: require('@/emails/WelcomeEmail').WelcomeEmail({
                fullName,
                businessName,
                logoUrl: logoUrl || undefined,
            }),
        });
        if (error) {
            console.error('Error sending welcome email:', error);
            return { success: false, error: error.message };
        }
        console.log('[WelcomeEmail] Sent welcome email to:', emailTo, 'messageId:', data?.id);
        return { success: true, messageId: data?.id };
    } catch (error) {
        console.error('Error in sendWelcomeEmail:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
    }
}
