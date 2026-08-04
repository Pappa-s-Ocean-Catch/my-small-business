export const isStaffOrAdmin = (role: string | null | undefined) => (
  role === 'staff' || role === 'admin'
);

export async function authenticateStaffApiRequest(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Missing or invalid authorization header', status: 401 as const };
  }

  const token = authHeader.slice('Bearer '.length);
  if (!token) {
    return { error: 'Missing or invalid authorization header', status: 401 as const };
  }

  const { createServiceRoleClient } = await import('@my-small-business/supabase/server');
  const supabase = await createServiceRoleClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return { error: 'Unauthorized - Invalid token', status: 401 as const };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role_slug')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return { error: 'Profile lookup failed', status: 500 as const };
  }

  if (!isStaffOrAdmin(profile.role_slug)) {
    return { error: 'Forbidden - Staff or admin access required', status: 403 as const };
  }

  return { supabase, profile } as const;
}
