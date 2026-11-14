import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Pool, type PoolConfig } from 'pg';
import type {
  SiteSettings,
  SubscriptionPlan,
  SubscriptionStatus,
  UserProfile,
} from '../src/shared/voices.ts';

type SqliteDatabase = {
  pragma(source: string): unknown;
  exec(source: string): unknown;
  prepare(source: string): {
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    run(...params: unknown[]): { changes: number };
  };
};

let pgPool: Pool | null = null;
let sqliteDb: SqliteDatabase | null = null;
let initPromise: Promise<void> | null = null;
let cachedAuthSecret: string | null = null;

export function getPostgresConnectionString(): string | null {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.SUPABASE_DB_URL,
  ];
  for (const val of candidates) {
    if (val && val.trim().length > 0 && !val.includes('MY_DATABASE_URL')) {
      return val.trim();
    }
  }
  return null;
}

export function isVercelRuntime(): boolean {
  return Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
}

export function getDatabaseKind(): 'postgres' | 'sqlite' | 'unconfigured' {
  if (getPostgresConnectionString()) return 'postgres';
  if (isVercelRuntime()) return 'unconfigured';
  return 'sqlite';
}

function resolveWritableDataDir(): string {
  const preferred = path.join(process.cwd(), 'data');
  try {
    if (!fs.existsSync(preferred)) {
      fs.mkdirSync(preferred, { recursive: true });
    }
    fs.accessSync(preferred, fs.constants.W_OK);
    return preferred;
  } catch {
    const fallback = path.join(os.tmpdir(), 'voiceprompt-ai-data');
    if (!fs.existsSync(fallback)) {
      fs.mkdirSync(fallback, { recursive: true });
    }
    return fallback;
  }
}

function toSqlitePlaceholders(sql: string): string {
  return sql.replace(/\$\d+/g, '?');
}

async function queryAll<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  if (pgPool) {
    const res = await pgPool.query(sql, params);
    return res.rows as T[];
  }
  if (sqliteDb) {
    return sqliteDb.prepare(toSqlitePlaceholders(sql)).all(...params) as T[];
  }
  throw new Error('Database has not been initialized.');
}

async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await queryAll<T>(sql, params);
  return rows[0] ?? null;
}

async function execute(sql: string, params: unknown[] = []): Promise<{ rowCount: number }> {
  if (pgPool) {
    const res = await pgPool.query(sql, params);
    return { rowCount: res.rowCount ?? 0 };
  }
  if (sqliteDb) {
    const info = sqliteDb.prepare(toSqlitePlaceholders(sql)).run(...params);
    return { rowCount: info.changes };
  }
  throw new Error('Database has not been initialized.');
}

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

