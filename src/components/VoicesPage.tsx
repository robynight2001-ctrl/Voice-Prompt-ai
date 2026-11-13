import { useEffect, useRef, useState } from 'react';
import { Loader2, Pause, Play, Search, Volume2 } from 'lucide-react';
import type { Lang } from '../i18n/translations';
import { TEXT } from '../i18n/translations';
import { api } from '../lib/api';
import { base64ToBlob } from '../lib/localProjectsDb';
import { VOICE_CHARACTERS, type VoiceCharacter, type VoiceGender } from '../shared/voices';

interface VoicesPageProps {
  lang: Lang;
  onSelectVoiceForStudio: (voice: VoiceCharacter) => void;
}

export function VoicesPage({ lang, onSelectVoiceForStudio }: VoicesPageProps) {
  const t = TEXT[lang];
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | VoiceGender>('all');
  const [sampleLang, setSampleLang] = useState<'ar' | 'en'>(lang);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const stopCurrentAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPlayingId(null);
  };

  const handlePlaySample = async (voice: VoiceCharacter) => {
    setErrorMsg(null);
    if (playingId === voice.id) {
      stopCurrentAudio();
      return;
    }

    stopCurrentAudio();
    setLoadingId(voice.id);

    try {
      const res = await api.getVoiceSample(voice.id, sampleLang);
      const blob = base64ToBlob(res.audioBase64, res.mimeType || 'audio/wav');
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        stopCurrentAudio();
      };
      audio.onerror = () => {
        stopCurrentAudio();
        setErrorMsg(
          lang === 'ar'
            ? 'تعذر تشغيل العينة الصوتية.'
            : 'Unable to play the generated audio sample.'
        );
      };
      await audio.play();
      setPlayingId(voice.id);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load voice sample.');
    } finally {
      setLoadingId(null);
    }
  };

  const filtered = VOICE_CHARACTERS.filter((v) => {
    if (genderFilter !== 'all' && v.gender !== genderFilter) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      v.nameAr.toLowerCase().includes(q) ||
      v.nameEn.toLowerCase().includes(q) ||
      v.descriptionAr.toLowerCase().includes(q) ||
      v.descriptionEn.toLowerCase().includes(q) ||
      v.categoryAr.toLowerCase().includes(q) ||
      v.categoryEn.toLowerCase().includes(q)
    );
  });

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl space-y-2">
          <h1 className="text-2xl font-bold text-white sm:text-3xl">{t.voicesPage.title}</h1>
          <p className="text-sm text-slate-400 sm:text-base">{t.voicesPage.subtitle}</p>
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-[#0F101A] p-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              stopCurrentAudio();
              setSampleLang('ar');
            }}
            className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              sampleLang === 'ar' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.voicesPage.sampleLangAr}
          </button>
          <button
            type="button"
            onClick={() => {
              stopCurrentAudio();
              setSampleLang('en');
            }}
            className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              sampleLang === 'en' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.voicesPage.sampleLangEn}
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-[#0F101A] p-1">
          {(['all', 'female', 'male', 'child'] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGenderFilter(g)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                genderFilter === g
                  ? 'bg-[#1D2036] text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.voicesPage.filters[g]}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 ltr:left-3.5 rtl:right-3.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.voicesPage.searchPlaceholder}
            className="w-full rounded-xl border border-white/10 bg-[#0F101A] py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none ltr:pl-10 ltr:pr-4 rtl:pr-10 rtl:pl-4"
          />
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errorMsg}
        </div>
      )}

      {/* Voice Characters Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((voice) => {
          const isLoading = loadingId === voice.id;
          const isPlaying = playingId === voice.id;
          const genderLabel = t.options.genders[voice.gender];

          return (
            <div
              key={voice.id}
              className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0F101A] p-5 transition-colors hover:border-violet-500/40"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-white">
                      {lang === 'ar' ? voice.nameAr : voice.nameEn}
                    </h2>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                      <span>{lang === 'ar' ? voice.categoryAr : voice.categoryEn}</span>
                      <span aria-hidden="true">·</span>
                      <span>{genderLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span>{lang === 'ar' ? voice.ageGroupAr : voice.ageGroupEn}</span>
                    </div>
                  </div>
                  <Volume2 className={`h-4 w-4 shrink-0 ${isPlaying ? 'text-blue-400' : 'text-slate-500'}`} />
                </div>

                <p className="text-xs leading-relaxed text-slate-300">
                  {lang === 'ar' ? voice.descriptionAr : voice.descriptionEn}
                </p>

                <div className="rounded-lg border border-white/5 bg-[#090A12] p-3 text-xs leading-relaxed text-slate-400">
                  «{sampleLang === 'ar' ? voice.sampleTextAr : voice.sampleTextEn}»
                </div>
              </div>

              <div className="mt-5 flex items-center gap-2.5 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => handlePlaySample(voice)}
                  disabled={isLoading}
                  className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    isPlaying
                      ? 'border-blue-500/50 bg-blue-500/15 text-blue-300'
                      : 'border-white/10 bg-[#151726] text-slate-200 hover:border-violet-500/40 hover:text-white'
                  } disabled:opacity-60`}
                >
                  {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {isLoading
                      ? t.voicesPage.loadingSample
                      : isPlaying
                      ? t.voicesPage.stopSample
                      : t.voicesPage.listenSample}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectVoiceForStudio(voice)}
                  className="rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:from-violet-500 hover:to-blue-500 whitespace-nowrap shrink-0"
                >
                  {t.voicesPage.useVoice}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
