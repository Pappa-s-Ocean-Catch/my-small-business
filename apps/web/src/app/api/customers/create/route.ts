import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@my-small-business/supabase/server';

function normalizeAuPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('61') && digits.length === 11) {
    return `+${digits}`;
  }
  if (digits.startsWith('04') && digits.length === 10) {
    return `+61${digits.slice(1)}`;
  }
  if (phone.startsWith('+614') && digits.length === 11) {
    return `+${digits}`;
  }
  return phone.trim();
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const supabase = await createServiceRoleClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: actorProfile, error: actorError } = await supabase
      .from('profiles')
      .select('role_slug')
      .eq('id', user.id)
      .single();

    if (actorError || !actorProfile || (actorProfile.role_slug !== 'admin' && actorProfile.role_slug !== 'staff')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json() as { name?: string; email?: string; phone?: string };
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const phone = String(body.phone || '').trim();
    const normalizedPhone = phone ? normalizeAuPhone(phone) : '';

    if (!name) {
      return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });
    }

    if (!email && !normalizedPhone) {
      return NextResponse.json({ error: 'Please provide an email or phone number' }, { status: 400 });
    }

    if (email) {
      const { data: existingByEmail, error: existingEmailError } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone')
        .eq('email', email)
        .maybeSingle();

      if (existingEmailError && existingEmailError.code !== 'PGRST116') {
        return NextResponse.json({ error: existingEmailError.message }, { status: 500 });
      }

      if (existingByEmail) {
        return NextResponse.json({
          customer: {
            id: existingByEmail.id,
            name: existingByEmail.full_name ?? '',
            email: existingByEmail.email ?? '',
            phone: existingByEmail.phone ?? '',
          },
        });
      }
    }

    if (normalizedPhone) {
      const { data: existingByPhone, error: existingPhoneError } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone')
        .eq('phone', normalizedPhone)
        .maybeSingle();

      if (existingPhoneError && existingPhoneError.code !== 'PGRST116') {
        return NextResponse.json({ error: existingPhoneError.message }, { status: 500 });
      }

      if (existingByPhone) {
        return NextResponse.json({
          customer: {
            id: existingByPhone.id,
            name: existingByPhone.full_name ?? '',
            email: existingByPhone.email ?? '',
            phone: existingByPhone.phone ?? '',
          },
        });
      }
    }

    const newId = crypto.randomUUID();
    const { data: created, error: createError } = await supabase
      .from('profiles')
      .insert({
        id: newId,
        full_name: name,
        email: email || null,
        phone: normalizedPhone || null,
        role_slug: 'customer',
      })
      .select('id, full_name, email, phone')
      .single();

    if (createError || !created) {
      return NextResponse.json({ error: createError?.message || 'Failed to create customer' }, { status: 400 });
    }

    return NextResponse.json({
      customer: {
        id: created.id,
        name: created.full_name ?? '',
        email: created.email ?? '',
        phone: created.phone ?? '',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create customer' },
      { status: 500 }
    );
  }
}
