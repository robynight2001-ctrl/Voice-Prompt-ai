import 'dotenv/config';
import crypto from 'node:crypto';
import express, { type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import {
  DEFAULT_VOICE_SETTINGS,
  VOICE_CHARACTERS,
  type SubscriptionStatus,
  type VoiceSettings,
} from '../src/shared/voices.ts';
import {
  adminUpdateUserSubscription,
  createUser,
  deleteUserById,
  expireAllOverdueSubscriptions,
  getAdminByUsername,
  getAllPlans,
  getDatabaseKind,
  getPlanById,
  getSiteSettings,
  getTotalGenerations,
  getUserById,
  getUserByPhone,
  getVoiceSampleCache,
  hashPassword,
  incrementUserGeneration,
  initDatabase,
  listAllUsers,
  refreshUserExpiration,
  requestUserRenewal,
  sanitizeUser,
  saveVoiceSampleCache,
  updatePlan,
  updateSiteSettings,
  verifyPassword,
} from './db.ts';
import {
  requireActiveSubscription,
  requireAdmin,
  requireUser,
  signToken,
  type AuthedRequest,
} from './auth.ts';
import { analyzeVoicePrompt, generateExpressiveSpeech } from './gemini.ts';

export const app = express();
app.use(express.json({ limit: '2mb' }));

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function normalizePhone(raw: string): string {
  return raw.replace(/[\s\-()]/g, '').trim();
}

function isValidPhone(phone: string): boolean {
  return /^\+?[0-9]{7,16}$/.test(phone);
}

// ---------------------------------------------------------------------------
// Health & Diagnostics Route
// ---------------------------------------------------------------------------

app.get(
  '/api/health',
  asyncHandler(async (_req: Request, res: Response) => {
    const dbKind = getDatabaseKind();
    const geminiConfigured = Boolean(
      process.env.GEMINI_API_KEY &&
        process.env.GEMINI_API_KEY.trim() !== '' &&
        process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
    );

    let dbReady = false;
    let dbError: string | null = null;
    try {
      await initDatabase();
      dbReady = true;
    } catch (err) {
      dbError = err instanceof Error ? err.message : 'Database initialization failed.';
    }

    res.status(dbReady ? 200 : 503).json({
      ok: dbReady && geminiConfigured,
      database: dbKind,
      dbReady,
      geminiConfigured,
      ...(dbError ? { dbError } : {}),
    });
  })
);

// ---------------------------------------------------------------------------
// Public Routes (Plans, Settings, Voice Catalog & Real Cached Voice Samples)
// ---------------------------------------------------------------------------

app.get(
  '/api/public/config',
  asyncHandler(async (_req: Request, res: Response) => {
    const [settings, plans] = await Promise.all([getSiteSettings(), getAllPlans()]);
    res.json({ settings, plans });
  })
);

app.get('/api/voices', (_req: Request, res: Response) => {
  res.json({ voices: VOICE_CHARACTERS });
});

const EGYPTIAN_SAMPLE_TEXTS: Record<string, string> = {
  young_girl: 'أهلاً بيك! ده صوتي الطبيعي، وأقدر أتكلم بفرح أو خوف أو دهشة بشكل واقعي جدًا.',
  young_boy: 'يا نهار أبيض! شفت اللي حصل دلوقتي؟ المغامرة دي هتكون جامدة جدًا!',
  young_man: 'أهلاً بيك في استوديو الأصوات، هنا بنحول أي جملة تكتبها لصوت حي وواضح.',
  elderly_man: 'اسمع يا ابني، الأيام علمتني إن الصبر هو مفتاح كل باب مقفول في الدنيا.',
  young_woman: 'كل فكرة حلوة بتبدأ بكلمة مكتوبة، ومع الأداء الصح بتوصل لقلب اللي بيسمعها.',
  elderly_woman: 'تعالى اقعد جنبي يا حبيبي، خليني أحكيلك حكاية حلوة من أيام زمان.',
  little_girl: 'ماما! انتي سامعة الصوت ده؟ أنا خايفة أوي ومش عايزة أقعد لوحدي هنا.',
  little_boy: 'بص فوق في السما! الطيارة الورق بتاعتي طارت عالية أوي فوق الشجر!',
  news_anchor: 'أهلاً بكم في نشرة الأخبار، مع أهم المستجدات التقنية وتطورات الذكاء الاصطناعي النهاردة.',
  storyteller: 'في ليلة هادية وضلمة، والهوا ساكت تمامًا، باب القصر القديم اتفتح بالراحة جدًا.',
  cartoon: 'آها! أخيرًا لقيت الكنز المستخبي، بس استنى... هو الصندوق ده بيتحرك لوحده ليه؟!',
  horror: 'ما تبصش وراك دلوقتي... الصوت اللي انت سامعه ده جاي من جوه الأوضة نفسها.',
  calm_soft: 'خد نفس عميق دلوقتي، وسيب كل التعب والتوتر يروح مع الهدوء.',
  energetic: 'جاهزين للانطلاق؟ دي فرصتك تعمل محتوى صوتي رهيب يبهر كل الناس!',
  comedic: 'بصراحة كنت فاكر القهوة هتفوقني، لحد ما نسيت أصلاً أنا حطيت الكوباية فين!',
};

app.get(
  '/api/voices/:id/sample',
  asyncHandler(async (req: Request, res: Response) => {
    const voiceId = String(req.params.id || '');
    const rawLang = String(req.query.lang || 'ar');
    const langKey: 'ar' | 'ar-EG' | 'en' =
      rawLang === 'en' ? 'en' : rawLang === 'ar-EG' ? 'ar-EG' : 'ar';

    const voice = VOICE_CHARACTERS.find((v) => v.id === voiceId);
    if (!voice) {
      res.status(404).json({ error: 'Voice character not found.' });
      return;
    }

    const cacheKey = `${voice.id}_${langKey}`;

    // Read persistent sample cache if DB is available; don't block sample preview if cache read fails
    try {
      const cached = await getVoiceSampleCache(cacheKey);
      if (cached) {
        res.json({
          audioBase64: cached.audio_base64,
          mimeType: 'audio/wav',
          durationSeconds: Number(cached.duration_seconds),
          cached: true,
        });
        return;
      }
    } catch {
      // Proceed to live Gemini TTS synthesis if DB cache is not yet initialized
    }

    const sampleSettings: VoiceSettings = {
      ...DEFAULT_VOICE_SETTINGS,
      language: langKey === 'en' ? 'en' : 'ar',
      dialect: langKey === 'en' ? 'english_us' : langKey === 'ar-EG' ? 'egyptian' : 'msa',
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

    const spokenText =
      langKey === 'en'
        ? voice.sampleTextEn
        : langKey === 'ar-EG'
        ? EGYPTIAN_SAMPLE_TEXTS[voice.id] || voice.sampleTextAr
        : voice.sampleTextAr;

    try {
      const result = await generateExpressiveSpeech({
        spokenText,
        characterId: voice.id,
        settings: sampleSettings,
        preferLite: true,
      });

      try {
        await saveVoiceSampleCache(
          cacheKey,
          result.audioBase64,
          result.durationSeconds,
          new Date().toISOString()
        );
      } catch {
        // Non-fatal if cache write fails; still return generated audio
      }

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
  })
);

// ---------------------------------------------------------------------------
// User Auth Routes (Phone + Password ONLY — No Email Login)
// ---------------------------------------------------------------------------

app.post(
  '/api/auth/register',
  asyncHandler(async (req: Request, res: Response) => {
    const settings = await getSiteSettings();
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

    const plan = await getPlanById(planId);
    if (!plan) {
      res.status(400).json({ error: 'Invalid subscription plan selected.' });
      return;
    }

    const existing = await getUserByPhone(phone);
    if (existing) {
      res.status(409).json({ error: 'An account with this phone number is already registered.' });
      return;
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const passwordHash = hashPassword(password);

    const created = await createUser({
      id,
      name,
      phone,
      passwordHash,
      planId,
      now,
    });
    const token = await signToken(id, 'user');

    res.status(201).json({
      token,
      user: sanitizeUser(created),
    });
  })
);

app.post(
  '/api/auth/login',
  asyncHandler(async (req: Request, res: Response) => {
    const phone = normalizePhone(String(req.body?.phone ?? ''));
    const password = String(req.body?.password ?? '');

    if (!phone || !password) {
      res.status(400).json({ error: 'Phone number and password are required.' });
      return;
    }

    const row = await getUserByPhone(phone);
    if (!row || !verifyPassword(password, row.password_hash)) {
      res.status(401).json({ error: 'Invalid phone number or password.' });
      return;
    }

    const refreshed = await refreshUserExpiration(row);
    const token = await signToken(refreshed.id, 'user');

    res.json({
      token,
      user: sanitizeUser(refreshed),
    });
  })
);

app.get('/api/auth/me', requireUser, (req: AuthedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  res.json({ user: sanitizeUser(req.user) });
});

app.post(
  '/api/auth/request-renewal',
  requireUser,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const planId = String(req.body?.planId ?? user.selected_plan_id);
    const plan = await getPlanById(planId);
    if (!plan) {
      res.status(400).json({ error: 'Invalid subscription plan.' });
      return;
    }
    const now = new Date().toISOString();
    const updated = await requestUserRenewal(user.id, planId, now);
    if (!updated) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    res.json({ user: sanitizeUser(updated) });
  })
);

// ---------------------------------------------------------------------------
// AI Studio Routes (Strictly Protected by Active Non-Expired Subscription)
// ---------------------------------------------------------------------------

app.post(
  '/api/ai/analyze-prompt',
  requireUser,
  requireActiveSubscription,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
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
  })
);

