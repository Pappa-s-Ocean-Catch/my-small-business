"use server";

import { Resend } from 'resend';
import { ShiftReminderEmail } from '@/emails/ShiftReminder';
import { MagicLinkInviteEmail } from '@/emails/MagicLinkInvite';
import { OrderReadyEmail } from '@/emails/OrderReady';
import { createServiceRoleClient } from '@my-small-business/supabase/server';
import { format } from 'date-fns';
import { getBrandSettings } from '@/lib/brand-settings';
import type { Order } from '@my-small-business/types';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Email override for testing - redirect all emails to test address if set
const getEmailOverride = (originalEmail: string): string => {
  return process.env.OVERRIDE_EMAIL_ADDRESS || originalEmail;
};

const shouldSkipCustomerEmail = (email: string | null | undefined): boolean => {
  const trimmed = email?.trim() ?? "";
  if (!trimmed) {
    return true;
  }
  return /^phone-\d+@no-email\.local$/i.test(trimmed);
};

export async function sendShiftReminder(
  staffEmail: string,
  staffName: string,
  shiftDate: Date,
  startTime: string,
  endTime: string
) {
  try {
    if (!resend || !process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    // Get brand settings
    const brandSettings = await getBrandSettings();
    const businessName = brandSettings?.business_name || 'OperateFlow';
    const logoUrl = brandSettings?.logo_url;

    const formattedDate = format(shiftDate, 'EEEE, MMMM do, yyyy');
    const formattedTime = `${startTime} - ${endTime}`;
    const emailTo = getEmailOverride(staffEmail);
    console.log('📧 Sending shift reminder to:', emailTo);
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: [emailTo],
      subject: `Shift Reminder - ${formattedDate}`,
      react: ShiftReminderEmail({
        staffName,
        shiftDate: formattedDate,
        shiftTime: formattedTime,
        businessName,
        logoUrl: logoUrl || undefined,
      }),
    });

    if (error) {
      console.error('Error sending email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('Error in sendShiftReminder:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

export async function sendOrderReadyEmail(order: Order) {
  try {
    if (!resend || !process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    if (shouldSkipCustomerEmail(order.customer_email)) {
      return { success: true, skipped: true as const };
    }

    const brandSettings = await getBrandSettings();
    const businessName = brandSettings?.business_name || 'OperateFlow';
    const logoUrl = brandSettings?.logo_url;

    const emailTo = getEmailOverride(order.customer_email!);
    const emailFrom = process.env.EMAIL_FROM!;

    const { data, error } = await resend.emails.send({
      from: emailFrom,
      to: [emailTo],
      subject: `Your order #${order.order_number} is ready`,
      react: OrderReadyEmail({
        customerName: order.customer_name,
        orderNumber: order.order_number,
        pickupType: order.order_type === 'delivery' ? 'delivery' : 'pickup',
        businessName,
        logoUrl: logoUrl || undefined,
      }),
    });

    if (error) {
      console.error('Error sending order ready email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('Error in sendOrderReadyEmail:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export async function sendMagicLinkInvite(inviteeEmail: string) {
  try {
    console.log('📧 Starting magic link send process for:', inviteeEmail);

    if (!resend || !process.env.RESEND_API_KEY) {
      console.error('❌ RESEND_API_KEY is not configured');
      throw new Error('RESEND_API_KEY is not configured');
    }

    console.log('✅ Resend client initialized');

    const supabase = await createServiceRoleClient();
    // Detect existing profile
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', inviteeEmail)
      .maybeSingle();

    console.log('👤 Profile check result:', { existing: !!existing, email: inviteeEmail });

    // Determine the correct redirect URL based on environment
    // In development, always use localhost; in production, use the configured URL
    const isDevelopment = process.env.NODE_ENV === 'development' ||
      !process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL.includes('localhost');
    const redirectUrl = isDevelopment
      ? 'https://localhost:3000/auth/callback'
      : `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`;

    console.log('🔗 [MagicLink] Using redirect URL:', redirectUrl);
    console.log('🔍 [MagicLink] Environment check:', {
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
      isDevelopment,
      redirectUrl
    });

    console.log('🔍 [MagicLink] Calling Supabase generateLink with:', {
      type: 'magiclink',
      email: inviteeEmail,
      redirectTo: redirectUrl
    });

    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: inviteeEmail,
      options: {
        redirectTo: redirectUrl
      }
    });

    if (error || !data?.properties?.action_link) {
      console.error('❌ [MagicLink] Failed to generate magic link:', error);
      console.error('❌ [MagicLink] Error details:', {
        message: error?.message,
        status: error?.status,
        name: error?.name
      });
      throw new Error(error?.message || 'Failed to generate magic link');
    }

    let actionUrl = data.properties.action_link as string;
    console.log('🔗 [MagicLink] Generated magic link URL:', actionUrl);
    console.log('🔍 [MagicLink] Full action link data:', {
      hasActionLink: !!data.properties.action_link,
      actionLinkLength: actionUrl.length,
      actionLinkPrefix: actionUrl.substring(0, 100) + '...'
    });

    // Check if the generated URL contains the production domain instead of localhost
    try {
      const urlObj = new URL(actionUrl);
      const redirectParam = urlObj.searchParams.get('redirect_to');
      console.log('🔍 [MagicLink] Redirect parameter in generated link:', redirectParam);
      console.log('🔍 [MagicLink] Full URL breakdown:', {
        protocol: urlObj.protocol,
        host: urlObj.host,
        hostname: urlObj.hostname,
        pathname: urlObj.pathname,
        search: urlObj.search,
        hash: urlObj.hash,
        redirectToParam: redirectParam
      });

      // If the redirect_to doesn't match what we want, manually fix it
      if (redirectParam && !redirectParam.includes('localhost') && isDevelopment) {
        console.warn('⚠️ [MagicLink] Generated link has wrong redirect URL, fixing...');
        console.warn('⚠️ [MagicLink] Expected localhost but got:', redirectParam);
        urlObj.searchParams.set('redirect_to', redirectUrl);
        actionUrl = urlObj.toString(); // Update actionUrl with the fixed URL
        console.log('✅ [MagicLink] Fixed magic link URL:', actionUrl);
        // Also update the data object for consistency
        data.properties.action_link = actionUrl;
      } else if (redirectParam && redirectParam !== redirectUrl) {
        console.warn('⚠️ [MagicLink] Redirect URL mismatch detected:', {
          expected: redirectUrl,
          actual: redirectParam,
          isDevelopment
        });
        // Fix it even in production if it doesn't match
        urlObj.searchParams.set('redirect_to', redirectUrl);
        actionUrl = urlObj.toString();
        console.log('✅ [MagicLink] Fixed redirect URL to match expected:', actionUrl);
        data.properties.action_link = actionUrl;
      } else {
        console.log('✅ [MagicLink] Redirect URL is correct:', redirectParam);
      }
    } catch (urlError) {
      console.error('❌ [MagicLink] Error parsing URL:', urlError);
      console.error('❌ [MagicLink] Action URL that failed to parse:', actionUrl);
    }

    // Get brand settings
    const brandSettings = await getBrandSettings();
    const businessName = brandSettings?.business_name || 'OperateFlow';
    const logoUrl = brandSettings?.logo_url;

    console.log('🎨 Brand settings:', { businessName, hasLogo: !!logoUrl });

    const emailSubject = existing ? `Your ${businessName} sign-in link` : `You are invited to ${businessName}`;
    const emailFrom = process.env.EMAIL_FROM!;

    console.log('📨 Email details:', {
      from: emailFrom,
      to: inviteeEmail,
      subject: emailSubject,
      isExistingUser: Boolean(existing)
    });

    const { data: sent, error: sendErr } = await resend.emails.send({
      from: emailFrom,
      to: [inviteeEmail],
      subject: emailSubject,
      react: MagicLinkInviteEmail({
        inviteeEmail,
        actionUrl,
        isExistingUser: Boolean(existing),
        businessName,
        logoUrl: logoUrl || undefined
      }),
    });

    if (sendErr) {
      console.error('❌ Email send failed:', sendErr);
      return { success: false, error: sendErr.message };
    }

    console.log('✅ Email sent successfully:', {
      messageId: sent?.id,
      recipient: inviteeEmail,
      subject: emailSubject
    });

    return { success: true, messageId: sent?.id };
  } catch (error) {
    console.error('❌ Magic link send error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function sendOrderPlacedEmail(order: Order) {
  try {
    if (!resend || !process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    if (shouldSkipCustomerEmail(order.customer_email)) {
      return { success: true, skipped: true as const };
    }
    const brandSettings = await getBrandSettings();
    const businessName = brandSettings?.business_name || 'OperateFlow';
    const logoUrl = brandSettings?.logo_url;
    const emailTo = getEmailOverride(order.customer_email!);
    const emailFrom = process.env.EMAIL_FROM!;
    const { data, error } = await resend.emails.send({
      from: emailFrom,
      to: [emailTo],
      subject: `Order Confirmation - #${order.order_number}`,
      react: require('@/emails/OrderPlaced').OrderPlacedEmail({
        order,
        businessName,
        logoUrl: logoUrl || undefined,
      }),
    });
    if (error) {
      console.error('Error sending order placed email:', error);
      return { success: false, error: error.message };
    }
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('Error in sendOrderPlacedEmail:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export async function sendOrderCompletedEmail(order: Order) {
  try {
    if (!resend || !process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    if (shouldSkipCustomerEmail(order.customer_email)) {
      return { success: true, skipped: true as const };
    }
    const brandSettings = await getBrandSettings();
    const businessName = brandSettings?.business_name || 'OperateFlow';
    const logoUrl = brandSettings?.logo_url;
    const emailTo = getEmailOverride(order.customer_email!);
    const emailFrom = process.env.EMAIL_FROM!;
    const { OrderCompletedEmail } = require('@/emails/OrderCompletedEmail');
    const { data, error } = await resend.emails.send({
      from: emailFrom,
      to: [emailTo],
      subject: `How was your order? #${order.order_number}`,
      react: OrderCompletedEmail({
        customerName: order.customer_name,
        orderNumber: order.order_number,
        businessName,
        logoUrl: logoUrl || undefined,
      }),
    });
    if (error) {
      console.error('Error sending order completed email:', error);
      return { success: false, error: error.message };
    }
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('Error in sendOrderCompletedEmail:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
