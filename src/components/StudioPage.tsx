import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Lock,
  Mic2,
  Sliders,
  Sparkles,
  Volume2,
} from 'lucide-react';
import type { Lang } from '../i18n/translations';
import { TEXT } from '../i18n/translations';
import { api, getUserToken, type PromptAnalysis } from '../lib/api';
import { base64ToBlob, saveLocalProject } from '../lib/localProjectsDb';
import {
  VOICE_CHARACTERS,
  type SiteSettings,
  type UserProfile,
  type VoiceSettings,
} from '../shared/voices';
import { AudioPlayerBar } from './AudioPlayerBar';

export interface StudioDraft {
  mode: 'smart' | 'manual';
  title: string;
  prompt: string;
  spokenText: string;
  characterId: string;
  settings: VoiceSettings;
  audioBlob: Blob | null;
  durationSeconds: number;
}

interface StudioPageProps {
  lang: Lang;
  user: UserProfile | null;
  siteSettings: SiteSettings;
  draft: StudioDraft;
  onChangeDraft: (next: StudioDraft) => void;
  onGoToAuth: () => void;
  onRefreshUser: () => Promise<void>;
}

export function StudioPage({
  lang,
  user,
  siteSettings,
  draft,
  onChangeDraft,
  onGoToAuth,
  onRefreshUser,
}: StudioPageProps) {
  const t = TEXT[lang];
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [analysis, setAnalysis] = useState<PromptAnalysis | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedFlag, setSavedFlag] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!draft.audioBlob) {
      setAudioUrl(null);
      return;
    }
    const url = URL.createObjectURL(draft.audioBlob);
    setAudioUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [draft.audioBlob]);

  const isSubscriptionActive = Boolean(
    user &&
      user.status === 'active' &&
      (!user.subscriptionEnd || new Date(user.subscriptionEnd).getTime() > Date.now())
  );

  const updateSettings = <K extends keyof VoiceSettings>(key: K, value: VoiceSettings[K]) => {
    setSavedFlag(false);
    onChangeDraft({
      ...draft,
      settings: {
        ...draft.settings,
        [key]: value,
      },
    });
  };

  const handleAnalyzePrompt = async () => {
    setErrorMsg(null);
    setSavedFlag(false);
    const token = getUserToken();
    if (!token || !isSubscriptionActive) {
      setErrorMsg(t.studio.gateLockedTitle);
      return;
    }
    if (!draft.prompt.trim()) {
      setErrorMsg(
        lang === 'ar'
          ? 'يرجى كتابة وصف (Prompt) أولاً لتحليله.'
          : 'Please write a descriptive prompt first.'
      );
      return;
    }

    setAnalyzing(true);
    try {
      const res = await api.analyzePrompt(token, draft.prompt);
      const a = res.analysis;
      setAnalysis(a);
      onChangeDraft({
        ...draft,
        spokenText: a.spokenText,
        characterId: a.characterId,
        settings: {
          language: a.language,
          dialect: a.dialect,
          voiceGender: a.gender,
          speed: a.speed,
          pitch: a.pitch,
          emotion: a.emotion,
          emotionIntensity: a.emotionIntensity,
          deliveryMode: a.deliveryMode,
          pauses: a.pauses,
          customStyleNotes: a.styleDescription,
        },
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to analyze prompt.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerateVoice = async () => {
    setErrorMsg(null);
    setSavedFlag(false);
    const token = getUserToken();
    if (!token || !isSubscriptionActive) {
      setErrorMsg(t.studio.gateLockedTitle);
      return;
    }

    const textToSpeak = draft.spokenText.trim() || draft.prompt.trim();
    if (!textToSpeak) {
      setErrorMsg(
        lang === 'ar'
          ? 'يرجى كتابة النص المطلوب تحويله إلى صوت.'
          : 'Please enter the text to synthesize.'
      );
      return;
    }

    setGenerating(true);
    try {
      const res = await api.generateVoice(token, {
        spokenText: textToSpeak,
        characterId: draft.characterId,
        settings: draft.settings,
      });

      const blob = base64ToBlob(res.audioBase64, res.mimeType);
      onChangeDraft({
        ...draft,
        spokenText: textToSpeak,
        audioBlob: blob,
        durationSeconds: res.durationSeconds,
      });
      await onRefreshUser();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Voice generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveLocally = async () => {
    if (!user || !draft.audioBlob) return;
    setErrorMsg(null);
    const charObj = VOICE_CHARACTERS.find((v) => v.id === draft.characterId);
    const fallbackTitle =
      draft.spokenText.trim().slice(0, 42) ||
      (lang === 'ar' ? charObj?.nameAr : charObj?.nameEn) ||
      'Voice Project';

    const now = new Date().toISOString();
    try {
      await saveLocalProject({
        id: crypto.randomUUID(),
        userId: user.id,
        title: draft.title.trim() || fallbackTitle,
        prompt: draft.prompt,
        spokenText: draft.spokenText,
        characterId: draft.characterId,
        settings: draft.settings,
        audioBlob: draft.audioBlob,
        durationSeconds: draft.durationSeconds,
        createdAt: now,
        updatedAt: now,
      });
      setSavedFlag(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save project locally.');
    }
  };

  const selectedVoice =
    VOICE_CHARACTERS.find((v) => v.id === draft.characterId) || VOICE_CHARACTERS[0];

  if (!isSubscriptionActive) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-white/10 bg-[#0F101A] p-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-300">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-white">{t.studio.gateLockedTitle}</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-slate-300">
            {!user
              ? lang === 'ar'
                ? 'لبدء توليد الأصوات بالذكاء الاصطناعي، يرجى تسجيل الدخول برقم هاتفك أو إنشاء حساب جديد وانتظار موافقة الإدارة على باقة الاشتراك.'
                : 'To generate AI voices in the studio, please sign in with your phone number or register an account for admin subscription approval.'
              : user.status === 'pending'
              ? t.auth.pendingNotice
              : user.status === 'expired'
              ? t.auth.expiredNotice
              : user.status === 'rejected'
              ? t.auth.rejectedNotice
              : t.auth.suspendedNotice}
          </p>
          {user && (
            <div className="mt-4 text-xs text-slate-400">
              {user.name} · <span className="font-mono-num">{user.phone}</span> ·{' '}
              <span className="font-semibold text-amber-300">
                {t.auth.statusLabels[user.status]}
              </span>
            </div>
          )}
          <div className="mt-7">
            <button
              type="button"
              onClick={onGoToAuth}
              className="rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:from-violet-500 hover:to-blue-500 whitespace-nowrap"
            >
              {user ? t.studio.gateRenewBtn : t.studio.gateLoginBtn}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Studio Header & Mode Switcher */}
      <div className="flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t.studio.title}</h1>
          <p className="mt-1 text-sm text-slate-400">{t.studio.subtitle}</p>
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-[#0F101A] p-1 self-start">
          <button
            type="button"
            onClick={() => onChangeDraft({ ...draft, mode: 'smart' })}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              draft.mode === 'smart'
                ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{t.studio.modeSmart}</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeDraft({ ...draft, mode: 'manual' })}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              draft.mode === 'manual'
                ? 'bg-[#1D2036] text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>{t.studio.modeManual}</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {savedFlag && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{t.studio.savedSuccess}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left / Main Workspace */}
        <div className="space-y-5 lg:col-span-7">
          {draft.mode === 'smart' && (
            <div className="space-y-4 rounded-2xl border border-white/10 bg-[#0F101A] p-5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-white">{t.studio.promptLabel}</label>
                <span className="text-xs text-slate-400">
                  {lang === 'ar' ? 'العربية · English' : 'Arabic · English'}
                </span>
              </div>

              <textarea
                rows={4}
                value={draft.prompt}
                onChange={(e) => onChangeDraft({ ...draft, prompt: e.target.value })}
                placeholder={t.studio.promptPlaceholder}
                className="w-full rounded-xl border border-white/10 bg-[#090A12] p-3.5 text-sm leading-relaxed text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
              />

              <div className="space-y-2">
                <div className="text-xs text-slate-400">{t.studio.presetsLabel}</div>
                <div className="flex flex-wrap gap-2">
                  {t.studio.presets.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onChangeDraft({ ...draft, prompt: preset })}
                      className="rounded-lg border border-white/10 bg-[#151726] px-3 py-1.5 text-start text-xs text-slate-300 transition-colors hover:border-blue-500/40 hover:text-white"
                    >
                      {preset.length > 58 ? `${preset.slice(0, 58)}...` : preset}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleAnalyzePrompt}
                disabled={analyzing}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-violet-500/40 bg-violet-600/20 px-4 py-3 text-sm font-semibold text-violet-200 transition-colors hover:bg-violet-600/30 disabled:opacity-60"
              >
                {analyzing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                <span>{analyzing ? t.studio.analyzing : t.studio.analyzeBtn}</span>
              </button>

              {analysis && (
                <div className="space-y-3 rounded-xl border border-blue-500/25 bg-[#090A12] p-4">
                  <div className="text-xs font-semibold text-blue-300">
                    {t.studio.aiSummaryTitle}
                  </div>
                  <p className="text-xs leading-relaxed text-slate-300">
                    {lang === 'ar' ? analysis.summaryAr : analysis.summaryEn}
                  </p>
                  <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-3 text-xs sm:grid-cols-4">
                    <div>
                      <span className="text-slate-500">{t.settingsLabels.gender}: </span>
                      <span className="text-slate-200">{t.options.genders[analysis.gender]}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">{t.settingsLabels.dialect}: </span>
                      <span className="text-slate-200">{t.options.dialects[analysis.dialect]}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">{t.settingsLabels.emotion}: </span>
                      <span className="text-slate-200">{t.options.emotions[analysis.emotion]}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">{t.settingsLabels.speed}: </span>
                      <span className="text-slate-200">{t.options.speeds[analysis.speed]}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Spoken Text & Character Selector */}
          <div className="space-y-4 rounded-2xl border border-white/10 bg-[#0F101A] p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  {t.studio.selectCharacter}
                </label>
                <select
                  value={draft.characterId}
                  onChange={(e) => {
                    const nextChar = VOICE_CHARACTERS.find((v) => v.id === e.target.value);
                    onChangeDraft({
                      ...draft,
                      characterId: e.target.value,
                      settings: nextChar
                        ? {
                            ...draft.settings,
                            voiceGender: nextChar.gender,
                            pitch: nextChar.defaultPitch,
                            deliveryMode: nextChar.defaultDelivery,
                          }
                        : draft.settings,
                    });
                  }}
                  className="w-full rounded-xl border border-white/10 bg-[#090A12] px-3 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  {VOICE_CHARACTERS.map((v) => (
                    <option key={v.id} value={v.id}>
                      {lang === 'ar' ? v.nameAr : v.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  {t.studio.projectTitlePlaceholder}
                </label>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) => onChangeDraft({ ...draft, title: e.target.value })}
                  placeholder={t.studio.projectTitlePlaceholder}
                  className="w-full rounded-xl border border-white/10 bg-[#090A12] px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="rounded-lg border border-white/5 bg-[#090A12] px-3.5 py-2.5 text-xs text-slate-400">
              <span className="font-semibold text-slate-200">
                {lang === 'ar' ? selectedVoice.nameAr : selectedVoice.nameEn}
              </span>{' '}
              · {lang === 'ar' ? selectedVoice.descriptionAr : selectedVoice.descriptionEn}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-sm font-semibold text-white">{t.studio.spokenLabel}</label>
                <span className="font-mono-num text-xs text-slate-400">
                  {draft.spokenText.length} / {siteSettings.maxCharsPerGeneration}
                </span>
              </div>
              <textarea
                rows={4}
                value={draft.spokenText}
                onChange={(e) => {
                  setSavedFlag(false);
                  onChangeDraft({ ...draft, spokenText: e.target.value });
                }}
                placeholder={t.studio.spokenPlaceholder}
                className="w-full rounded-xl border border-white/10 bg-[#090A12] p-3.5 text-sm leading-relaxed text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleGenerateVoice}
              disabled={generating}
              className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-950/50 transition-all hover:from-violet-500 hover:to-blue-500 disabled:opacity-60"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mic2 className="h-4 w-4" />
              )}
              <span>{generating ? t.studio.generating : t.studio.generateBtn}</span>
            </button>
          </div>

          {/* Generated Audio Player */}
          {audioUrl && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-blue-300">
                <Volume2 className="h-4 w-4" />
                <span>{lang === 'ar' ? 'الملف الصوتي المولّد' : 'Generated Studio Audio'}</span>
              </div>
              <AudioPlayerBar
                lang={lang}
                audioUrl={audioUrl}
                durationSeconds={draft.durationSeconds}
                fileName={`${(draft.title || 'voiceprompt').replace(/\s+/g, '-')}.wav`}
                onRegenerate={handleGenerateVoice}
                regenerating={generating}
                onSaveLocal={handleSaveLocally}
                saved={savedFlag}
              />
            </div>
          )}
        </div>

        {/* Right Panel: Professional Voice Controls */}
        <div className="space-y-4 rounded-2xl border border-white/10 bg-[#0F101A] p-5 lg:col-span-5">
          <div className="flex items-center gap-2 border-b border-white/10 pb-3">
            <Sliders className="h-4 w-4 text-violet-400" />
            <h2 className="text-sm font-bold text-white">{t.studio.settingsTitle}</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs text-slate-400">
                {t.settingsLabels.language}
              </label>
              <select
                value={draft.settings.language}
                onChange={(e) => {
                  const nextLang = e.target.value as 'ar' | 'en';
                  onChangeDraft({
                    ...draft,
                    settings: {
                      ...draft.settings,
                      language: nextLang,
                      dialect:
                        nextLang === 'en' && !draft.settings.dialect.startsWith('english')
                          ? 'english_us'
                          : nextLang === 'ar' && draft.settings.dialect.startsWith('english')
                          ? 'msa'
                          : draft.settings.dialect,
                    },
                  });
                }}
                className="w-full rounded-xl border border-white/10 bg-[#090A12] px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="ar">{t.options.languages.ar}</option>
                <option value="en">{t.options.languages.en}</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-slate-400">
                {t.settingsLabels.dialect}
              </label>
              <select
                value={draft.settings.dialect}
                onChange={(e) =>
                  updateSettings('dialect', e.target.value as VoiceSettings['dialect'])
                }
                className="w-full rounded-xl border border-white/10 bg-[#090A12] px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
              >
                {Object.entries(t.options.dialects).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-slate-400">
                {t.settingsLabels.gender}
              </label>
              <select
                value={draft.settings.voiceGender}
                onChange={(e) =>
                  updateSettings('voiceGender', e.target.value as VoiceSettings['voiceGender'])
                }
                className="w-full rounded-xl border border-white/10 bg-[#090A12] px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
              >
                {Object.entries(t.options.genders).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-slate-400">
                {t.settingsLabels.speed}
              </label>
              <select
                value={draft.settings.speed}
                onChange={(e) => updateSettings('speed', e.target.value as VoiceSettings['speed'])}
                className="w-full rounded-xl border border-white/10 bg-[#090A12] px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
              >
                {Object.entries(t.options.speeds).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-slate-400">
                {t.settingsLabels.pitch}
              </label>
              <select
                value={draft.settings.pitch}
                onChange={(e) => updateSettings('pitch', e.target.value as VoiceSettings['pitch'])}
                className="w-full rounded-xl border border-white/10 bg-[#090A12] px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
              >
                {Object.entries(t.options.pitches).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-slate-400">
                {t.settingsLabels.pauses}
              </label>
              <select
                value={draft.settings.pauses}
                onChange={(e) => updateSettings('pauses', e.target.value as VoiceSettings['pauses'])}
                className="w-full rounded-xl border border-white/10 bg-[#090A12] px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
              >
                {Object.entries(t.options.pauses).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Emotion Selector */}
          <div className="space-y-2 border-t border-white/10 pt-3">
            <label className="block text-xs text-slate-400">{t.settingsLabels.emotion}</label>
            <div className="grid grid-cols-3 gap-1.5">
              {Object.entries(t.options.emotions).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => updateSettings('emotion', k as VoiceSettings['emotion'])}
                  className={`rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors whitespace-nowrap truncate ${
                    draft.settings.emotion === k
                      ? 'border-violet-500 bg-violet-600/25 text-white'
                      : 'border-white/10 bg-[#090A12] text-slate-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Emotion Intensity Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">{t.settingsLabels.emotionIntensity}</span>
              <span className="font-mono-num font-semibold text-blue-300">
                {draft.settings.emotionIntensity}%
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={draft.settings.emotionIntensity}
              onChange={(e) => updateSettings('emotionIntensity', Number(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-violet-500"
            />
          </div>

          {/* Delivery & Dynamics (Whisper / Shout / Narrative / Comedy) */}
          <div className="space-y-2 border-t border-white/10 pt-3">
            <label className="block text-xs text-slate-400">{t.settingsLabels.deliveryMode}</label>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {Object.entries(t.options.deliveries).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => updateSettings('deliveryMode', k as VoiceSettings['deliveryMode'])}
                  className={`rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors whitespace-nowrap truncate ${
                    draft.settings.deliveryMode === k
                      ? 'border-blue-500 bg-blue-600/25 text-white'
                      : 'border-white/10 bg-[#090A12] text-slate-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Style Notes */}
          <div className="space-y-1.5">
            <label className="block text-xs text-slate-400">{t.settingsLabels.customNotes}</label>
            <input
              type="text"
              value={draft.settings.customStyleNotes || ''}
              onChange={(e) => updateSettings('customStyleNotes', e.target.value)}
              placeholder={
                lang === 'ar'
                  ? 'مثال: تنفس سريع متقطع مع نبرة مترددة'
                  : 'e.g., trembling breath, slight pause before last word'
              }
              className="w-full rounded-xl border border-white/10 bg-[#090A12] px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