app.post(
  '/api/ai/generate-voice',
  requireUser,
  requireActiveSubscription,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const user = req.user!;
      const settings = await getSiteSettings();
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

      const todayStr = new Date().toISOString().slice(0, 10);
      const currentDailyCount = user.daily_date === todayStr ? Number(user.daily_count) : 0;
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
      await incrementUserGeneration(user.id, nextDaily, todayStr, nowIso);

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
  })
);

// ---------------------------------------------------------------------------
// Admin Authentication & Dashboard Routes
// ---------------------------------------------------------------------------

app.post(
  '/api/admin/login',
  asyncHandler(async (req: Request, res: Response) => {
    const username = String(req.body?.username ?? '').trim();
    const password = String(req.body?.password ?? '');

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required.' });
      return;
    }

    const admin = await getAdminByUsername(username);
    if (!admin || !verifyPassword(password, admin.password_hash)) {
      res.status(401).json({ error: 'Invalid administrator credentials.' });
      return;
    }

    const token = await signToken(admin.id, 'admin');
    res.json({ token, admin: { username: admin.username } });
  })
);

app.get(
  '/api/admin/dashboard',
  requireAdmin,
  asyncHandler(async (_req: AuthedRequest, res: Response) => {
    await expireAllOverdueSubscriptions();

    const [rawUsers, plans, settings, totalGenerations] = await Promise.all([
      listAllUsers(),
      getAllPlans(),
      getSiteSettings(),
      getTotalGenerations(),
    ]);

    const users = rawUsers.map(sanitizeUser);

    const stats = {
      totalUsers: users.length,
      activeSubscriptions: users.filter((u) => u.status === 'active').length,
      pendingSubscriptions: users.filter((u) => u.status === 'pending').length,
      expiredSubscriptions: users.filter((u) => u.status === 'expired').length,
      rejectedSubscriptions: users.filter((u) => u.status === 'rejected').length,
      suspendedAccounts: users.filter((u) => u.status === 'suspended').length,
      totalGenerations,
    };

    res.json({ stats, users, plans, settings });
  })
);

