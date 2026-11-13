import { useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  LogOut,
  Phone,
  RefreshCw,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import type { Lang } from '../i18n/translations';
import { TEXT } from '../i18n/translations';
import { api, getUserToken, setUserToken } from '../lib/api';
import type { SiteSettings, SubscriptionPlan, UserProfile } from '../shared/voices';

interface SubscriptionsAuthPageProps {
  lang: Lang;
  user: UserProfile | null;
  plans: SubscriptionPlan[];
  siteSettings: SiteSettings;
  preselectedPlanId?: string;
  onAuthSuccess: (user: UserProfile) => void;
  onLogout: () => void;
  onOpenStudio: () => void;
}

export function SubscriptionsAuthPage({
  lang,
  user,
  plans,
  siteSettings,
  preselectedPlanId,
  onAuthSuccess,
  onLogout,
  onOpenStudio,
}: SubscriptionsAuthPageProps) {
  const t = TEXT[lang];
  const [authMode, setAuthMode] = useState<'login' | 'register'>(
    preselectedPlanId ? 'register' : 'login'
  );
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState(
    preselectedPlanId || plans[0]?.id || '1_month'
  );
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [renewalPlanId, setRenewalPlanId] = useState(user?.selectedPlanId || '1_month');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      const res = await api.login({ phone, password });
      setUserToken(res.token);
      onAuthSuccess(res.user);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (password !== confirmPassword) {
      setErrorMsg(
        lang === 'ar' ? 'كلمة المرور وتأكيدها غير متطابقتين.' : 'Passwords do not match.'
      );
      return;
    }
    setLoading(true);
    try {
      const res = await api.register({
        name,
        phone,
        password,
        confirmPassword,
        planId: selectedPlanId,
      });
      setUserToken(res.token);
      onAuthSuccess(res.user);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestRenewal = async () => {
    const token = getUserToken();
    if (!token) return;
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await api.requestRenewal(token, renewalPlanId);
      onAuthSuccess(res.user);
      setSuccessMsg(
        lang === 'ar'
          ? 'تم إرسال طلب التجديد إلى الإدارة بنجاح.'
          : 'Renewal request sent to administration.'
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to request renewal.');
    } finally {
      setLoading(false);
    }
  };

  const getDaysRemaining = (endIso: string | null): number | null => {
    if (!endIso) return null;
    const diff = new Date(endIso).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const currentPlan = plans.find((p) => p.id === user?.selectedPlanId);

  return (
    <div className="mx-auto max-w-7xl space-y-12 px-4 py-10 sm:px-6 lg:px-8">
      {/* User Account Status OR Login/Register */}
      {user ? (
        <section className="rounded-2xl border border-white/10 bg-[#0F101A] p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-white">{user.name}</h1>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                    user.status === 'active'
                      ? 'text-emerald-400'
                      : user.status === 'pending'
                      ? 'text-amber-300'
                      : 'text-red-400'
                  }`}
                >
                  {user.status === 'active' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : user.status === 'pending' ? (
                    <Clock className="h-4 w-4" />
                  ) : (
                    <ShieldAlert className="h-4 w-4" />
                  )}
                  <span>{t.auth.statusLabels[user.status]}</span>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span className="font-mono-num">{user.phone}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {lang === 'ar' ? currentPlan?.nameAr : currentPlan?.nameEn}
                </span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  {lang === 'ar' ? 'عمليات التوليد:' : 'Generations:'} {user.generationCount}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {user.status === 'active' && (
                <button
                  type="button"
                  onClick={onOpenStudio}
                  className="rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-2.5 text-xs font-semibold text-white whitespace-nowrap"
                >
                  {t.actions.openStudio}
                </button>
              )}
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#151726] px-4 py-2.5 text-xs font-medium text-slate-200 hover:border-red-500/40 hover:text-white whitespace-nowrap"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>{t.actions.logout}</span>
              </button>
            </div>
          </div>

          <div className="mt-6 border-t border-white/10 pt-5">
            {user.status === 'active' ? (
              <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-[#090A12] p-4">
                  <div className="text-xs text-slate-400">
                    {lang === 'ar' ? 'تاريخ بدء الاشتراك' : 'Subscription Start'}
                  </div>
                  <div className="mt-1 font-mono-num text-sm font-semibold text-white">
                    {user.subscriptionStart
                      ? new Date(user.subscriptionStart).toLocaleDateString(
                          lang === 'ar' ? 'ar-EG' : 'en-US'
                        )
                      : '—'}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#090A12] p-4">
                  <div className="text-xs text-slate-400">
                    {lang === 'ar' ? 'تاريخ الانتهاء' : 'Subscription End'}
                  </div>
                  <div className="mt-1 font-mono-num text-sm font-semibold text-white">
                    {user.subscriptionEnd
                      ? new Date(user.subscriptionEnd).toLocaleDateString(
                          lang === 'ar' ? 'ar-EG' : 'en-US'
                        )
                      : '—'}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#090A12] p-4">
                  <div className="text-xs text-slate-400">{t.auth.daysRemaining}</div>
                  <div className="mt-1 font-mono-num text-sm font-semibold text-blue-300">
                    {getDaysRemaining(user.subscriptionEnd) ?? '—'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-300">
                  {user.status === 'pending'
                    ? t.auth.pendingNotice
                    : user.status === 'expired'
                    ? t.auth.expiredNotice
                    : user.status === 'rejected'
                    ? t.auth.rejectedNotice
                    : t.auth.suspendedNotice}
                </p>

                {(user.status === 'expired' || user.status === 'rejected') && (
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      value={renewalPlanId}
                      onChange={(e) => setRenewalPlanId(e.target.value)}
                      className="rounded-xl border border-white/10 bg-[#090A12] px-3.5 py-2 text-xs text-white"
                    >
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {lang === 'ar' ? p.nameAr : p.nameEn} — {p.price} {p.currency}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleRequestRenewal}
                      disabled={loading}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>{t.auth.requestRenewal}</span>
                    </button>
                  </div>
                )}

                {successMsg && <p className="text-xs text-emerald-300">{successMsg}</p>}
                {errorMsg && <p className="text-xs text-red-300">{errorMsg}</p>}
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-[#0F101A] p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-1 rounded-xl border border-white/10 bg-[#090A12] p-1">
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setAuthMode('login');
              }}
              className={`flex-1 rounded-lg py-2.5 text-xs font-semibold transition-colors ${
                authMode === 'login'
                  ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.auth.loginTab}
            </button>
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setAuthMode('register');
              }}
              className={`flex-1 rounded-lg py-2.5 text-xs font-semibold transition-colors ${
                authMode === 'register'
                  ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.auth.registerTab}
            </button>
          </div>

          <div className="mb-5 space-y-1">
            <h1 className="text-xl font-bold text-white">
              {authMode === 'login' ? t.auth.loginTitle : t.auth.registerTitle}
            </h1>
            <p className="text-xs text-slate-400">{t.auth.noEmailNote}</p>
          </div>

          {errorMsg && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {authMode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  {t.auth.phoneLabel}
                </label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 ltr:left-3.5 rtl:right-3.5" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t.auth.phonePlaceholder}
                    className="w-full rounded-xl border border-white/10 bg-[#090A12] py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none ltr:pl-10 ltr:pr-4 rtl:pr-10 rtl:pl-4"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  {t.auth.passwordLabel}
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#090A12] px-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 py-3 text-sm font-bold text-white transition-colors hover:from-violet-500 hover:to-blue-500 disabled:opacity-60"
              >
                {loading ? '...' : t.auth.submitLogin}
              </button>
            </form>
          ) : !siteSettings.registrationEnabled ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
              {lang === 'ar'
                ? 'تم إيقاف التسجيل الجديد مؤقتًا من قبل الإدارة.'
                : 'New registrations are currently disabled by the administrator.'}
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  {t.auth.nameLabel}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.auth.namePlaceholder}
                  className="w-full rounded-xl border border-white/10 bg-[#090A12] px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  {t.auth.phoneLabel}
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t.auth.phonePlaceholder}
                  className="w-full rounded-xl border border-white/10 bg-[#090A12] px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  {t.auth.planLabel}
                </label>
                <select
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#090A12] px-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  {plans
                    .filter((p) => p.isActive)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {lang === 'ar' ? p.nameAr : p.nameEn} — {p.price} {p.currency}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">
                    {t.auth.passwordLabel}
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#090A12] px-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">
                    {t.auth.confirmPasswordLabel}
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#090A12] px-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 py-3 text-sm font-bold text-white transition-colors hover:from-violet-500 hover:to-blue-500 disabled:opacity-60"
              >
                <UserCheck className="h-4 w-4" />
                <span>{loading ? '...' : t.auth.submitRegister}</span>
              </button>
            </form>
          )}
        </section>
      )}

      {/* All 4 Subscription Plans */}
      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-white">{t.sections.plansTitle}</h2>
          <p className="text-sm text-slate-400">{t.sections.plansSub}</p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {plans
            .filter((p) => p.isActive)
            .map((plan) => {
              const features = lang === 'ar' ? plan.featuresAr : plan.featuresEn;
              return (
                <div
                  key={plan.id}
                  className={`flex flex-col justify-between rounded-2xl border p-6 ${
                    plan.isPopular
                      ? 'border-violet-500/60 bg-gradient-to-b from-[#17132D] to-[#0F101A]'
                      : 'border-white/10 bg-[#0F101A]'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 tabular-nums">
                        {plan.durationDays} {lang === 'ar' ? 'يومًا' : 'days'}
                      </span>
                      {plan.isPopular && (
                        <span className="font-semibold text-violet-300">
                          {lang === 'ar' ? 'الأكثر طلبًا' : 'Popular'}
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
                      <span className="font-mono-num text-3xl font-extrabold text-white">
                        {plan.price}
                      </span>{' '}
                      <span className="text-xs text-slate-400">{plan.currency}</span>
                    </div>

                    <ul className="space-y-2 text-xs text-slate-300">
                      {features.map((f, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {!user && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPlanId(plan.id);
                        setAuthMode('register');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="mt-6 w-full rounded-xl border border-white/15 bg-[#151726] py-2.5 text-xs font-semibold text-white transition-colors hover:border-violet-500/50"
                    >
                      {lang === 'ar' ? 'اختيار الباقة والتسجيل' : 'Select & Register'}
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      </section>
    </div>
  );
}