async function runSchemaAndSeed(): Promise<void> {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
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
    )`,
    `CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      name_ar TEXT NOT NULL,
      name_en TEXT NOT NULL,
      description_ar TEXT NOT NULL,
      description_en TEXT NOT NULL,
      price DOUBLE PRECISION NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EGP',
      duration_days INTEGER NOT NULL,
      features_ar TEXT NOT NULL,
      features_en TEXT NOT NULL,
      is_popular INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS stats (
      key TEXT PRIMARY KEY,
      value INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS voice_samples_cache (
      cache_key TEXT PRIMARY KEY,
      audio_base64 TEXT NOT NULL,
      duration_seconds DOUBLE PRECISION NOT NULL,
      created_at TEXT NOT NULL
    )`,
  ];

  for (const ddl of statements) {
    if (pgPool) {
      await pgPool.query(ddl);
    } else if (sqliteDb) {
      sqliteDb.exec(ddl);
    }
  }

  // Seed initial admin if missing (credentials strictly hashed on server)
  const existingAdmin = await queryOne<{ id: string }>('SELECT id FROM admins LIMIT 1');
  if (!existingAdmin) {
    const adminPasswordHash = hashPassword('Ro15112001');
    await execute(
      'INSERT INTO admins (id, username, password_hash, created_at) VALUES ($1, $2, $3, $4)',
      [crypto.randomUUID(), 'Ramadan', adminPasswordHash, new Date().toISOString()]
    );
  }

  // Seed 4 subscription plans if empty
  const planCountRow = await queryOne<{ count: string | number }>(
    'SELECT COUNT(*) as count FROM plans'
  );
  const existingPlanCount = Number(planCountRow?.count ?? 0);

  if (existingPlanCount === 0) {
    const defaultPlans = [
      {
        id: '1_month',
        nameAr: 'اشتراك شهر واحد',
        nameEn: '1 Month Plan',
        descAr: 'مثالي لتجربة الاستوديو وإنتاج المشاريع الصوتية السريعة.',
        descEn: 'Ideal for short-term creators and quick studio voice productions.',
        price: 199,
        durationDays: 30,
        featuresAr: [
          'جميع الأصوات الـ 15 المتقدمة',
          'تحليل الـ Prompt بالذكاء الاصطناعي',
          'تصدير بجودة WAV ستوديو',
          'حفظ محلي لا محدود للمشاريع',
        ],
        featuresEn: [
          'All 15 expressive AI voices',
          'Smart AI Prompt Analyzer',
          'Studio WAV audio export',
          'Unlimited local device projects',
        ],
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
        featuresAr: [
          'توفير 16% عن الباقة الشهرية',
          'تحكم كامل بالمشاعر واللهجات',
          'أولوية في معالجة التوليد الصوتي',
          'نسخ احتياطي وتصدير للمشاريع',
        ],
        featuresEn: [
          'Save 16% vs monthly plan',
          'Full emotion & dialect controls',
          'Priority speech generation',
          'Project backup & import/export',
        ],
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
        featuresAr: [
          'توفير 25% عن الباقة الشهرية',
          'توليد صوتي غير محدود بالمدة',
          'دعم العربية الفصحى والمصرية والإنجليزية',
          'حفظ خاص وآمن على جهازك فقط',
        ],
        featuresEn: [
          'Save 25% vs monthly plan',
          'Extended multi-scene voice generation',
          'MSA, Egyptian Arabic & English support',
          '100% private local project storage',
        ],
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
        featuresAr: [
          'أعلى توفير بنسبة 37%',
          'وصول كامل لكل تحديثات الأصوات',
          'تحكم دقيق بالنبرات والهمس والصراخ',
          'اشتراك سنوي مستقر بدون انقطاع',
        ],
        featuresEn: [
          'Maximum 37% annual savings',
          'All future voice persona updates',
          'Fine-grained whisper/shout & pitch tuning',
          'Uninterrupted year-round studio access',
        ],
        isPopular: 0,
        sortOrder: 4,
      },
    ];

    for (const p of defaultPlans) {
      await execute(
        `INSERT INTO plans (
          id, name_ar, name_en, description_ar, description_en,
          price, currency, duration_days, features_ar, features_en,
          is_popular, is_active, sort_order
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO NOTHING`,
        [
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
          p.sortOrder,
        ]
      );
    }
  }

  // Seed default site settings (persists auth_secret in DB across serverless invocations)
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

  for (const [k, v] of Object.entries(defaultSettings)) {
    await execute(
      'INSERT INTO site_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
      [k, v]
    );
  }

  await execute(
    'INSERT INTO stats (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
    ['total_generations', 0]
  );

  // Cache auth secret in memory for this runtime instance
  if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16) {
    cachedAuthSecret = process.env.AUTH_SECRET;
  } else {
    const row = await queryOne<{ value: string }>(
      'SELECT value FROM site_settings WHERE key = $1',
      ['auth_secret']
    );
    cachedAuthSecret = row?.value || 'fallback-dev-secret-change-in-env';
  }
}

export async function initDatabase(): Promise<void> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const pgUrl = getPostgresConnectionString();

    if (pgUrl) {
      const isLocalhost = /localhost|127\.0\.0\.1/i.test(pgUrl);
      const disableSsl = /sslmode=disable/i.test(pgUrl);
      const poolConfig: PoolConfig = {
        connectionString: pgUrl,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        ...(isLocalhost || disableSsl ? {} : { ssl: { rejectUnauthorized: false } }),
      };
      pgPool = new Pool(poolConfig);
      await runSchemaAndSeed();
      return;
    }

    if (isVercelRuntime()) {
      throw new Error(
        'Database is not configured for Vercel deployment. Please set DATABASE_URL or POSTGRES_URL (Vercel Postgres, Neon, or Supabase) in your Vercel Project Environment Variables and redeploy.'
      );
    }

    // Local development / self-hosted Node fallback using SQLite
    const sqlitePkgName = 'better-sqlite3';
    const mod = (await import(/* @vite-ignore */ sqlitePkgName)) as {
      default: new (filename: string) => SqliteDatabase;
    };
    const Database = mod.default;
    const dataDir = resolveWritableDataDir();
    const dbPath = path.join(dataDir, 'voiceprompt.db');
    sqliteDb = new Database(dbPath);
    sqliteDb.pragma('journal_mode = WAL');
    sqliteDb.pragma('foreign_keys = ON');
    await runSchemaAndSeed();
  })().catch((err) => {
    // Allow retry on transient cold-start connection failure
    initPromise = null;
    if (pgPool) {
      void pgPool.end().catch(() => {});
      pgPool = null;
    }
    throw err;
  });

  return initPromise;
}

export async function getAuthSecret(): Promise<string> {
  if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16) {
    return process.env.AUTH_SECRET;
  }
  await initDatabase();
  if (cachedAuthSecret) {
    return cachedAuthSecret;
  }
  const row = await queryOne<{ value: string }>(
    'SELECT value FROM site_settings WHERE key = $1',
    ['auth_secret']
  );
  cachedAuthSecret = row?.value || 'fallback-dev-secret-change-in-env';
  return cachedAuthSecret;
}

export async function getSiteSettings(): Promise<SiteSettings> {
  await initDatabase();
  const rows = await queryAll<{ key: string; value: string }>(
    'SELECT key, value FROM site_settings'
  );
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

export async function updateSiteSettings(
  entries: Array<[string, string]>,
  syncCurrencyToPlans?: string
): Promise<void> {
  await initDatabase();
  for (const [k, v] of entries) {
    await execute(
      `INSERT INTO site_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [k, v]
    );
  }
  if (syncCurrencyToPlans) {
    await execute('UPDATE plans SET currency = $1', [syncCurrencyToPlans]);
  }
}

