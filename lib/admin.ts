import { supabase } from './supabase';

// NOTE: These are intentionally hard-coded per requirements. They live in the
// client bundle, so this is a light gate for the demo, NOT real security.
export const ADMIN_EMAIL = 'sudio@xspark.co.za';
export const ADMIN_PASSWORD = '12345';

const AUTH_KEY = 'admin_authenticated';

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(AUTH_KEY) === 'true';
}

export function logout(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_KEY);
}

export async function login(
  email: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  const normalized = email.trim().toLowerCase();
  if (normalized !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return { ok: false, error: 'Invalid email or password.' };
  }
  localStorage.setItem(AUTH_KEY, 'true');
  // Record device + location in the background (never block the login on it).
  recordLogin(normalized).catch(() => {});
  return { ok: true };
}

export type AdminLogin = {
  id: string;
  email: string;
  browser: string | null;
  os: string | null;
  device_type: string | null;
  ip: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  created_at: string;
};

export async function fetchLogins(): Promise<AdminLogin[]> {
  const { data } = await supabase
    .from('admin_logins')
    .select('id, email, browser, os, device_type, ip, city, region, country, created_at')
    .order('created_at', { ascending: false })
    .limit(25);
  return (data as AdminLogin[]) ?? [];
}

function parseDevice(ua: string): {
  browser: string;
  os: string;
  deviceType: string;
} {
  let browser = 'Unknown';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/opr\/|opera/i.test(ua)) browser = 'Opera';
  else if (/chrome\//i.test(ua)) browser = 'Chrome';
  else if (/firefox\//i.test(ua)) browser = 'Firefox';
  else if (/safari\//i.test(ua)) browser = 'Safari';

  let os = 'Unknown';
  if (/windows nt/i.test(ua)) os = 'Windows';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/mac os x/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  const deviceType = /mobile|android|iphone|ipad|ipod/i.test(ua)
    ? 'Mobile'
    : 'Desktop';

  return { browser, os, deviceType };
}

async function getLocation(): Promise<{
  ip: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://ipapi.co/json/', {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error('geo failed');
    const j = await res.json();
    return {
      ip: j.ip ?? null,
      city: j.city ?? null,
      region: j.region ?? null,
      country: j.country_name ?? null,
    };
  } catch {
    return { ip: null, city: null, region: null, country: null };
  }
}

async function recordLogin(email: string): Promise<void> {
  const ua = navigator.userAgent;
  const { browser, os, deviceType } = parseDevice(ua);
  const loc = await getLocation();
  await supabase.from('admin_logins').insert({
    email,
    browser,
    os,
    device_type: deviceType,
    user_agent: ua,
    ip: loc.ip,
    city: loc.city,
    region: loc.region,
    country: loc.country,
  });
}
