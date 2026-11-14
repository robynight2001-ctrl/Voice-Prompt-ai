import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, Play, RotateCcw, Search, Square, Volume2 } from 'lucide-react';
import type { Lang } from '../i18n/translations';
import { TEXT } from '../i18n/translations';
import { api } from '../lib/api';
import { base64ToBlob } from '../lib/localProjectsDb';
import { VOICE_CHARACTERS, type VoiceCharacter, type VoiceGender } from '../shared/voices';

interface VoicesPageProps {
  lang: Lang;
  onSelectVoiceForStudio: (voice: VoiceCharacter) => void;
}

type PreviewLang = 'ar' | 'ar-EG' | 'en';

const EGYPTIAN_SAMPLES: Record<string, string> = {
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

export function VoicesPage({ lang, onSelectVoiceForStudio }: VoicesPageProps) {
  const t = TEXT[lang];
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | VoiceGender>('all');
  const [sampleLang, setSampleLang] = useState<PreviewLang>(lang === 'en' ? 'en' : 'ar');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sampleCacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const cache = sampleCacheRef.current;
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      cache.forEach((url) => URL.revokeObjectURL(url));
      cache.clear();
    };
  }, []);

  const stopCurrentAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setPlayingId(null);
  };

  const getSampleText = (voice: VoiceCharacter): string => {
    if (sampleLang === 'en') return voice.sampleTextEn;
    if (sampleLang === 'ar-EG') return EGYPTIAN_SAMPLES[voice.id] || voice.sampleTextAr;
    return voice.sampleTextAr;
  };

  const handlePlaySample = async (voice: VoiceCharacter, forceReplay = false) => {
    setErrorMsg(null);
    if (!forceReplay && playingId === voice.id) {
      stopCurrentAudio();
      return;
    }

    stopCurrentAudio();
    const cacheKey = `${voice.id}_${sampleLang}`;
    let objectUrl = sampleCacheRef.current.get(cacheKey);

    if (!objectUrl) {
      setLoadingId(voice.id);
      try {
        const res = await api.getVoiceSample(voice.id, sampleLang);
        const blob = base64ToBlob(res.audioBase64, res.mimeType || 'audio/wav');
        objectUrl = URL.createObjectURL(blob);
        sampleCacheRef.current.set(cacheKey, objectUrl);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to load voice sample.');
        setLoadingId(null);
        return;
      } finally {
        setLoadingId(null);
      }
    }

    try {
      const audio = new Audio(objectUrl);
      audioRef.current = audio;
      audio.onended = () => {
        if (audioRef.current === audio) {
          audioRef.current = null;
          setPlayingId(null);
        }
      };
      audio.onerror = () => {
        if (audioRef.current === audio) {
          audioRef.current = null;
          setPlayingId(null);
        }
        setErrorMsg(
          lang === 'ar'
            ? 'تعذر تشغيل العينة الصوتية.'
            : 'Unable to play the generated audio sample.'
        );
      };
      await audio.play();
      setPlayingId(voice.id);
    } catch (err) {
      setPlayingId(null);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : lang === 'ar'
          ? 'تعذر تشغيل العينة الصوتية.'
          : 'Unable to play the generated audio sample.'
      );
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

        {/* Preview Language Switcher (Arabic MSA, Egyptian Arabic, English) */}
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-[#0F101A] p-1 shrink-0">
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
              setSampleLang('ar-EG');
            }}
            className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              sampleLang === 'ar-EG' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.voicesPage.sampleLangEg}
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
        <div className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Voice Characters Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((voice) => {
          const isLoading = loadingId === voice.id;
          const isPlaying = playingId === voice.id;
          const genderLabel = t.options.genders[voice.gender];
          const sampleText = getSampleText(voice);

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
                  «{sampleText}»
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
                {isPlaying ? (
                  <>
                    <button
                      type="button"
                      onClick={stopCurrentAudio}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/15 px-3 py-2 text-xs font-medium text-red-200 transition-colors hover:bg-red-500/25 whitespace-nowrap shrink-0"
                    >
                      <Square className="h-3.5 w-3.5" />
                      <span>{t.voicesPage.stopSample}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePlaySample(voice, true)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-500/15 px-3 py-2 text-xs font-medium text-blue-200 transition-colors hover:bg-blue-500/25 whitespace-nowrap shrink-0"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>{t.voicesPage.replaySample}</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => handlePlaySample(voice)}
                    disabled={isLoading}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#151726] px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-violet-500/40 hover:text-white disabled:opacity-60 whitespace-nowrap shrink-0"
                  >
                    {isLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {isLoading ? t.voicesPage.loadingSample : t.voicesPage.listenSample}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    stopCurrentAudio();
                    onSelectVoiceForStudio(voice);
                  }}
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
