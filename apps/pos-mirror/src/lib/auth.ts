import { supabase } from './supabase';

export async function canAccessPosMirror(userId: string): Promise<boolean> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role_slug')
    .eq('id', userId)
    .single();

  if (error) throw new Error(error.message);
  return profile?.role_slug === 'admin' || profile?.role_slug === 'staff';
}
