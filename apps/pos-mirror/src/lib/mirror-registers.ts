import { normalizeMirrorRegisterIds, type MirrorRegisterRow } from './mirror-register-options';
import { supabase } from './supabase';

export async function listMirrorRegisterIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from('pos_mirror_state')
    .select('register_id')
    .order('register_id', { ascending: true });

  if (error) throw new Error(error.message);
  return normalizeMirrorRegisterIds((data ?? []) as MirrorRegisterRow[]);
}
