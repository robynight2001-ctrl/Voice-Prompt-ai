import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { AdminPage } from './components/AdminPage';
import { HomePage, type AppPage } from './components/HomePage';
import { ProjectsPage } from './components/ProjectsPage';
import { StudioPage, type StudioDraft } from './components/StudioPage';
import { SubscriptionsAuthPage } from './components/SubscriptionsAuthPage';
import { VoicesPage } from './components/VoicesPage';
import { TEXT, type Lang } from './i18n/translations';
import { api, getUserToken, setUserToken } from './lib/api';
import type { LocalVoiceProject } from './lib/localProjectsDb';
import {
  DEFAULT_VOICE_SETTINGS,
  type SiteSettings,
  type SubscriptionPlan,
  type UserProfile,
  type VoiceCharacter,
} from './shared/voices';

const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteName: 'VoicePrompt AI',
  taglineAr: 'اكتب الوصف... واسمع الصوت.',
  taglineEn: 'Your Prompt, Your Voice.',
  registrationEnabled: true,
  maxCharsPerGeneration: 1500,
  dailyGenerationLimit: 0,
  currency: 'EGP',
};

export default function App() {
  const [lang, setLang] = useState<Lang>('ar');
  const [page, setPage] = useState<AppPage>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [siteSettings, setSiteSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [preselectedPlanId, setPreselectedPlanId] = useState<string | undefined>(undefined);

  const [studioDraft, setStudioDraft] = useState<StudioDraft>({
    mode: 'smart',
    title: '',
    prompt: '',
    spokenText: '',
    characterId: 'little_girl',
    settings: { ...DEFAULT_VOICE_SETTINGS },
    audioBlob: null,
    durationSeconds: 0,
  });

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  const loadPublicConfig = async () => {
    try {
      const res = await api.getPublicConfig();
      setSiteSettings(res.settings);
      setPlans(res.plans);
    } catch {
      // keep defaults if transient error
    }
  };

  const refreshCurrentUser = async () => {
    const token = getUserToken();
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const res = await api.getMe(token);
      setUser(res.user);
    } catch {
      setUserToken(null);
      setUser(null);
    }
  };

  useEffect(() => {
    void loadPublicConfig();
    void refreshCurrentUser();
  }, []);

  const t = TEXT[lang];

  const navigate = (nextPage: AppPage, planId?: string) => {
    if (planId) setPreselectedPlanId(planId);
    setPage(nextPage);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectVoiceForStudio = (voice: VoiceCharacter) => {
    setStudioDraft((prev) => ({
      ...prev,
      mode: 'manual',
      characterId: voice.id,
      spokenText: prev.spokenText || (lang === 'ar' ? voice.sampleTextAr : voice.sampleTextEn),
      settings: {
        ...prev.settings,
        voiceGender: voice.gender,
        pitch: voice.defaultPitch,
        deliveryMode: voice.defaultDelivery,
      },
    }));
    navigate('studio');
  };

  const handleOpenProjectInStudio = (project: LocalVoiceProject) => {
    setStudioDraft({
      mode: project.prompt ? 'smart' : 'manual',
      title: project.title,
      prompt: project.prompt,
      spokenText: project.spokenText,
      characterId: project.characterId,
      settings: project.settings,
      audioBlob: project.audioBlob,
      durationSeconds: project.durationSeconds,
    });
    navigate('studio');
  };

  const handleLogout = () => {
    setUserToken(null);
    setUser(null);
    navigate('home');
  };

  const navItems: Array<{ id: AppPage; label: string }> = [
    { id: 'home', label: t.nav.home },
    { id: 'voices', label: t.nav.voices },
    { id: 'studio', label: t.nav.studio },
    { id: 'projects', label: t.nav.projects },
    { id: 'subscriptions', label: t.nav.subscriptions },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#07070D] text-slate-100">
      {/* Top Navigation Bar (Strict 3-Zone Contract) */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#07070D]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6 lg:px-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => navigate('home')}
            className="text-lg font-extrabold tracking-tight text-white transition-opacity hover:opacity-90 whitespace-nowrap shrink-0"
          >
            {siteSettings.siteName}
          </button>

          {/* Zone 2: 5 Concise Single-Line Nav Links */}
          <nav className="hidden items-center gap-6 md:flex">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                className={`text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  page === item.id
                    ? 'text-white underline decoration-violet-500 decoration-2 underline-offset-8'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Language Switch & Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setLang((prev) => (prev === 'ar' ? 'en' : 'ar'))}
              className="text-xs font-medium text-slate-300 transition-colors hover:text-white whitespace-nowrap shrink-0"
            >
              {t.actions.langSwitch}
            </button>

            <button
              type="button"
              onClick={() => navigate(user ? 'subscriptions' : 'subscriptions')}
              className="rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:from-violet-500 hover:to-blue-500 whitespace-nowrap shrink-0 max-w-[140px] truncate"
            >
              {user ? user.name : t.actions.login}
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Menu"
              className="rounded-lg border border-white/10 p-2 text-slate-300 md:hidden"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="border-t border-white/10 bg-[#0B0C14] px-4 py-3 md:hidden">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.id)}
                  className={`rounded-lg px-3 py-2.5 text-start text-sm font-medium ${
                    page === item.id ? 'bg-violet-600/20 text-white' : 'text-slate-300'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {page === 'home' && (
          <HomePage
            lang={lang}
            settings={siteSettings}
            plans={plans}
            onNavigate={navigate}
          />
        )}

        {page === 'voices' && (
          <VoicesPage lang={lang} onSelectVoiceForStudio={handleSelectVoiceForStudio} />
        )}

        {page === 'studio' && (
          <StudioPage
            lang={lang}
            user={user}
            siteSettings={siteSettings}
            draft={studioDraft}
            onChangeDraft={setStudioDraft}
            onGoToAuth={() => navigate('subscriptions')}
            onRefreshUser={refreshCurrentUser}
          />
        )}

        {page === 'projects' && (
          <ProjectsPage
            lang={lang}
            user={user}
            onOpenProjectInStudio={handleOpenProjectInStudio}
            onGoToStudio={() => navigate('studio')}
            onGoToAuth={() => navigate('subscriptions')}
          />
        )}

        {page === 'subscriptions' && (
          <SubscriptionsAuthPage
            lang={lang}
            user={user}
            plans={plans}
            siteSettings={siteSettings}
            preselectedPlanId={preselectedPlanId}
            onAuthSuccess={(u) => setUser(u)}
            onLogout={handleLogout}
            onOpenStudio={() => navigate('studio')}
          />
        )}

        {page === 'admin' && (
          <AdminPage lang={lang} onPublicDataChanged={loadPublicConfig} />
        )}
      </main>

      {/* Quiet Footer with Small "الإدارة" / "Admin" Button */}
      <footer className="border-t border-white/10 bg-[#07070D]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="space-y-1">
            <div className="text-sm font-bold text-white">{siteSettings.siteName}</div>
            <div className="text-xs text-slate-400">
              {lang === 'ar' ? siteSettings.taglineAr : siteSettings.taglineEn} ·{' '}
              {t.slogan}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-xs text-slate-400">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                className="transition-colors hover:text-white whitespace-nowrap"
              >
                {item.label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => navigate('admin')}
              className="rounded-md border border-white/10 bg-[#0F101A] px-2.5 py-1 text-[11px] font-medium text-slate-400 transition-colors hover:border-violet-500/40 hover:text-white whitespace-nowrap"
            >
              {t.actions.admin}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
