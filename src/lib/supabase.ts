import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
const supabaseKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseKey && 
  supabaseUrl !== 'undefined' && 
  supabaseKey !== 'undefined' &&
  supabaseUrl.startsWith('http')
);

if (!isSupabaseConfigured) {
  console.warn('Supabase configuration is missing or invalid. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables.');
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder');

// Helper to check if Supabase is reachable
export async function checkNetwork() {
  if (!isSupabaseConfigured) return false;
  try {
    const { error } = await supabase.from('user_profiles').select('count', { count: 'exact', head: true });
    if (error) {
      if (error.message?.includes('fetch') || error.message?.includes('API key')) throw new Error('Network reachability error');
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