export async function getAllPlans(): Promise<SubscriptionPlan[]> {
  await initDatabase();
  const rows = await queryAll<{
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
  }>('SELECT * FROM plans ORDER BY sort_order ASC');

  return rows.map((r) => ({
    id: r.id,
    nameAr: r.name_ar,
    nameEn: r.name_en,
    descriptionAr: r.description_ar,
    descriptionEn: r.description_en,
    price: Number(r.price),
    currency: r.currency,
    durationDays: Number(r.duration_days),
    featuresAr: safeParseArray(r.features_ar),
    featuresEn: safeParseArray(r.features_en),
    isPopular: Boolean(r.is_popular),
    isActive: Boolean(r.is_active),
    sortOrder: Number(r.sort_order),
  }));
}

export async function getPlanById(
  id: string
): Promise<{ id: string; duration_days: number } | null> {
  await initDatabase();
  return queryOne<{ id: string; duration_days: number }>(
    'SELECT id, duration_days FROM plans WHERE id = $1',
    [id]
  );
}

export async function updatePlan(
  planId: string,
  data: {
    nameAr: string;
    nameEn: string;
    descriptionAr: string;
    descriptionEn: string;
    price: number;
    currency: string;
    durationDays: number;
    isPopular: number;
    isActive: number;
  }
): Promise<boolean> {
  await initDatabase();
  const res = await execute(
    `UPDATE plans
     SET name_ar = $1, name_en = $2, description_ar = $3, description_en = $4,
         price = $5, currency = $6, duration_days = $7, is_popular = $8, is_active = $9
     WHERE id = $10`,
    [
      data.nameAr,
      data.nameEn,
      data.descriptionAr,
      data.descriptionEn,
      data.price,
      data.currency,
      data.durationDays,
      data.isPopular,
      data.isActive,
      planId,
    ]
  );
  return res.rowCount > 0;
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
    generationCount: Number(row.generation_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getUserById(id: string): Promise<DbUserRow | null> {
  await initDatabase();
  return queryOne<DbUserRow>('SELECT * FROM users WHERE id = $1', [id]);
}

export async function getUserByPhone(phone: string): Promise<DbUserRow | null> {
  await initDatabase();
  return queryOne<DbUserRow>('SELECT * FROM users WHERE phone = $1', [phone]);
}

export async function createUser(params: {
  id: string;
  name: string;
  phone: string;
  passwordHash: string;
  planId: string;
  now: string;
}): Promise<DbUserRow> {
  await initDatabase();
  await execute(
    `INSERT INTO users (
      id, name, phone, password_hash, selected_plan_id, status,
      subscription_start, subscription_end, generation_count, daily_count, daily_date, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, 'pending', NULL, NULL, 0, 0, NULL, $6, $7)`,
    [
      params.id,
      params.name,
      params.phone,
      params.passwordHash,
      params.planId,
      params.now,
      params.now,
    ]
  );
  const created = await getUserById(params.id);
  if (!created) {
    throw new Error('Failed to retrieve newly created user.');
  }
  return created;
}

export async function requestUserRenewal(
  userId: string,
  planId: string,
  now: string
): Promise<DbUserRow | null> {
  await initDatabase();
  await execute(
    'UPDATE users SET selected_plan_id = $1, status = $2, updated_at = $3 WHERE id = $4',
    [planId, 'pending', now, userId]
  );
  return getUserById(userId);
}

export async function incrementUserGeneration(
  userId: string,
  nextDaily: number,
  todayStr: string,
  nowIso: string
): Promise<void> {
  await initDatabase();
  await execute(
    'UPDATE users SET generation_count = generation_count + 1, daily_count = $1, daily_date = $2, updated_at = $3 WHERE id = $4',
    [nextDaily, todayStr, nowIso, userId]
  );
  await execute("UPDATE stats SET value = value + 1 WHERE key = 'total_generations'");
}

export async function listAllUsers(): Promise<DbUserRow[]> {
  await initDatabase();
  return queryAll<DbUserRow>('SELECT * FROM users ORDER BY created_at DESC');
}

export async function adminUpdateUserSubscription(
  userId: string,
  data: {
    planId: string;
    status: SubscriptionStatus;
    subscriptionStart: string | null;
    subscriptionEnd: string | null;
    updatedAt: string;
  }
): Promise<DbUserRow | null> {
  await initDatabase();
  await execute(
    `UPDATE users
     SET selected_plan_id = $1, status = $2, subscription_start = $3, subscription_end = $4, updated_at = $5
     WHERE id = $6`,
    [
      data.planId,
      data.status,
      data.subscriptionStart,
      data.subscriptionEnd,
      data.updatedAt,
      userId,
    ]
  );
  return getUserById(userId);
}

export async function deleteUserById(userId: string): Promise<boolean> {
  await initDatabase();
  const res = await execute('DELETE FROM users WHERE id = $1', [userId]);
  return res.rowCount > 0;
}

export async function getAdminByUsername(
  username: string
): Promise<{ id: string; username: string; password_hash: string } | null> {
  await initDatabase();
  return queryOne<{ id: string; username: string; password_hash: string }>(
    'SELECT id, username, password_hash FROM admins WHERE username = $1',
    [username]
  );
}

export async function getAdminById(
  id: string
): Promise<{ id: string; username: string } | null> {
  await initDatabase();
  return queryOne<{ id: string; username: string }>(
    'SELECT id, username FROM admins WHERE id = $1',
    [id]
  );
}

export async function getTotalGenerations(): Promise<number> {
  await initDatabase();
  const row = await queryOne<{ value: number }>(
    "SELECT value FROM stats WHERE key = 'total_generations'"
  );
  return Number(row?.value ?? 0);
}

export async function getVoiceSampleCache(
  cacheKey: string
): Promise<{ audio_base64: string; duration_seconds: number } | null> {
  await initDatabase();
  return queryOne<{ audio_base64: string; duration_seconds: number }>(
    'SELECT audio_base64, duration_seconds FROM voice_samples_cache WHERE cache_key = $1',
    [cacheKey]
  );
}

export async function saveVoiceSampleCache(
  cacheKey: string,
  audioBase64: string,
  durationSeconds: number,
  createdAt: string
): Promise<void> {
  await initDatabase();
  await execute(
    `INSERT INTO voice_samples_cache (cache_key, audio_base64, duration_seconds, created_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (cache_key) DO UPDATE SET
       audio_base64 = EXCLUDED.audio_base64,
       duration_seconds = EXCLUDED.duration_seconds,
       created_at = EXCLUDED.created_at`,
    [cacheKey, audioBase64, durationSeconds, createdAt]
  );
}

export async function refreshUserExpiration(row: DbUserRow): Promise<DbUserRow> {
  if (row.status === 'active' && row.subscription_end) {
    const endMs = new Date(row.subscription_end).getTime();
    if (!Number.isNaN(endMs) && endMs <= Date.now()) {
      const nowIso = new Date().toISOString();
      await execute('UPDATE users SET status = $1, updated_at = $2 WHERE id = $3', [
        'expired',
        nowIso,
        row.id,
      ]);
      return { ...row, status: 'expired', updated_at: nowIso };
    }
  }
  return row;
}

export async function expireAllOverdueSubscriptions(): Promise<void> {
  await initDatabase();
  const nowIso = new Date().toISOString();
  await execute(
    "UPDATE users SET status = 'expired', updated_at = $1 WHERE status = 'active' AND subscription_end IS NOT NULL AND subscription_end <= $2",
    [nowIso, nowIso]
  );
}
