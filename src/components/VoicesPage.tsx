import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Play, RotateCcw, Search, Square, Volume2 } from 'lucide-react';
import type { Lang } from '../i18n/translations';
import { TEXT } from '../i18n/translations';
import { VOICE_CHARACTERS, type VoiceCharacter, type VoiceGender } from '../shared/voices';

interface VoicesPageProps {
  lang: Lang;
  onSelectVoiceForStudio: (voice: VoiceCharacter) => void;
}

type PreviewLang = 'ar' | 'ar-EG' | 'en';
type DeviceGenderFilter = 'all' | 'female' | 'male';

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

const FEMALE_KEYWORDS = [
  'female',
  'woman',
  'girl',
  'zira',
  'samantha',
  'victoria',
  'karen',
  'moira',
  'tessa',
  'fiona',
  'veena',
  'susan',
  'hazel',
  'libby',
  'sonia',
  'aria',
  'jenny',
  'sara',
  'salma',
  'laila',
  'layla',
  'mariam',
  'hoda',
  'fatima',
  'nour',
  'zeina',
  'rana',
  'amina',
  'salwa',
  'heba',
  'yasmin',
  'ليلى',
  'سلمى',
  'مريم',
  'هدى',
  'نور',
  'فاطمة',
  'زينة',
  'أمل',
  'هبة',
];

const MALE_KEYWORDS = [
  'male',
  'man',
  'boy',
  'david',
  'mark',
  'alex',
  'daniel',
  'george',
  'ryan',
  'guy',
  'christopher',
  'eric',
  'richard',
  'james',
  'oliver',
  'thomas',
  'liam',
  'tarik',
  'tariq',
  'maged',
  'naayf',
  'shakir',
  'hamed',
  'omar',
  'ahmed',
  'rami',
  'karim',
  'bassel',
  'طارق',
  'ماجد',
  'نايف',
  'شاكر',
  'عمر',
  'أحمد',
  'رامي',
  'كريم',
];

function detectVoiceGender(voice: SpeechSynthesisVoice): 'female' | 'male' | 'unknown' {
  const name = voice.name.toLowerCase();
  if (FEMALE_KEYWORDS.some((kw) => name.includes(kw))) return 'female';
  if (MALE_KEYWORDS.some((kw) => name.includes(kw))) return 'male';
  return 'unknown';
}

function getCharacterSpeechParams(character: VoiceCharacter): { pitch: number; rate: number } {
  switch (character.id) {
    case 'little_girl':
    case 'little_boy':
      return { pitch: 1.35, rate: 1.0 };
    case 'young_girl':
    case 'young_boy':
      return { pitch: 1.18, rate: 1.03 };
    case 'cartoon':
      return { pitch: 1.32, rate: 1.1 };
    case 'elderly_man':
      return { pitch: 0.78, rate: 0.88 };
    case 'elderly_woman':
      return { pitch: 0.92, rate: 0.88 };
    case 'horror':
      return { pitch: 0.72, rate: 0.84 };
    case 'calm_soft':
      return { pitch: 1.04, rate: 0.88 };
    case 'energetic':
      return { pitch: 1.08, rate: 1.14 };
    case 'news_anchor':
      return { pitch: 0.95, rate: 1.02 };
    case 'storyteller':
      return { pitch: 0.9, rate: 0.92 };
    default:
      return { pitch: 1.0, rate: 1.0 };
  }
}

