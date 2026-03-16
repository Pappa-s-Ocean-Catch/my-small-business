import { supabase } from './supabase';

export async function isAdminUser(userId: string): Promise<boolean> {
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('role_slug')
        .eq('id', userId)
        .single();

    if (error) {
        throw new Error(error.message);
    }

    return profile?.role_slug === 'admin';
}

/** Returns true if the user can access the order management app (admin or staff). */
export async function canAccessOrderManagement(userId: string): Promise<boolean> {
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('role_slug')
        .eq('id', userId)
        .single();

    if (error) {
        throw new Error(error.message);
    }

    return profile?.role_slug === 'admin' || profile?.role_slug === 'staff';
}
