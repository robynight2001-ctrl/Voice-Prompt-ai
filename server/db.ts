import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { SiteSettings, SubscriptionPlan, SubscriptionStatus, UserProfile } from '../src/shared/voices.ts';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'voiceprompt.db');
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      selected_plan_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      subscription_start TEXT,
      subscription_end TEXT,
      generation_count INTEGER NOT NULL DEFAULT 0,
      daily_count INTEGER NOT NULL DEFAULT 0,
      daily_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      name_ar TEXT NOT NULL,
      name_en TEXT NOT NULL,
      description_ar TEXT NOT NULL,
      description_en TEXT NOT NULL,
      price REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EGP',
      duration_days INTEGER NOT NULL,
      features_ar TEXT NOT NULL,
      features_en TEXT NOT NULL,
      is_popular INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stats (
      key TEXT PRIMARY KEY,
      value INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS voice_samples_cache (
      cache_key TEXT PRIMARY KEY,
      audio_base64 TEXT NOT NULL,
      duration_seconds REAL NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Seed initial admin if missing (credentials strictly stored hashed in SQLite on server)
  const existingAdmin = db.prepare('SELECT id FROM admins LIMIT 1').get();
  if (!existingAdmin) {
    const adminPasswordHash = hashPassword('Ro15112001');
    db.prepare(
      'INSERT INTO admins (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)'
    ).run(crypto.randomUUID(), 'Ramadan', adminPasswordHash, new Date().toISOString());
  }

  // Seed 4 subscription plans if empty
  const existingPlanCount = db.prepare('SELECT COUNT(*) as count FROM plans').get() as { count: number };
  if (existingPlanCount.count === 0) {
    const insertPlan = db.prepare(`
      INSERT INTO plans (
        id, name_ar, name_en, description_ar, description_en,
        price, currency, duration_days, features_ar, features_en,
        is_popular, is_active, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const defaultPlans = [
      {
        id: '1_month',
        nameAr: 'اشتراك شهر واحد',
        nameEn: '1 Month Plan',
        descAr: 'مثالي لتجربة الاستوديو وإنتاج المشاريع الصوتية السريعة.',
        descEn: 'Ideal for short-term creators and quick studio voice productions.',
        price: 199,
        durationDays: 30,
        featuresAr: ['جميع الأصوات الـ 15 المتقدمة', 'تحليل الـ Prompt بالذكاء الاصطناعي', 'تصدير بجودة WAV ستوديو', 'حفظ محلي لا محدود للمشاريع'],
        featuresEn: ['All 15 expressive AI voices', 'Smart AI Prompt Analyzer', 'Studio WAV audio export', 'Unlimited local device projects'],
        isPopular: 0,
        sortOrder: 1,
      },
      {
        id: '3_months',
        nameAr: 'اشتراك 3 شهور',
        nameEn: '3 Months Plan',
        descAr: 'الخيار الأكثر توازنًا لصناع المحتوى والبودكاست والقنوات.',
        descEn: 'Balanced choice for content creators, podcasters, and channels.',
        price: 499,
        durationDays: 90,
        featuresAr: ['توفير 16% عن الباقة الشهرية', 'تحكم كامل بالمشاعر واللهجات', 'أولوية في معالجة التوليد الصوتي', 'نسخ احتياطي وتصدير للمشاريع'],
        featuresEn: ['Save 16% vs monthly plan', 'Full emotion & dialect controls', 'Priority speech generation', 'Project backup & import/export'],
        isPopular: 1,
        sortOrder: 2,
      },
      {
        id: '6_months',
        nameAr: 'اشتراك 6 شهور',
        nameEn: '6 Months Plan',
        descAr: 'مصمم للاستوديوهات والشركات والمشاريع الطويلة.',
        descEn: 'Built for production studios, agencies, and long-term series.',
        price: 899,
        durationDays: 180,
        featuresAr: ['توفير 25% عن الباقة الشهرية', 'توليد صوتي غير محدود بالمدة', 'دعم العربية الفصحى والمصرية والإنجليزية', 'حفظ خاص وآمن على جهازك فقط'],
        featuresEn: ['Save 25% vs monthly plan', 'Extended multi-scene voice generation', 'MSA, Egyptian Arabic & English support', '100% private local project storage'],
        isPopular: 0,
        sortOrder: 3,
      },
      {
        id: '12_months',
        nameAr: 'اشتراك سنة كاملة',
        nameEn: '1 Year Plan',
        descAr: 'أفضل قيمة سنوية للاستخدام المكثف والإنتاج الاحترافي المستمر.',
        descEn: 'Best annual value for continuous high-volume vocal production.',
        price: 1499,
        durationDays: 365,
        featuresAr: ['أعلى توفير بنسبة 37%', 'وصول كامل لكل تحديثات الأصوات', 'تحكم دقيق بالنبرات والهمس والصراخ', 'اشتراك سنوي مستقر بدون انقطاع'],
        featuresEn: ['Maximum 37% annual savings', 'All future voice persona updates', 'Fine-grained whisper/shout & pitch tuning', 'Uninterrupted year-round studio access'],
        isPopular: 0,
        sortOrder: 4,
      },
    ];

    for (const p of defaultPlans) {
      insertPlan.run(
        p.id,
        p.nameAr,
        p.nameEn,
        p.descAr,
        p.descEn,
        p.price,
        'EGP',
        p.durationDays,
        JSON.stringify(p.featuresAr),
        JSON.stringify(p.featuresEn),
        p.isPopular,
        1,
        p.sortOrder
      );
    }
  }

  // Seed default site settings
  const defaultSettings: Record<string, string> = {
    site_name: 'VoicePrompt AI',
    tagline_ar: 'اكتب الوصف... واسمع الصوت.',
    tagline_en: 'Your Prompt, Your Voice.',
    registration_enabled: 'true',
    max_chars_per_generation: '1500',
    daily_generation_limit: '0',
    currency: 'EGP',
    auth_secret: crypto.randomBytes(32).toString('hex'),
  };

  const insertSetting = db.prepare('INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(defaultSettings)) {
    insertSetting.run(k, v);
  }

  db.prepare('INSERT OR IGNORE INTO stats (key, value) VALUES (?, ?)').run('total_generations', 0);
}

export function getAuthSecret(): string {
  if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16) {
    return process.env.AUTH_SECRET;
  }
  const row = db.prepare('SELECT value FROM site_settings WHERE key = ?').get('auth_secret') as { value: string } | undefined;
  return row ? row.value : 'fallback-dev-secret-change-in-env';
}

export function getSiteSettings(): SiteSettings {
  const rows = db.prepare('SELECT key, value FROM site_settings').all() as Array<{ key: string; value: string }>;
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.key] = r.value;
  }
  return {
    siteName: map.site_name || 'VoicePrompt AI',
    taglineAr: map.tagline_ar || 'اكتب الوصف... واسمع الصوت.',
    taglineEn: map.tagline_en || 'Your Prompt, Your Voice.',
    registrationEnabled: map.registration_enabled !== 'false',
    maxCharsPerGeneration: Number(map.max_chars_per_generation || 1500),
    dailyGenerationLimit: Number(map.daily_generation_limit || 0),
    currency: map.currency || 'EGP',
  };
}

export function getAllPlans(): SubscriptionPlan[] {
  const rows = db.prepare('SELECT * FROM plans ORDER BY sort_order ASC').all() as Array<{
    id: string;
    name_ar: string;
    name_en: string;
    description_ar: string;
    description_en: string;
    price: number;
    currency: string;
    duration_days: number;
    features_ar: string;
    features_en: string;
    is_popular: number;
    is_active: number;
    sort_order: number;
  }>;

  return rows.map((r) => ({
    id: r.id,
    nameAr: r.name_ar,
    nameEn: r.name_en,
    descriptionAr: r.description_ar,
    descriptionEn: r.description_en,
    price: r.price,
    currency: r.currency,
    durationDays: r.duration_days,
    featuresAr: safeParseArray(r.features_ar),
    featuresEn: safeParseArray(r.features_en),
    isPopular: Boolean(r.is_popular),
    isActive: Boolean(r.is_active),
    sortOrder: r.sort_order,
  }));
}

function safeParseArray(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export interface DbUserRow {
  id: string;
  name: string;
  phone: string;
  password_hash: string;
  selected_plan_id: string;
  status: SubscriptionStatus;
  subscription_start: string | null;
  subscription_end: string | null;
  generation_count: number;
  daily_count: number;
  daily_date: string | null;
  created_at: string;
  updated_at: string;
}

export function sanitizeUser(row: DbUserRow): UserProfile {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    selectedPlanId: row.selected_plan_id,
    status: row.status,
    subscriptionStart: row.subscription_start,
    subscriptionEnd: row.subscription_end,
    generationCount: row.generation_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function refreshUserExpiration(row: DbUserRow): DbUserRow {
  if (row.status === 'active' && row.subscription_end) {
    const endMs = new Date(row.subscription_end).getTime();
    if (!Number.isNaN(endMs) && endMs <= Date.now()) {
      const nowIso = new Date().toISOString();
      db.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?').run('expired', nowIso, row.id);
      return { ...row, status: 'expired', updated_at: nowIso };
    }
  }
  return row;
}

export function expireAllOverdueSubscriptions(): void {
  const nowIso = new Date().toISOString();
  db.prepare(
    "UPDATE users SET status = 'expired', updated_at = ? WHERE status = 'active' AND subscription_end IS NOT NULL AND subscription_end <= ?"
  ).run(nowIso, nowIso);
}
