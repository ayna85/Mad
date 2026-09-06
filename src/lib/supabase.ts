import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_URL_KEY = 'mad_supabase_url';
const STORAGE_ANON_KEY = 'mad_supabase_anon_key';

export function getStoredSupabaseConfig() {
  // 1. Check window.__SUPABASE_CONFIG__ injected by server
  const winCfg = typeof window !== 'undefined' ? (window as any).__SUPABASE_CONFIG__ : null;
  const winUrl = winCfg?.url || '';
  const winKey = winCfg?.anonKey || '';

  // 2. Check local storage
  const localUrl = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_URL_KEY) : null;
  const localKey = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_ANON_KEY) : null;

  // 3. Check environment variables
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const url = (winUrl && !winUrl.includes('your-project')) ? winUrl
    : (localUrl && !localUrl.includes('your-project')) ? localUrl
    : (envUrl && !envUrl.includes('your-project')) ? envUrl
    : '';

  const anonKey = (winKey && !winKey.includes('your-anon')) ? winKey
    : (localKey && !localKey.includes('your-anon')) ? localKey
    : (envKey && !envKey.includes('your-anon')) ? envKey
    : '';

  const isValidUrl = url && url.startsWith('http') && !url.includes('your-project');
  const isValidKey = anonKey && anonKey.length > 20 && !anonKey.includes('your-anon');

  return {
    url,
    anonKey,
    isConfigured: Boolean(isValidUrl && isValidKey),
  };
}

let supabaseInstance: SupabaseClient | null = null;
let currentConfigKey = '';

export function getSupabase(): SupabaseClient | null {
  const config = getStoredSupabaseConfig();
  if (!config.isConfigured) {
    return null;
  }

  const configKey = `${config.url}_${config.anonKey}`;
  if (!supabaseInstance || currentConfigKey !== configKey) {
    try {
      supabaseInstance = createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        },
      });
      currentConfigKey = configKey;
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
      return null;
    }
  }

  return supabaseInstance;
}

export async function ensureSupabaseLoaded(): Promise<SupabaseClient | null> {
  const existing = getSupabase();
  if (existing) {
    // If we have credentials in localStorage, make sure the server has them synced
    syncLocalConfigToServer();
    return existing;
  }

  // Fetch from server /api/supabase-config with fast timeout
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 1000) : null;
    const res = await fetch('/api/supabase-config', {
      signal: controller ? controller.signal : undefined,
    });
    if (timer) clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data?.url && data?.anonKey && data.isConfigured) {
        if (typeof window !== 'undefined') {
          (window as any).__SUPABASE_CONFIG__ = { url: data.url, anonKey: data.anonKey };
          localStorage.setItem(STORAGE_URL_KEY, data.url);
          localStorage.setItem(STORAGE_ANON_KEY, data.anonKey);
        }
        return getSupabase();
      }
    }
  } catch (err) {
    // Non-blocking fallback
  }

  return getSupabase();
}

async function syncLocalConfigToServer() {
  try {
    const localUrl = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_URL_KEY) : null;
    const localKey = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_ANON_KEY) : null;
    if (localUrl && localKey && !localUrl.includes('your-project') && !localKey.includes('your-anon')) {
      const winCfg = typeof window !== 'undefined' ? (window as any).__SUPABASE_CONFIG__ : null;
      if (!winCfg?.url || winCfg.url !== localUrl) {
        await fetch('/api/supabase-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: localUrl, anonKey: localKey }),
        }).catch(() => {});
      }
    }
  } catch {
    // Non-blocking
  }
}

// Initial background sync
if (typeof window !== 'undefined') {
  syncLocalConfigToServer();
}

export function saveCustomSupabaseConfig(url: string, anonKey: string) {
  const cleanUrl = url.trim();
  const cleanKey = anonKey.trim();

  localStorage.setItem(STORAGE_URL_KEY, cleanUrl);
  localStorage.setItem(STORAGE_ANON_KEY, cleanKey);
  if (typeof window !== 'undefined') {
    (window as any).__SUPABASE_CONFIG__ = { url: cleanUrl, anonKey: cleanKey };
  }

  supabaseInstance = null;
  currentConfigKey = '';

  // Synchronize to server so all phones/browsers share the exact same credentials
  fetch('/api/supabase-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: cleanUrl, anonKey: cleanKey }),
  }).catch((err) => console.warn('Could not sync Supabase config to server:', err));
}

export function clearCustomSupabaseConfig() {
  localStorage.removeItem(STORAGE_URL_KEY);
  localStorage.removeItem(STORAGE_ANON_KEY);
  if (typeof window !== 'undefined') {
    delete (window as any).__SUPABASE_CONFIG__;
  }
  supabaseInstance = null;
  currentConfigKey = '';
}

export async function testSupabaseConnection(url: string, anonKey: string): Promise<{ success: boolean; message: string }> {
  try {
    if (!url || !url.startsWith('http')) {
      return { success: false, message: 'Invalid URL format. Must start with https://' };
    }
    if (!anonKey || anonKey.length < 20) {
      return { success: false, message: 'Invalid Anon Key.' };
    }

    const testClient = createClient(url.trim(), anonKey.trim(), {
      auth: { persistSession: false },
    });

    const { error } = await testClient.from('profiles').select('count', { count: 'exact', head: true });
    
    // Even if table doesn't exist yet, if status is not connection refused/auth error, connection succeeded
    if (error && error.code === 'PGRST301') {
      return { success: false, message: 'Invalid API Key / Unauthorized' };
    }

    return { success: true, message: 'Successfully connected to Supabase project!' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Connection failed' };
  }
}