export function VoicesPage({ lang, onSelectVoiceForStudio }: VoicesPageProps) {
  const t = TEXT[lang];
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | VoiceGender>('all');
  const [sampleLang, setSampleLang] = useState<PreviewLang>(lang === 'en' ? 'en' : 'ar');
  const [deviceGender, setDeviceGender] = useState<DeviceGenderFilter>('all');
  const [deviceVoices, setDeviceVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedDeviceVoiceURI, setSelectedDeviceVoiceURI] = useState<string>('auto');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const isSpeechSupported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined';

  useEffect(() => {
    if (!isSpeechSupported) return;

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        setDeviceVoices([...voices]);
      }
    };

    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    const retryTimer = window.setTimeout(loadVoices, 350);

    return () => {
      window.clearTimeout(retryTimer);
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      window.speechSynthesis.cancel();
    };
  }, [isSpeechSupported]);

  // Filter real device voices matching the selected preview language & optional gender filter
  const matchingLanguageVoices = useMemo(() => {
    const langPrefix = sampleLang === 'en' ? 'en' : 'ar';
    const byLang = deviceVoices.filter((v) => v.lang.toLowerCase().startsWith(langPrefix));

    // Prioritize ar-EG first when Egyptian is selected
    const sorted = [...byLang].sort((a, b) => {
      if (sampleLang === 'ar-EG') {
        const aEg = a.lang.toLowerCase() === 'ar-eg' ? 0 : 1;
        const bEg = b.lang.toLowerCase() === 'ar-eg' ? 0 : 1;
        if (aEg !== bEg) return aEg - bEg;
      }
      return a.name.localeCompare(b.name);
    });

    if (deviceGender === 'all') return sorted;

    const gendered = sorted.filter((v) => detectVoiceGender(v) === deviceGender);
    return gendered;
  }, [deviceVoices, sampleLang, deviceGender]);

  // Reset selected device voice URI if it's no longer in the matching list
  useEffect(() => {
    if (
      selectedDeviceVoiceURI !== 'auto' &&
      !matchingLanguageVoices.some((v) => v.voiceURI === selectedDeviceVoiceURI)
    ) {
      setSelectedDeviceVoiceURI('auto');
    }
  }, [matchingLanguageVoices, selectedDeviceVoiceURI]);

  const stopSpeech = () => {
    if (isSpeechSupported) {
      window.speechSynthesis.cancel();
    }
    activeUtteranceRef.current = null;
    setPlayingId(null);
  };

  const getSampleText = (voice: VoiceCharacter): string => {
    if (sampleLang === 'en') return voice.sampleTextEn;
    if (sampleLang === 'ar-EG') return EGYPTIAN_SAMPLES[voice.id] || voice.sampleTextAr;
    return voice.sampleTextAr;
  };

  const pickBestDeviceVoice = (character: VoiceCharacter): SpeechSynthesisVoice | null => {
    if (matchingLanguageVoices.length === 0) return null;

    if (selectedDeviceVoiceURI !== 'auto') {
      const explicit = matchingLanguageVoices.find(
        (v) => v.voiceURI === selectedDeviceVoiceURI
      );
      if (explicit) return explicit;
    }

    const desiredGender: 'female' | 'male' =
      deviceGender !== 'all'
        ? deviceGender
        : character.gender === 'female' || character.id === 'little_girl'
        ? 'female'
        : 'male';

    const genderMatch = matchingLanguageVoices.find(
      (v) => detectVoiceGender(v) === desiredGender
    );
    if (genderMatch) return genderMatch;

    return matchingLanguageVoices[0];
  };

  const speakCharacterSample = (voice: VoiceCharacter) => {
    setErrorMsg(null);

    if (!isSpeechSupported) {
      setErrorMsg(t.voicesPage.unsupportedSpeech);
      return;
    }

    if (matchingLanguageVoices.length === 0) {
      setErrorMsg(`${t.voicesPage.noVoicesTitle} — ${t.voicesPage.noVoicesDesc}`);
      return;
    }

    const chosenDeviceVoice = pickBestDeviceVoice(voice);
    if (!chosenDeviceVoice) {
      setErrorMsg(`${t.voicesPage.noVoicesTitle} — ${t.voicesPage.noVoicesDesc}`);
      return;
    }

    const wasBusy = window.speechSynthesis.speaking || window.speechSynthesis.pending;
    window.speechSynthesis.cancel();

    const text = getSampleText(voice);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = chosenDeviceVoice;
    utterance.lang =
      chosenDeviceVoice.lang ||
      (sampleLang === 'ar-EG' ? 'ar-EG' : sampleLang === 'en' ? 'en-US' : 'ar-SA');

    const params = getCharacterSpeechParams(voice);
    utterance.pitch = params.pitch;
    utterance.rate = params.rate;

    utterance.onstart = () => {
      setPlayingId(voice.id);
    };
    utterance.onend = () => {
      if (activeUtteranceRef.current === utterance) {
        activeUtteranceRef.current = null;
        setPlayingId(null);
      }
    };
    utterance.onerror = (ev) => {
      if (ev.error === 'interrupted' || ev.error === 'canceled') return;
      if (activeUtteranceRef.current === utterance) {
        activeUtteranceRef.current = null;
        setPlayingId(null);
      }
      setErrorMsg(
        lang === 'ar'
          ? `تعذر تشغيل الصوت من المتصفح (${ev.error}). تأكد من أن صوت الجهاز غير مكتوم ومن توفر الصوت المختار.`
          : `Browser speech playback failed (${ev.error}). Please check system audio and voice availability.`
      );
    };

    activeUtteranceRef.current = utterance;
    setPlayingId(voice.id);
    if (wasBusy) {
      window.setTimeout(() => {
        if (activeUtteranceRef.current === utterance) {
          window.speechSynthesis.speak(utterance);
        }
      }, 30);
    } else {
      window.speechSynthesis.speak(utterance);
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

  const activeVoiceObj = playingId
    ? VOICE_CHARACTERS.find((v) => v.id === playingId) || null
    : null;

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
              stopSpeech();
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
              stopSpeech();
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
              stopSpeech();
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

      {/* Real Device Voices Bar (Web Speech API) */}
      <div className="rounded-2xl border border-white/10 bg-[#0F101A] p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-4">
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              {t.voicesPage.deviceGenderLabel}
            </label>
            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-[#090A12] p-1">
              {(['all', 'female', 'male'] as const).map((dg) => (
                <button
                  key={dg}
                  type="button"
                  onClick={() => {
                    stopSpeech();
                    setDeviceGender(dg);
                  }}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    deviceGender === dg
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {dg === 'all'
                    ? t.voicesPage.deviceGenderAll
                    : dg === 'female'
                    ? t.voicesPage.deviceGenderFemale
                    : t.voicesPage.deviceGenderMale}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <label className="font-medium text-slate-300">{t.voicesPage.deviceVoiceLabel}</label>
              <span className="font-mono-num text-blue-300">
                {t.voicesPage.availableVoicesCount}: {matchingLanguageVoices.length}
              </span>
            </div>
            <select
              value={selectedDeviceVoiceURI}
              onChange={(e) => {
                stopSpeech();
                setSelectedDeviceVoiceURI(e.target.value);
              }}
              disabled={!isSpeechSupported || matchingLanguageVoices.length === 0}
              className="w-full rounded-xl border border-white/10 bg-[#090A12] px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
            >
              <option value="auto">{t.voicesPage.autoMatchVoice}</option>
              {matchingLanguageVoices.map((dv) => {
                const g = detectVoiceGender(dv);
                const gLabel =
                  g === 'female'
                    ? ` · ${t.voicesPage.deviceGenderFemale}`
                    : g === 'male'
                    ? ` · ${t.voicesPage.deviceGenderMale}`
                    : '';
                return (
                  <option key={dv.voiceURI} value={dv.voiceURI}>
                    {dv.name} ({dv.lang}){gLabel}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex items-center gap-2 lg:col-span-3 lg:justify-end">
            <button
              type="button"
              onClick={stopSpeech}
              disabled={!playingId}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#151726] px-3.5 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-red-500/40 hover:text-white disabled:opacity-40 whitespace-nowrap lg:flex-initial"
            >
              <Square className="h-3.5 w-3.5" />
              <span>{t.voicesPage.stopSample}</span>
            </button>
            <button
              type="button"
              onClick={() => activeVoiceObj && speakCharacterSample(activeVoiceObj)}
              disabled={!activeVoiceObj}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#151726] px-3.5 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-blue-500/40 hover:text-white disabled:opacity-40 whitespace-nowrap lg:flex-initial"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{t.voicesPage.replaySample}</span>
            </button>
          </div>
        </div>

        {!isSpeechSupported ? (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <span>{t.voicesPage.unsupportedSpeech}</span>
          </div>
        ) : (
          matchingLanguageVoices.length === 0 && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div>
                <div className="font-semibold">{t.voicesPage.noVoicesTitle}</div>
                <div className="mt-0.5 text-amber-200/80">{t.voicesPage.noVoicesDesc}</div>
              </div>
            </div>
          )
        )}
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
                      onClick={stopSpeech}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/15 px-3 py-2 text-xs font-medium text-red-200 transition-colors hover:bg-red-500/25 whitespace-nowrap shrink-0"
                    >
                      <Square className="h-3.5 w-3.5" />
                      <span>{t.voicesPage.stopSample}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => speakCharacterSample(voice)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-500/15 px-3 py-2 text-xs font-medium text-blue-200 transition-colors hover:bg-blue-500/25 whitespace-nowrap shrink-0"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>{t.voicesPage.replaySample}</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => speakCharacterSample(voice)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#151726] px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-violet-500/40 hover:text-white whitespace-nowrap shrink-0"
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>{t.voicesPage.listenSample}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    stopSpeech();
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
