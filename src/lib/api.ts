import type {
  SiteSettings,
  SubscriptionPlan,
  SubscriptionStatus,
  UserProfile,
  VoiceCharacter,
  VoiceSettings,
} from '../shared/voices';

const USER_TOKEN_KEY = 'vp_user_token';
const ADMIN_TOKEN_KEY = 'vp_admin_token';

export function getUserToken(): string | null {
  return localStorage.getItem(USER_TOKEN_KEY);
}

export function setUserToken(token: string | null): void {
  if (token) localStorage.setItem(USER_TOKEN_KEY, token);
  else localStorage.removeItem(USER_TOKEN_KEY);
}

export function getAdminToken(): string | null {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token: string | null): void {
  if (token) sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
  else sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

async function request<T>(url: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(url, { ...options, headers });
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await res.json().catch(() => ({}))
    : {};
  if (!res.ok) {
    if (res.status === 404 && !data.error) {
      const isAr =
        typeof document !== 'undefined' && document.documentElement.lang === 'ar';
      throw new Error(
        isAr
          ? 'خادم الواجهة البرمجية غير متاح على هذا المسار (404). تأكد من نشر دوال الخادم (/api/index.ts و vercel.json) أو تشغيل الخادم الكامل (node server.ts).'
          : 'API server route not found (404). Ensure Vercel serverless functions (/api/index.ts + vercel.json) are deployed or run the full-stack server (node server.ts).'
      );
    }
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export interface PromptAnalysis {
  spokenText: string;
  characterId: string;
  gender: 'female' | 'male' | 'child';
  estimatedAge: string;
  language: 'ar' | 'en';
  dialect: VoiceSettings['dialect'];
  emotion: VoiceSettings['emotion'];
  emotionIntensity: number;
  deliveryMode: VoiceSettings['deliveryMode'];
  speed: VoiceSettings['speed'];
  pitch: VoiceSettings['pitch'];
  pauses: VoiceSettings['pauses'];
  styleDescription: string;
  summaryAr: string;
  summaryEn: string;
}

export interface AdminStats {
  totalUsers: number;
  activeSubscriptions: number;
  pendingSubscriptions: number;
  expiredSubscriptions: number;
  rejectedSubscriptions: number;
  suspendedAccounts: number;
  totalGenerations: number;
}

export const api = {
  getPublicConfig: () =>
    request<{ settings: SiteSettings; plans: SubscriptionPlan[] }>('/api/public/config'),

  getVoices: () => request<{ voices: VoiceCharacter[] }>('/api/voices'),

  getVoiceSample: (voiceId: string, lang: 'ar' | 'ar-EG' | 'en') =>
    request<{ audioBase64: string; mimeType: string; durationSeconds: number }>(
      `/api/voices/${encodeURIComponent(voiceId)}/sample?lang=${encodeURIComponent(lang)}`
    ),

  register: (payload: {
    name: string;
    phone: string;
    password: string;
    confirmPassword: string;
    planId: string;
  }) =>
    request<{ token: string; user: UserProfile }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { phone: string; password: string }) =>
    request<{ token: string; user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getMe: (token: string) =>
    request<{ user: UserProfile }>('/api/auth/me', {}, token),

  requestRenewal: (token: string, planId: string) =>
    request<{ user: UserProfile }>(
      '/api/auth/request-renewal',
      { method: 'POST', body: JSON.stringify({ planId }) },
      token
    ),

  analyzePrompt: (token: string, prompt: string) =>
    request<{ analysis: PromptAnalysis }>(
      '/api/ai/analyze-prompt',
      { method: 'POST', body: JSON.stringify({ prompt }) },
      token
    ),

  generateVoice: (
    token: string,
    payload: { spokenText: string; characterId: string; settings: VoiceSettings }
  ) =>
    request<{
      audioBase64: string;
      mimeType: string;
      durationSeconds: number;
      characterUsed: string;
    }>(
      '/api/ai/generate-voice',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    ),

  adminLogin: (username: string, password: string) =>
    request<{ token: string; admin: { username: string } }>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  adminGetDashboard: (adminToken: string) =>
    request<{
      stats: AdminStats;
      users: UserProfile[];
      plans: SubscriptionPlan[];
      settings: SiteSettings;
    }>('/api/admin/dashboard', {}, adminToken),

  adminUpdateUserSubscription: (
    adminToken: string,
    userId: string,
    payload: {
      action: string;
      planId?: string;
      durationDays?: number;
      subscriptionStart?: string;
      subscriptionEnd?: string;
      status?: SubscriptionStatus;
    }
  ) =>
    request<{ user: UserProfile }>(
      `/api/admin/users/${encodeURIComponent(userId)}/subscription`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      adminToken
    ),

  adminDeleteUser: (adminToken: string, userId: string) =>
    request<{ deleted: boolean }>(
      `/api/admin/users/${encodeURIComponent(userId)}`,
      { method: 'DELETE' },
      adminToken
    ),

  adminUpdatePlan: (adminToken: string, planId: string, payload: Partial<SubscriptionPlan>) =>
    request<{ plans: SubscriptionPlan[] }>(
      `/api/admin/plans/${encodeURIComponent(planId)}`,
      { method: 'PUT', body: JSON.stringify(payload) },
      adminToken
    ),

  adminUpdateSettings: (
    adminToken: string,
    payload: Partial<SiteSettings> & { syncCurrencyToPlans?: boolean }
  ) =>
    request<{ settings: SiteSettings; plans: SubscriptionPlan[] }>(
      '/api/admin/settings',
      { method: 'PUT', body: JSON.stringify(payload) },
      adminToken
    ),
};
