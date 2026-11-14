import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import {
  DEFAULT_VOICE_SETTINGS,
  VOICE_CHARACTERS,
  type SubscriptionStatus,
  type VoiceSettings,
} from './src/shared/voices.ts';
import {
  db,
  expireAllOverdueSubscriptions,
  getAllPlans,
  getSiteSettings,
  hashPassword,
  initDatabase,
  refreshUserExpiration,
  sanitizeUser,
  verifyPassword,
  type DbUserRow,
} from './server/db.ts';
import {
  requireActiveSubscription,
  requireAdmin,
  requireUser,
  signToken,
  type AuthedRequest,
} from './server/auth.ts';
import { analyzeVoicePrompt, generateExpressiveSpeech } from './server/gemini.ts';

initDatabase();

const app = express();
app.use(express.json({ limit: '2mb' }));

function normalizePhone(raw: string): string {
  return raw.replace(/[\s\-()]/g, '').trim();
}

function isValidPhone(phone: string): boolean {
  return /^\+?[0-9]{7,16}$/.test(phone);
}

// ---------------------------------------------------------------------------
// Public Routes (Plans, Settings, Voice Catalog & Real Cached Voice Samples)
// ---------------------------------------------------------------------------

app.get('/api/public/config', (_req: Request, res: Response) => {
  const settings = getSiteSettings();
  const plans = getAllPlans();
  res.json({ settings, plans });
});

app.get('/api/voices', (_req: Request, res: Response) => {
  res.json({ voices: VOICE_CHARACTERS });
});

