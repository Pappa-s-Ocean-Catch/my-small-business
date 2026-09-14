import { NextRequest } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { createServerClient } from '@supabase/ssr';

/**
 * Verify QStash webhook signature using official QStash Receiver
 * QStash sends JWT-based signatures in the 'Upstash-Signature' header
 */
export async function verifyQStashSignature(request: NextRequest, body: string): Promise<boolean> {
  const signature = request.headers.get('Upstash-Signature');
  
  if (!signature) {
    console.error('Missing Upstash-Signature header');
    return false;
  }

  // Get QStash signing keys
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  
  if (!currentSigningKey && !nextSigningKey) {
    console.error('Missing QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY environment variables');
    return false;
  }

  try {
    console.log('🔍 Webhook signature verification:');
    console.log('  - Received signature length:', signature.length);
    console.log('  - Received signature (first 20 chars):', signature.substring(0, 20) + '...');

    // Create QStash Receiver with signing keys
    const receiver = new Receiver({
      currentSigningKey: currentSigningKey || '',
      nextSigningKey: nextSigningKey || '',
    });

    // Verify the signature using QStash Receiver
    const isValid = await receiver.verify({
      body,
      signature,
      url: request.url,
    });

    if (isValid) {
      console.log('  - ✅ Valid QStash signature');
      return true;
    } else {
      console.log('  - ❌ Invalid QStash signature');
      return false;
    }
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * Check if the current user is an admin
 */
async function isAdminUser(request: NextRequest): Promise<boolean> {
  try {
    // Check for Authorization header first (Bearer token)
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      console.log('🔑 Authorization header found:', token.substring(0, 20) + '...');
      
      // Create Supabase client with the access token
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
          cookies: {
            getAll() {
              return [];
            },
            setAll() {
              // No-op for API routes
            },
          },
        }
      );

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('👤 User check (token):', { hasUser: !!user, userError: userError?.message });
      
      if (user) {
        console.log('✅ Authenticated user found (token):', { id: user.id, email: user.email });

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role_slug')
          .eq('id', user.id)
          .single();

        if (profileError) {
          console.error('❌ Profile fetch error:', profileError);
          return false;
        }

        const isAdmin = profile?.role_slug === 'admin';
        console.log(`👑 User ${user.id} admin status: ${isAdmin} (role: ${profile?.role_slug})`);
        return isAdmin;
      }
    }

    // Fallback: Check cookies (for backward compatibility)
    console.log('🍪 No Authorization header, checking cookies...');
    const allCookies = request.cookies.getAll();
    console.log('🍪 All cookies received:', allCookies.map(c => ({ name: c.name, value: c.value.substring(0, 20) + '...' })));
    
    // Look for Supabase auth cookies specifically
    const supabaseCookies = allCookies.filter(c => c.name.includes('supabase') || c.name.includes('sb-'));
    console.log('🔐 Supabase cookies found:', supabaseCookies.map(c => ({ name: c.name, hasValue: !!c.value })));

    // Create Supabase client that can access user session from request cookies
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            // In API routes, we can't set cookies, so we ignore this
          },
        },
      }
    );

    // Try to get the session first
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('📋 Session check:', { hasSession: !!session, sessionError: sessionError?.message });
    
    if (session) {
      console.log('👤 Session user:', { id: session.user.id, email: session.user.email });
    }

    // Also try getUser
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log('👤 User check:', { hasUser: !!user, userError: userError?.message });
    
    if (!user) {
      console.log('❌ No authenticated user found');
      return false;
    }

    console.log('✅ Authenticated user found:', { id: user.id, email: user.email });

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role_slug')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('❌ Profile fetch error:', profileError);
      return false;
    }

    const isAdmin = profile?.role_slug === 'admin';
    console.log(`👑 User ${user.id} admin status: ${isAdmin} (role: ${profile?.role_slug})`);
    return isAdmin;
  } catch (error) {
    console.error('❌ Error checking admin status:', error);
    return false;
  }
}

/**
 * Verify webhook signature for automation endpoints
 * Allows both QStash webhooks and admin users
 * Returns both verification result and parsed body to avoid double-reading
 */
export async function verifyAutomationWebhook(request: NextRequest): Promise<{ isValid: boolean; body?: unknown }> {
  try {
    // First, check if this is an admin user (for manual triggers)
    const isAdmin = await isAdminUser(request);
    if (isAdmin) {
      console.log('✅ Admin user detected, allowing manual trigger');
      const body = await request.json();
      return { isValid: true, body };
    }

    // If not admin, verify QStash webhook signature
    const bodyText = await request.text();
    const isValidSignature = await verifyQStashSignature(request, bodyText);
    
    if (isValidSignature) {
      console.log('✅ Valid QStash webhook signature');
      const body = JSON.parse(bodyText);
      return { isValid: true, body };
    } else {
      console.log('❌ Invalid or missing QStash webhook signature');
      return { isValid: false };
    }
  } catch (error) {
    console.error('Error in verifyAutomationWebhook:', error);
    return { isValid: false };
  }
}

/**
 * Middleware to protect automation endpoints
 * Allows both QStash webhooks and admin users
 */
export function requireWebhookAuth(handler: (request: NextRequest) => Promise<Response>) {
  return async (request: NextRequest): Promise<Response> => {
    // Skip verification in development if no signing keys are set
    if (process.env.NODE_ENV === 'development' && 
        !process.env.QSTASH_CURRENT_SIGNING_KEY && 
        !process.env.QSTASH_NEXT_SIGNING_KEY) {
      console.warn('⚠️  QStash webhook verification disabled in development - no signing keys found');
      return handler(request);
    }

    // Verify webhook signature or admin access
    const verification = await verifyAutomationWebhook(request);
    
    if (!verification.isValid) {
      console.error('Unauthorized automation request - neither valid webhook signature nor admin user');
      return new Response('Unauthorized', { status: 401 });
    }

    return handler(request);
  };
}
