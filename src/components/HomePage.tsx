import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Headphones, Lock, Mic2, Sliders, Volume2 } from 'lucide-react';
import type { Lang } from '../i18n/translations';
import { TEXT } from '../i18n/translations';
import type { SiteSettings, SubscriptionPlan } from '../shared/voices';

export type AppPage = 'home' | 'voices' | 'studio' | 'projects' | 'subscriptions' | 'admin';

interface HomePageProps {
  lang: Lang;
  settings: SiteSettings;
  plans: SubscriptionPlan[];
  onNavigate: (page: AppPage, planId?: string) => void;
}

const HERO_IMAGE = '/src/assets/images/hero_voice_studio_1794612423612.jpg';
const PANEL_IMAGE = '/src/assets/images/studio_acoustic_surface_1794612425483.jpg';

export function HomePage({ lang, settings, plans, onNavigate }: HomePageProps) {
  const t = TEXT[lang];
  const isRtl = lang === 'ar';
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [panelImgFailed, setPanelImgFailed] = useState(false);

  return (
    <div className="space-y-20 pb-20">
      {/* Hero Split */}
      <section className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(ellipse_at_top,_rgba(124,58,237,0.16),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(37,99,235,0.12),_transparent_55%)]">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid grid-cols-1 items-stretch gap-10 lg:grid-cols-12">
            <div className="flex flex-col justify-between space-y-8 lg:col-span-7">
              <div className="space-y-5">
                <p className="text-xs font-medium text-blue-400">
                  {settings.siteName} · {lang === 'ar' ? settings.taglineEn : settings.taglineAr}
                </p>
                <h1
                  className="max-w-2xl text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl"
                  style={{ textWrap: 'balance' }}
                >
                  {t.hero.title}
                </h1>
                <p className="max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
                  {t.hero.subtitle}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => onNavigate('studio')}
                  className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-950/50 transition-all duration-150 hover:from-violet-500 hover:to-blue-500 whitespace-nowrap shrink-0"
                >
                  <span>{t.hero.ctaPrimary}</span>
                  <ArrowIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('voices')}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#0F101A] px-5 py-3.5 text-sm font-medium text-slate-200 transition-colors hover:border-blue-500/40 hover:text-white whitespace-nowrap shrink-0"
                >
                  <Headphones className="h-4 w-4 text-blue-400" />
                  <span>{t.hero.ctaSecondary}</span>
                </button>
              </div>

              {/* Prompt Intelligence Preview */}
              <div className="rounded-xl border border-white/10 bg-[#0F101A]/90 p-5">
                <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
                  <span>{t.hero.exampleLabel}</span>
                  <span>Arabic · English</span>
                </div>
                <p className="mb-4 text-sm font-semibold text-white">{t.hero.examplePrompt}</p>
                <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-3 sm:grid-cols-4">
                  {t.hero.exampleParsed.map((item) => (
                    <div key={item.k} className="space-y-1">
                      <div className="text-[11px] text-slate-400">{item.k}</div>
                      <div className="text-xs font-medium text-blue-300">{item.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="relative h-72 overflow-hidden rounded-2xl border border-white/10 bg-[#0F101A] lg:h-full lg:min-h-[460px]">
                {!heroImgFailed ? (
                  <img
                    src={HERO_IMAGE}
                    alt="VoicePrompt AI Studio Recording Booth"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgFailed(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#121024] via-[#0B0C16] to-[#0A1428] p-8 text-center">
                    <Mic2 className="mb-4 h-14 w-14 text-violet-400" />
                    <span className="text-lg font-bold text-white">{settings.siteName}</span>
                    <span className="mt-1 text-sm text-slate-400">{t.slogan}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#07070D] via-[#07070D]/30 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6">
                  <div className="text-xs text-slate-300">
                    {lang === 'ar' ? '15 شخصية صوتية · توليد فوري · تخزين محلي' : '15 Voice Personas · Real-Time TTS · Local Privacy'}
                  </div>
                  <div className="mt-1 text-lg font-bold text-white">{t.slogan}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities Asymmetric Bento Grid */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 max-w-2xl space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl" style={{ textWrap: 'balance' }}>
            {t.sections.capabilitiesTitle}
          </h2>
          <p className="text-sm leading-relaxed text-slate-400 sm:text-base">{t.sections.capabilitiesSub}</p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Marquee Card */}
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0F101A] p-7 lg:col-span-2">
            {!panelImgFailed && (
              <img
                src={PANEL_IMAGE}
                alt="Acoustic Engineering Panels"
                referrerPolicy="no-referrer"
                onError={() => setPanelImgFailed(true)}
                className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20"
              />
            )}
            <div className="relative z-10 flex h-full flex-col justify-between gap-6">
              <div className="flex items-center justify-between text-xs text-violet-300">
                <span>{t.capabilities[0].num}</span>
                <Volume2 className="h-5 w-5 text-blue-400" />
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-white">{t.capabilities[0].title}</h3>
                <p className="max-w-2xl text-sm leading-relaxed text-slate-300">{t.capabilities[0].desc}</p>
              </div>
              <div className="flex flex-wrap gap-6 border-t border-white/10 pt-4 text-xs text-slate-300">
                <span>{lang === 'ar' ? 'العربية الفصحى والمصرية' : 'MSA & Egyptian Arabic'}</span>
                <span>·</span>
                <span>{lang === 'ar' ? 'الخوف، الفرح، الغضب، البكاء' : 'Fear, Joy, Anger, Crying'}</span>
                <span>·</span>
                <span>{lang === 'ar' ? 'الهمس والصراخ والوقفات' : 'Whisper, Shout & Pauses'}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0F101A] p-7">
            <div className="flex items-center justify-between text-xs text-blue-400">
              <span>{t.capabilities[1].num}</span>
              <Headphones className="h-5 w-5 text-violet-400" />
            </div>
            <div className="mt-6 space-y-2.5">
              <h3 className="text-lg font-bold text-white">{t.capabilities[1].title}</h3>
              <p className="text-sm leading-relaxed text-slate-400">{t.capabilities[1].desc}</p>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0F101A] p-7">
            <div className="flex items-center justify-between text-xs text-blue-400">
              <span>{t.capabilities[2].num}</span>
              <Lock className="h-5 w-5 text-blue-400" />
            </div>
            <div className="mt-6 space-y-2.5">
              <h3 className="text-lg font-bold text-white">{t.capabilities[2].title}</h3>
              <p className="text-sm leading-relaxed text-slate-400">{t.capabilities[2].desc}</p>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0F101A] p-7 lg:col-span-2">
            <div className="flex items-center justify-between text-xs text-violet-300">
              <span>{t.capabilities[3].num}</span>
              <Sliders className="h-5 w-5 text-violet-400" />
            </div>
            <div className="mt-6 space-y-2.5">
              <h3 className="text-lg font-bold text-white">{t.capabilities[3].title}</h3>
              <p className="max-w-2xl text-sm leading-relaxed text-slate-400">{t.capabilities[3].desc}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Subscription Plans (Live Prices from Server DB) */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 max-w-2xl space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl" style={{ textWrap: 'balance' }}>
            {t.sections.plansTitle}
          </h2>
          <p className="text-sm leading-relaxed text-slate-400 sm:text-base">{t.sections.plansSub}</p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {plans
            .filter((p) => p.isActive)
            .map((plan) => {
              const features = lang === 'ar' ? plan.featuresAr : plan.featuresEn;
              return (
                <div
                  key={plan.id}
                  className={`flex flex-col justify-between rounded-2xl border p-6 transition-colors ${
                    plan.isPopular
                      ? 'border-violet-500/60 bg-gradient-to-b from-[#17132D] to-[#0F101A]'
                      : 'border-white/10 bg-[#0F101A]'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-400 tabular-nums">
                        {plan.durationDays} {lang === 'ar' ? 'يومًا' : 'days'}
                      </span>
                      {plan.isPopular && (
                        <span className="font-semibold text-violet-300">
                          {lang === 'ar' ? 'الأكثر طلبًا' : 'Most Popular'}
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-white">
                        {lang === 'ar' ? plan.nameAr : plan.nameEn}
                      </h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                        {lang === 'ar' ? plan.descriptionAr : plan.descriptionEn}
                      </p>
                    </div>

                    <div className="border-y border-white/10 py-4">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-mono-num text-3xl font-extrabold text-white">
                          {plan.price}
                        </span>
                        <span className="text-xs font-medium text-slate-400">{plan.currency}</span>
                      </div>
                    </div>

                    <ul className="space-y-2.5 text-xs text-slate-300">
                      {features.map((feat, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => onNavigate('subscriptions', plan.id)}
                    className={`mt-6 w-full rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                      plan.isPopular
                        ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white hover:from-violet-500 hover:to-blue-500'
                        : 'border border-white/15 bg-[#151726] text-white hover:border-blue-500/50'
                    }`}
                  >
                    {lang === 'ar' ? 'اشترك الآن' : 'Choose Plan'}
                  </button>
                </div>
              );
            })}
        </div>
      </section>
    </div>
  );
}