app.patch(
  '/api/admin/users/:id/subscription',
  requireAdmin,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const userId = String(req.params.id || '');
    const existing = await getUserById(userId);
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

    const plan = await getPlanById(planId);
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

    const updated = await adminUpdateUserSubscription(userId, {
      planId,
      status: nextStatus,
      subscriptionStart: nextStart,
      subscriptionEnd: nextEnd,
      updatedAt: nowIso,
    });
    if (!updated) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    res.json({ user: sanitizeUser(updated) });
  })
);

app.delete(
  '/api/admin/users/:id',
  requireAdmin,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const userId = String(req.params.id || '');
    const deleted = await deleteUserById(userId);
    if (!deleted) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    res.json({ deleted: true, id: userId });
  })
);

app.put(
  '/api/admin/plans/:id',
  requireAdmin,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const planId = String(req.params.id || '');
    const existing = await getPlanById(planId);
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

    await updatePlan(planId, {
      nameAr,
      nameEn,
      descriptionAr,
      descriptionEn,
      price,
      currency,
      durationDays,
      isPopular,
      isActive,
    });

    res.json({ plans: await getAllPlans() });
  })
);

app.put(
  '/api/admin/settings',
  requireAdmin,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const siteName = String(req.body?.siteName ?? 'VoicePrompt AI').trim();
    const taglineAr = String(req.body?.taglineAr ?? '').trim();
    const taglineEn = String(req.body?.taglineEn ?? '').trim();
    const registrationEnabled = req.body?.registrationEnabled === false ? 'false' : 'true';
    const maxChars = Math.max(
      100,
      Math.min(10000, Number(req.body?.maxCharsPerGeneration ?? 1500))
    );
    const dailyLimit = Math.max(0, Number(req.body?.dailyGenerationLimit ?? 0));
    const currency = String(req.body?.currency ?? 'EGP').trim() || 'EGP';

    await updateSiteSettings(
      [
        ['site_name', siteName || 'VoicePrompt AI'],
        ['tagline_ar', taglineAr || 'اكتب الوصف... واسمع الصوت.'],
        ['tagline_en', taglineEn || 'Your Prompt, Your Voice.'],
        ['registration_enabled', registrationEnabled],
        ['max_chars_per_generation', String(maxChars)],
        ['daily_generation_limit', String(dailyLimit)],
        ['currency', currency],
      ],
      req.body?.syncCurrencyToPlans ? currency : undefined
    );

    const [settings, plans] = await Promise.all([getSiteSettings(), getAllPlans()]);
    res.json({ settings, plans });
  })
);

app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : 'Internal server error.';
  if (!res.headersSent) {
    res.status(500).json({ error: message });
  }
});
