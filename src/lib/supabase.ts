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

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseKey || 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      lock: async (name, acquireTimeout, fn) => {
        return await fn();
      }
    }
  }
);

// Proxies to handle "Invalid Refresh Token" failures and deep destructuring safety
const originalGetUser = supabase.auth.getUser.bind(supabase.auth);
(supabase.auth as any).getUser = async (jwt?: string) => {
  try {
    const res = await originalGetUser(jwt);
    if (res?.error && (
      res.error.message?.includes('Refresh Token') || 
      res.error.message?.includes('invalid_grant') ||
      res.error.message?.includes('not found')
    )) {
      console.warn('Handling invalid refresh token in getUser proxy...');
      Object.keys(localStorage).forEach(key => {
        if (
          key.includes('supabase') || 
          key.includes('sb-') || 
          key.includes('auth-token') || 
          key.startsWith('ceflot_auth_')
        ) {
          localStorage.removeItem(key);
        }
      });
    }
    return {
      data: { user: res?.data?.user || null },
      error: res?.error || null
    };
  } catch (err) {
    console.warn('getUser proxy caught error:', err);
    return {
      data: { user: null },
      error: { message: (err as any)?.message || 'Auth user retrieval failed' } as any
    };
  }
};

const originalGetSession = supabase.auth.getSession.bind(supabase.auth);
(supabase.auth as any).getSession = async () => {
  try {
    const res = await originalGetSession();
    if (res?.error && (
      res.error.message?.includes('Refresh Token') || 
      res.error.message?.includes('invalid_grant') ||
      res.error.message?.includes('not found')
    )) {
      console.warn('Handling invalid refresh token in getSession proxy...');
      Object.keys(localStorage).forEach(key => {
        if (
          key.includes('supabase') || 
          key.includes('sb-') || 
          key.includes('auth-token') || 
          key.startsWith('ceflot_auth_')
        ) {
          localStorage.removeItem(key);
        }
      });
    }
    return {
      data: { session: res?.data?.session || null },
      error: res?.error || null
    };
  } catch (err) {
    console.warn('getSession proxy caught error:', err);
    return {
      data: { session: null },
      error: { message: (err as any)?.message || 'Auth session retrieval failed' } as any
    };
  }
};

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
