import { createServiceRoleClient } from '@my-small-business/supabase/server';

const TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TOKEN_LENGTH = 8;
const MAX_ATTEMPTS = 5;
const EXPIRY_HOURS = 24;

function generateToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_LENGTH));
  return Array.from(bytes, (byte) => TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length]).join('');
}

export async function createPaymentLinkAlias(orderId: string, stripeCheckoutUrl: string) {
  const supabase = await createServiceRoleClient();
  const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const token = generateToken();
    const { error } = await supabase.from('payment_links').insert({
      token,
      order_id: orderId,
      stripe_checkout_url: stripeCheckoutUrl,
      expires_at: expiresAt,
    });
    if (!error) {
      const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.pappasfishnchips.com.au/').replace(/\/$/, '');
      return { token, paymentUrl: `${baseUrl}/pay/${token}`, expiresAt };
    }
    if (error.code !== '23505') throw new Error(error.message);
  }

  throw new Error('Unable to generate a unique payment link token.');
}