app.get('/api/voices/:id/sample', async (req: Request, res: Response) => {
  try {
    const voiceId = String(req.params.id || '');
    const lang = req.query.lang === 'en' ? 'en' : 'ar';
    const voice = VOICE_CHARACTERS.find((v) => v.id === voiceId);
    if (!voice) {
      res.status(404).json({ error: 'Voice character not found.' });
      return;
    }

    const cacheKey = `${voice.id}_${lang}`;
    const cached = db
      .prepare('SELECT audio_base64, duration_seconds FROM voice_samples_cache WHERE cache_key = ?')
      .get(cacheKey) as { audio_base64: string; duration_seconds: number } | undefined;

    if (cached) {
      res.json({
        audioBase64: cached.audio_base64,
        mimeType: 'audio/wav',
        durationSeconds: cached.duration_seconds,
        cached: true,
      });
      return;
    }

    const sampleSettings: VoiceSettings = {
      ...DEFAULT_VOICE_SETTINGS,
      language: lang,
      dialect: lang === 'en' ? 'english_us' : 'msa',
      voiceGender: voice.gender,
      pitch: voice.defaultPitch,
      deliveryMode: voice.defaultDelivery,
      emotion:
        voice.id === 'horror'
          ? 'horror'
          : voice.id === 'comedic'
          ? 'laughter'
          : voice.id === 'energetic'
          ? 'excitement'
          : voice.id === 'little_girl'
          ? 'fear'
          : 'neutral',
      emotionIntensity: 70,
    };

    const result = await generateExpressiveSpeech({
      spokenText: lang === 'en' ? voice.sampleTextEn : voice.sampleTextAr,
      characterId: voice.id,
      settings: sampleSettings,
    });

    db.prepare(
      'INSERT OR REPLACE INTO voice_samples_cache (cache_key, audio_base64, duration_seconds, created_at) VALUES (?, ?, ?, ?)'
    ).run(cacheKey, result.audioBase64, result.durationSeconds, new Date().toISOString());

    res.json({
      audioBase64: result.audioBase64,
      mimeType: result.mimeType,
      durationSeconds: result.durationSeconds,
      cached: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate voice sample.';
    res.status(502).json({ error: message });
  }
});

// ---------------------------------------------------------------------------
// User Auth Routes (Phone + Password ONLY — No Email Login)
// ---------------------------------------------------------------------------

app.post('/api/auth/register', (req: Request, res: Response) => {
  const settings = getSiteSettings();
  if (!settings.registrationEnabled) {
    res.status(403).json({
      error: 'New user registrations are currently paused by the administrator.',
      code: 'REGISTRATION_DISABLED',
    });
    return;
  }

  const name = String(req.body?.name ?? '').trim();
  const phone = normalizePhone(String(req.body?.phone ?? ''));
  const password = String(req.body?.password ?? '');
  const confirmPassword = String(req.body?.confirmPassword ?? '');
  const planId = String(req.body?.planId ?? '1_month');

  if (name.length < 2 || name.length > 80) {
    res.status(400).json({ error: 'Name must be between 2 and 80 characters.' });
    return;
  }
  if (!isValidPhone(phone)) {
    res.status(400).json({ error: 'Please enter a valid phone number (7–16 digits).' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    return;
  }
  if (password !== confirmPassword) {
    res.status(400).json({ error: 'Password and confirmation password do not match.' });
    return;
  }

  const plan = db.prepare('SELECT id FROM plans WHERE id = ?').get(planId);
  if (!plan) {
    res.status(400).json({ error: 'Invalid subscription plan selected.' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
  if (existing) {
    res.status(409).json({ error: 'An account with this phone number is already registered.' });
    return;
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const passwordHash = hashPassword(password);

  db.prepare(
    `INSERT INTO users (
      id, name, phone, password_hash, selected_plan_id, status,
      subscription_start, subscription_end, generation_count, daily_count, daily_date, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'pending', NULL, NULL, 0, 0, NULL, ?, ?)`
  ).run(id, name, phone, passwordHash, planId, now, now);

  const created = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as DbUserRow;
  const token = signToken(id, 'user');

  res.status(201).json({
    token,
    user: sanitizeUser(created),
  });
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  const phone = normalizePhone(String(req.body?.phone ?? ''));
  const password = String(req.body?.password ?? '');

  if (!phone || !password) {
    res.status(400).json({ error: 'Phone number and password are required.' });
    return;
  }

  const row = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone) as DbUserRow | undefined;
  if (!row || !verifyPassword(password, row.password_hash)) {
    res.status(401).json({ error: 'Invalid phone number or password.' });
    return;
  }

  const refreshed = refreshUserExpiration(row);
  const token = signToken(refreshed.id, 'user');

  res.json({
    token,
    user: sanitizeUser(refreshed),
  });
});

app.get('/api/auth/me', requireUser, (req: AuthedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  res.json({ user: sanitizeUser(req.user) });
});

app.post('/api/auth/request-renewal', requireUser, (req: AuthedRequest, res: Response) => {
  const user = req.user!;
  const planId = String(req.body?.planId ?? user.selected_plan_id);
  const plan = db.prepare('SELECT id FROM plans WHERE id = ?').get(planId);
  if (!plan) {
    res.status(400).json({ error: 'Invalid subscription plan.' });
    return;
  }
  const now = new Date().toISOString();
  db.prepare(
    'UPDATE users SET selected_plan_id = ?, status = ?, updated_at = ? WHERE id = ?'
  ).run(planId, 'pending', now, user.id);

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as DbUserRow;
  res.json({ user: sanitizeUser(updated) });
});

// ---------------------------------------------------------------------------
// AI Studio Routes (Strictly Protected by Active Non-Expired Subscription)
// ---------------------------------------------------------------------------

app.post(
  '/api/ai/analyze-prompt',
  requireUser,
  requireActiveSubscription,
  async (req: AuthedRequest, res: Response) => {
    try {
      const prompt = String(req.body?.prompt ?? '').trim();
      if (!prompt || prompt.length < 3) {
        res.status(400).json({ error: 'Please write a descriptive prompt to analyze.' });
        return;
      }
      if (prompt.length > 3000) {
        res.status(400).json({ error: 'Prompt is too long (maximum 3000 characters).' });
        return;
      }

      const analysis = await analyzeVoicePrompt(prompt);
      res.json({ analysis });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to analyze prompt.';
      res.status(502).json({ error: message });
    }
  }
);

app.post(
  '/api/ai/generate-voice',
  requireUser,
  requireActiveSubscription,
  async (req: AuthedRequest, res: Response) => {
    try {
      const user = req.user!;
      const settings = getSiteSettings();
      const spokenText = String(req.body?.spokenText ?? '').trim();
      const characterId = String(req.body?.characterId ?? 'young_woman');
      const voiceSettings = (req.body?.settings ?? DEFAULT_VOICE_SETTINGS) as VoiceSettings;

      if (!spokenText) {
        res.status(400).json({ error: 'Please enter the text to convert into speech.' });
        return;
      }

      if (spokenText.length > settings.maxCharsPerGeneration) {
        res.status(400).json({
          error: `Text exceeds maximum allowed length (${settings.maxCharsPerGeneration} characters).`,
        });
        return;
      }

      // Enforce daily limit if configured > 0
      const todayStr = new Date().toISOString().slice(0, 10);
      const currentDailyCount = user.daily_date === todayStr ? user.daily_count : 0;
      if (settings.dailyGenerationLimit > 0 && currentDailyCount >= settings.dailyGenerationLimit) {
        res.status(429).json({
          error: `Daily generation limit reached (${settings.dailyGenerationLimit}/day).`,
        });
        return;
      }

      const generated = await generateExpressiveSpeech({
        spokenText,
        characterId,
        settings: {
          ...DEFAULT_VOICE_SETTINGS,
          ...voiceSettings,
        },
      });

      const nextDaily = currentDailyCount + 1;
      const nowIso = new Date().toISOString();

      db.prepare(
        'UPDATE users SET generation_count = generation_count + 1, daily_count = ?, daily_date = ?, updated_at = ? WHERE id = ?'
      ).run(nextDaily, todayStr, nowIso, user.id);

      db.prepare(
        "UPDATE stats SET value = value + 1 WHERE key = 'total_generations'"
      ).run();

      res.json({
        audioBase64: generated.audioBase64,
        mimeType: generated.mimeType,
        durationSeconds: generated.durationSeconds,
        characterUsed: generated.characterUsed,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Speech generation failed.';
      res.status(502).json({ error: message });
    }
  }
);

// ---------------------------------------------------------------------------
// Admin Authentication & Dashboard Routes
// ---------------------------------------------------------------------------

app.post('/api/admin/login', (req: Request, res: Response) => {
  const username = String(req.body?.username ?? '').trim();
  const password = String(req.body?.password ?? '');

  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required.' });
    return;
  }

  const admin = db
    .prepare('SELECT id, username, password_hash FROM admins WHERE username = ?')
    .get(username) as { id: string; username: string; password_hash: string } | undefined;

  if (!admin || !verifyPassword(password, admin.password_hash)) {
    res.status(401).json({ error: 'Invalid administrator credentials.' });
    return;
  }

  const token = signToken(admin.id, 'admin');
  res.json({ token, admin: { username: admin.username } });
});

app.get('/api/admin/dashboard', requireAdmin, (_req: AuthedRequest, res: Response) => {
  expireAllOverdueSubscriptions();

  const users = (
    db.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as DbUserRow[]
  ).map(sanitizeUser);

  const plans = getAllPlans();
  const settings = getSiteSettings();
  const genRow = db.prepare("SELECT value FROM stats WHERE key = 'total_generations'").get() as
    | { value: number }
    | undefined;

  const stats = {
    totalUsers: users.length,
    activeSubscriptions: users.filter((u) => u.status === 'active').length,
    pendingSubscriptions: users.filter((u) => u.status === 'pending').length,
    expiredSubscriptions: users.filter((u) => u.status === 'expired').length,
    rejectedSubscriptions: users.filter((u) => u.status === 'rejected').length,
    suspendedAccounts: users.filter((u) => u.status === 'suspended').length,
    totalGenerations: genRow?.value ?? 0,
  };

  res.json({ stats, users, plans, settings });
});

app.patch('/api/admin/users/:id/subscription', requireAdmin, (req: AuthedRequest, res: Response) => {
  const userId = String(req.params.id || '');
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as
    | DbUserRow
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const action = String(req.body?.action ?? '');
  const planId = String(req.body?.planId ?? existing.selected_plan_id);
  const customDays = req.body?.durationDays !== undefined ? Number(req.body.durationDays) : null;
  const customStart = req.body?.subscriptionStart ? String(req.body.subscriptionStart) : null;
  const customEnd = req.body?.subscriptionEnd ? String(req.body.subscriptionEnd) : null;
  const now = new Date();
  const nowIso = now.toISOString();

  const plan = db.prepare('SELECT duration_days FROM plans WHERE id = ?').get(planId) as
    | { duration_days: number }
    | undefined;
  const durationDays = customDays && customDays > 0 ? customDays : plan?.duration_days ?? 30;

  let nextStatus: SubscriptionStatus = existing.status;
  let nextStart = existing.subscription_start;
  let nextEnd = existing.subscription_end;

  if (action === 'approve' || action === 'activate' || action === 'renew') {
    nextStatus = 'active';
    const startDate = customStart ? new Date(customStart) : now;
    const endDate = customEnd
      ? new Date(customEnd)
      : new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
    nextStart = startDate.toISOString();
    nextEnd = endDate.toISOString();
  } else if (action === 'reject') {
    nextStatus = 'rejected';
  } else if (action === 'suspend') {
    nextStatus = 'suspended';
  } else if (action === 'expire') {
    nextStatus = 'expired';
    nextEnd = nowIso;
  } else if (action === 'update_dates') {
    if (customStart) nextStart = new Date(customStart).toISOString();
    if (customEnd) {
      const endDate = new Date(customEnd);
      nextEnd = endDate.toISOString();
      if (req.body?.status) {
        nextStatus = req.body.status as SubscriptionStatus;
      } else {
        nextStatus = endDate.getTime() > Date.now() ? 'active' : 'expired';
      }
    }
  } else if (req.body?.status) {
    nextStatus = req.body.status as SubscriptionStatus;
  } else {
    res.status(400).json({ error: 'Invalid subscription action.' });
    return;
  }

  db.prepare(
    `UPDATE users
     SET selected_plan_id = ?, status = ?, subscription_start = ?, subscription_end = ?, updated_at = ?
     WHERE id = ?`
  ).run(planId, nextStatus, nextStart, nextEnd, nowIso, userId);

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as DbUserRow;
  res.json({ user: sanitizeUser(updated) });
});

app.delete('/api/admin/users/:id', requireAdmin, (req: AuthedRequest, res: Response) => {
  const userId = String(req.params.id || '');
  const info = db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  if (info.changes === 0) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  res.json({ deleted: true, id: userId });
});

app.put('/api/admin/plans/:id', requireAdmin, (req: AuthedRequest, res: Response) => {
  const planId = String(req.params.id || '');
  const existing = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
  if (!existing) {
    res.status(404).json({ error: 'Plan not found.' });
    return;
  }

  const price = Number(req.body?.price);
  const durationDays = Number(req.body?.durationDays);
  const nameAr = String(req.body?.nameAr ?? '').trim();
  const nameEn = String(req.body?.nameEn ?? '').trim();
  const descriptionAr = String(req.body?.descriptionAr ?? '').trim();
  const descriptionEn = String(req.body?.descriptionEn ?? '').trim();
  const currency = String(req.body?.currency ?? 'EGP').trim() || 'EGP';
  const isPopular = req.body?.isPopular ? 1 : 0;
  const isActive = req.body?.isActive === false ? 0 : 1;

  if (Number.isNaN(price) || price < 0) {
    res.status(400).json({ error: 'Price must be a valid non-negative number.' });
    return;
  }
  if (Number.isNaN(durationDays) || durationDays < 1) {
    res.status(400).json({ error: 'Duration days must be at least 1.' });
    return;
  }

  db.prepare(
    `UPDATE plans
     SET name_ar = ?, name_en = ?, description_ar = ?, description_en = ?,
         price = ?, currency = ?, duration_days = ?, is_popular = ?, is_active = ?
     WHERE id = ?`
  ).run(
    nameAr,
    nameEn,
    descriptionAr,
    descriptionEn,
    price,
    currency,
    durationDays,
    isPopular,
    isActive,
    planId
  );

  res.json({ plans: getAllPlans() });
});

app.put('/api/admin/settings', requireAdmin, (req: AuthedRequest, res: Response) => {
  const siteName = String(req.body?.siteName ?? 'VoicePrompt AI').trim();
  const taglineAr = String(req.body?.taglineAr ?? '').trim();
  const taglineEn = String(req.body?.taglineEn ?? '').trim();
  const registrationEnabled = req.body?.registrationEnabled === false ? 'false' : 'true';
  const maxChars = Math.max(100, Math.min(10000, Number(req.body?.maxCharsPerGeneration ?? 1500)));
  const dailyLimit = Math.max(0, Number(req.body?.dailyGenerationLimit ?? 0));
  const currency = String(req.body?.currency ?? 'EGP').trim() || 'EGP';

  const upsert = db.prepare('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)');
  upsert.run('site_name', siteName || 'VoicePrompt AI');
  upsert.run('tagline_ar', taglineAr || 'اكتب الوصف... واسمع الصوت.');
  upsert.run('tagline_en', taglineEn || 'Your Prompt, Your Voice.');
  upsert.run('registration_enabled', registrationEnabled);
  upsert.run('max_chars_per_generation', String(maxChars));
  upsert.run('daily_generation_limit', String(dailyLimit));
  upsert.run('currency', currency);

  // Sync currency across plans if admin updated global currency
  if (req.body?.syncCurrencyToPlans) {
    db.prepare('UPDATE plans SET currency = ?').run(currency);
  }

  res.json({ settings: getSiteSettings(), plans: getAllPlans() });
});

app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// ---------------------------------------------------------------------------
// Vite Dev Middleware or Static Production Server on Port 3000
// ---------------------------------------------------------------------------

async function startServer() {
  const port = Number(process.env.PORT || 3000);
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`VoicePrompt AI server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start VoicePrompt AI server:', err);
  process.exit(1);
});
