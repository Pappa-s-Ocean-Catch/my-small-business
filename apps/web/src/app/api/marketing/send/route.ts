import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@my-small-business/supabase/server';
import { Resend } from 'resend';
import { sendSmsMessage } from '@/lib/sms';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const DUPLICATE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

type RequestedChannel = 'email' | 'sms';

type RequestCustomer = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

type ProfileMarketingRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  opt_in_marketing: boolean | null;
  last_marketing_email_sent_at: string | null;
  last_marketing_sms_sent_at: string | null;
};

function fillTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), value),
    template
  );
}

function stripHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function recentlySent(isoDate: string | null | undefined) {
  if (!isoDate) return false;
  const sentAt = new Date(isoDate).getTime();
  return Number.isFinite(sentAt) && Date.now() - sentAt < DUPLICATE_COOLDOWN_MS;
}

async function authorizeAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 }) };
  }

  const token = authHeader.split(' ')[1];
  const supabase = await createServiceRoleClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role_slug')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || profile.role_slug !== 'admin') {
    return { error: NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 }) };
  }

  return { supabase };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeAdmin(request);
    if ('error' in auth) {
      return auth.error;
    }

    const { supabase } = auth;
    const body = await request.json();
    const {
      customers,
      discountPercentage,
      subject: customSubject,
      htmlBody: customHtmlBody,
      smsBody: customSmsBody,
      channels,
    } = body as {
      customers: RequestCustomer[];
      discountPercentage: number;
      subject?: string;
      htmlBody?: string;
      smsBody?: string;
      channels?: RequestedChannel[];
    };

    const requestedChannels: RequestedChannel[] = Array.isArray(channels) && channels.length > 0
      ? Array.from(new Set(channels.filter((channel): channel is RequestedChannel => channel === 'email' || channel === 'sms')))
      : ['email'];

    if (!Array.isArray(customers) || customers.length === 0) {
      return NextResponse.json({ error: 'No customers provided' }, { status: 400 });
    }
    if (typeof discountPercentage !== 'number') {
      return NextResponse.json({ error: 'Invalid discount percentage' }, { status: 400 });
    }
    if (requestedChannels.length === 0) {
      return NextResponse.json({ error: 'At least one delivery channel is required' }, { status: 400 });
    }

    if (requestedChannels.includes('email') && (!resend || !process.env.RESEND_API_KEY)) {
      return NextResponse.json({ error: 'Email service is not configured' }, { status: 500 });
    }

    const storeName = process.env.NEXT_PUBLIC_STORE_NAME || 'Our Store';
    const emailFrom = process.env.EMAIL_FROM || 'no-reply@pappasfishnchips.com.au';
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const hmacSecret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.RESEND_API_KEY || 'default_secret';
    const defaultSubject = customSubject || `A ${discountPercentage}% thank-you offer from ${storeName}`;
    const defaultHtmlBody = customHtmlBody || `
      <p>Hi {{CUSTOMER_NAME}},</p>
      <p>Here is your ${discountPercentage}% off discount!</p>
      <p>Use code: <strong>{{COUPON_CODE}}</strong> at checkout.</p>
      <a href="{{STORE_LINK}}">Shop Now</a>
      <br><br><small><a href="{{UNSUBSCRIBE_LINK}}">Unsubscribe from marketing emails</a></small>
    `;
    const defaultSmsBody = customSmsBody || `Hi {{CUSTOMER_NAME}}, enjoy ${discountPercentage}% off with code {{COUPON_CODE}}. Order here: {{STORE_LINK}}`;

    const uniqueCustomerIds = Array.from(
      new Set(
        customers
          .map((customer) => customer.id?.trim())
          .filter((id): id is string => Boolean(id))
      )
    );

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, opt_in_marketing, last_marketing_email_sent_at, last_marketing_sms_sent_at')
      .in('id', uniqueCustomerIds);

    if (profilesError) {
      return NextResponse.json({ error: profilesError.message }, { status: 500 });
    }

    const profileMap = new Map<string, ProfileMarketingRow>(
      (profiles || []).map((profile) => [profile.id, profile as ProfileMarketingRow])
    );

    const results: Array<{
      customer: RequestCustomer;
      success: boolean;
      channels?: RequestedChannel[];
      skippedChannels?: RequestedChannel[];
      error?: string;
    }> = [];

    for (const customer of customers) {
      try {
        const profile = profileMap.get(customer.id);
        if (!profile) {
          results.push({ customer, success: false, error: 'Customer profile not found' });
          continue;
        }
        if (profile.opt_in_marketing === false) {
          results.push({ customer, success: false, skippedChannels: requestedChannels, error: 'Customer opted out of marketing' });
          continue;
        }

        const resolvedName = profile.full_name || customer.name || 'Valued Customer';
        const resolvedEmail = profile.email || customer.email || '';
        const resolvedPhone = profile.phone || customer.phone || '';

        const availableChannels: RequestedChannel[] = requestedChannels.filter((channel) => {
          if (channel === 'email') return Boolean(resolvedEmail);
          return Boolean(resolvedPhone);
        });
        const missingChannels: RequestedChannel[] = requestedChannels.filter((channel) => !availableChannels.includes(channel));

        const dedupedChannels: RequestedChannel[] = availableChannels.filter((channel) => {
          if (channel === 'email') return !recentlySent(profile.last_marketing_email_sent_at);
          return !recentlySent(profile.last_marketing_sms_sent_at);
        });
        const skippedForDuplicate: RequestedChannel[] = availableChannels.filter((channel) => !dedupedChannels.includes(channel));

        if (dedupedChannels.length === 0) {
          const reasons = [
            missingChannels.length > 0 ? `missing ${missingChannels.join('/')}` : null,
            skippedForDuplicate.length > 0 ? `recently sent via ${skippedForDuplicate.join('/')}` : null,
          ].filter(Boolean).join('; ');
          results.push({
            customer,
            success: false,
            skippedChannels: requestedChannels,
            error: reasons || 'No eligible delivery channel',
          });
          continue;
        }

        const couponCode = `VIP${discountPercentage}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const utmMedium = dedupedChannels.length === 1 ? dedupedChannels[0] : 'multichannel';
        const storeLink = `${baseUrl}/order?coupon=${couponCode}&utm_source=auto_marketing&utm_medium=${utmMedium}&utm_campaign=ai_discount`;
        const unsubToken = crypto.createHmac('sha256', hmacSecret).update(customer.id).digest('hex');
        const unsubscribeLink = `${baseUrl}/unsubscribe?id=${customer.id}&token=${unsubToken}`;
        const replacements = {
          CUSTOMER_NAME: resolvedName,
          COUPON_CODE: couponCode,
          STORE_LINK: storeLink,
          UNSUBSCRIBE_LINK: unsubscribeLink,
        };

        const startsAt = new Date();
        const endsAt = new Date(startsAt.getTime() + 7 * 24 * 60 * 60 * 1000);

        const { error: couponError } = await supabase.from('coupons').insert({
          code: couponCode,
          title: `AI Marketing ${discountPercentage}% Off`,
          description: `Special discount generated by AI Marketing for ${resolvedName}`,
          is_active: true,
          discount_type: 'percent',
          discount_value: discountPercentage,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          max_uses: 1,
          max_uses_per_user: 1,
          target_email: resolvedEmail || null,
          user_id: customer.id,
        });

        if (couponError) {
          results.push({ customer, success: false, error: `Failed to create coupon: ${couponError.message}` });
          continue;
        }

        const finalSubject = fillTemplate(defaultSubject, replacements);
        const finalHtmlBody = fillTemplate(defaultHtmlBody, replacements);
        const finalSmsBody = stripHtml(fillTemplate(defaultSmsBody, replacements));
        const succeededChannels: RequestedChannel[] = [];

        if (dedupedChannels.includes('email')) {
          const { error: emailError } = await resend!.emails.send({
            from: emailFrom,
            to: [resolvedEmail],
            subject: finalSubject,
            html: finalHtmlBody,
          });

          if (emailError) {
            throw new Error(`Failed to send email: ${emailError.message}`);
          }

          succeededChannels.push('email');
        }

        if (dedupedChannels.includes('sms')) {
          await sendSmsMessage({
            phone: resolvedPhone,
            message: finalSmsBody,
            customRef: `marketing-${customer.id}`,
          });
          succeededChannels.push('sms');
        }

        const profileUpdate: Record<string, string> = {};
        const nowIso = new Date().toISOString();
        if (succeededChannels.includes('email')) {
          profileUpdate.last_marketing_email_sent_at = nowIso;
        }
        if (succeededChannels.includes('sms')) {
          profileUpdate.last_marketing_sms_sent_at = nowIso;
        }

        if (Object.keys(profileUpdate).length > 0) {
          const { error: updateError } = await supabase
            .from('profiles')
            .update(profileUpdate)
            .eq('id', customer.id);

          if (updateError) {
            console.warn(`Failed to update marketing timestamps for ${customer.id}`, updateError);
          }
        }

        results.push({
          customer,
          success: true,
          channels: succeededChannels,
          skippedChannels: ([] as RequestedChannel[]).concat(missingChannels, skippedForDuplicate),
        });
      } catch (err) {
        results.push({ customer, success: false, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Marketing send error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
