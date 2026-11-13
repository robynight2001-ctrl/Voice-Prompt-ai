import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  LogOut,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Trash2,
  Users,
} from 'lucide-react';
import type { Lang } from '../i18n/translations';
import { TEXT } from '../i18n/translations';
import { api, getAdminToken, setAdminToken, type AdminStats } from '../lib/api';
import type {
  SiteSettings,
  SubscriptionPlan,
  SubscriptionStatus,
  UserProfile,
} from '../shared/voices';

interface AdminPageProps {
  lang: Lang;
  onPublicDataChanged: () => Promise<void>;
}

export function AdminPage({ lang, onPublicDataChanged }: AdminPageProps) {
  const t = TEXT[lang];
  const [adminToken, setTokenState] = useState<string | null>(() => getAdminToken());
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const [tab, setTab] = useState<'users' | 'plans' | 'settings'>('users');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loadingDash, setLoadingDash] = useState(false);
  const [dashMsg, setDashMsg] = useState<string | null>(null);
  const [dashErr, setDashErr] = useState<string | null>(null);

  const [userSearch, setUserSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SubscriptionStatus>('all');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editPlanId, setEditPlanId] = useState('1_month');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editStatus, setEditStatus] = useState<SubscriptionStatus>('active');

  const loadDashboard = async (token: string) => {
    setLoadingDash(true);
    setDashErr(null);
    try {
      const data = await api.adminGetDashboard(token);
      setStats(data.stats);
      setUsers(data.users);
      setPlans(data.plans);
      setSettings(data.settings);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load dashboard.';
      setDashErr(msg);
      if (msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('admin')) {
        setAdminToken(null);
        setTokenState(null);
      }
    } finally {
      setLoadingDash(false);
    }
  };

  useEffect(() => {
    if (adminToken) {
      void loadDashboard(adminToken);
    }
  }, [adminToken]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      const res = await api.adminLogin(username, password);
      setAdminToken(res.token);
      setTokenState(res.token);
      setUsername('');
      setPassword('');
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleAdminLogout = () => {
    setAdminToken(null);
    setTokenState(null);
  };

  const handleUserAction = async (userId: string, action: string, planId?: string) => {
    if (!adminToken) return;
    setDashErr(null);
    setDashMsg(null);
    try {
      await api.adminUpdateUserSubscription(adminToken, userId, { action, planId });
      await loadDashboard(adminToken);
      setDashMsg(lang === 'ar' ? 'تم تحديث حالة الاشتراك بنجاح.' : 'Subscription updated.');
    } catch (err) {
      setDashErr(err instanceof Error ? err.message : 'Action failed.');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!adminToken) return;
    setDashErr(null);
    try {
      await api.adminDeleteUser(adminToken, userId);
      await loadDashboard(adminToken);
      setDashMsg(lang === 'ar' ? 'تم حذف الحساب.' : 'Account deleted.');
    } catch (err) {
      setDashErr(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  const openEditDatesModal = (u: UserProfile) => {
    setEditingUser(u);
    setEditPlanId(u.selectedPlanId);
    setEditStatus(u.status);
    setEditStart(
      u.subscriptionStart
        ? u.subscriptionStart.slice(0, 10)
        : new Date().toISOString().slice(0, 10)
    );
    setEditEnd(
      u.subscriptionEnd
        ? u.subscriptionEnd.slice(0, 10)
        : new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
    );
  };

  const handleSaveUserDates = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken || !editingUser) return;
    setDashErr(null);
    try {
      await api.adminUpdateUserSubscription(adminToken, editingUser.id, {
        action: 'update_dates',
        planId: editPlanId,
        subscriptionStart: new Date(editStart).toISOString(),
        subscriptionEnd: new Date(`${editEnd}T23:59:59.000Z`).toISOString(),
        status: editStatus,
      });
      setEditingUser(null);
      await loadDashboard(adminToken);
      setDashMsg(lang === 'ar' ? 'تم حفظ تواريخ الاشتراك.' : 'Subscription dates saved.');
    } catch (err) {
      setDashErr(err instanceof Error ? err.message : 'Failed to update dates.');
    }
  };

  const handleSavePlan = async (plan: SubscriptionPlan) => {
    if (!adminToken) return;
    setDashErr(null);
    setDashMsg(null);
    try {
      const res = await api.adminUpdatePlan(adminToken, plan.id, plan);
      setPlans(res.plans);
      await onPublicDataChanged();
      setDashMsg(lang === 'ar' ? 'تم تحديث الباقة والسعر لجميع المستخدمين.' : 'Plan pricing updated.');
    } catch (err) {
      setDashErr(err instanceof Error ? err.message : 'Failed to update plan.');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken || !settings) return;
    setDashErr(null);
    setDashMsg(null);
    try {
      const res = await api.adminUpdateSettings(adminToken, {
        ...settings,
        syncCurrencyToPlans: true,
      });
      setSettings(res.settings);
      setPlans(res.plans);
      await onPublicDataChanged();
      setDashMsg(lang === 'ar' ? 'تم حفظ إعدادات الموقع.' : 'Site settings saved.');
    } catch (err) {
      setDashErr(err instanceof Error ? err.message : 'Failed to save settings.');
    }
  };

  if (!adminToken) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-white/10 bg-[#0F101A] p-7">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/15 text-violet-300">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">{t.admin.loginTitle}</h1>
              <p className="text-xs text-slate-400">{t.admin.loginSubtitle}</p>
            </div>
          </div>

          {loginError && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                {t.admin.usernameLabel}
              </label>
              <input
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#090A12] px-4 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                {t.admin.passwordLabel}
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#090A12] px-4 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 py-3 text-sm font-bold text-white transition-colors hover:from-violet-500 hover:to-blue-500 disabled:opacity-60"
            >
              {loginLoading ? '...' : t.admin.loginBtn}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter((u) => {
    if (statusFilter !== 'all' && u.status !== statusFilter) return false;
    if (!userSearch.trim()) return true;
    const q = userSearch.trim().toLowerCase();
    return u.name.toLowerCase().includes(q) || u.phone.toLowerCase().includes(q);
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t.admin.dashboardTitle}</h1>
          <p className="mt-1 text-xs text-slate-400">
            {lang === 'ar'
              ? 'إدارة الحسابات والموافقات والأسعار وإعدادات المنصة'
              : 'Manage user accounts, approvals, plan pricing, and site settings'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => loadDashboard(adminToken)}
            disabled={loadingDash}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#0F101A] px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-blue-500/40 whitespace-nowrap"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingDash ? 'animate-spin' : ''}`} />
            <span>{lang === 'ar' ? 'تحديث' : 'Refresh'}</span>
          </button>
          <button
            type="button"
            onClick={handleAdminLogout}
            className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-xs font-medium text-red-200 hover:bg-red-500/20 whitespace-nowrap"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>{t.actions.logout}</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {[
            { label: t.admin.stats.totalUsers, val: stats.totalUsers, color: 'text-white' },
            { label: t.admin.stats.active, val: stats.activeSubscriptions, color: 'text-emerald-400' },
            { label: t.admin.stats.pending, val: stats.pendingSubscriptions, color: 'text-amber-300' },
            { label: t.admin.stats.expired, val: stats.expiredSubscriptions, color: 'text-red-400' },
            { label: t.admin.stats.generations, val: stats.totalGenerations, color: 'text-blue-400' },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl border border-white/10 bg-[#0F101A] p-4">
              <div className="text-xs text-slate-400">{kpi.label}</div>
              <div className={`mt-2 font-mono-num text-2xl font-extrabold ${kpi.color}`}>
                {kpi.val}
              </div>
            </div>
          ))}
        </div>
      )}

      {dashMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{dashMsg}</span>
        </div>
      )}

      {dashErr && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          <span>{dashErr}</span>
        </div>
      )}

      {/* Admin Tabs */}
      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-[#0F101A] p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab('users')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold whitespace-nowrap ${
            tab === 'users' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          <span>{t.admin.tabs.users}</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('plans')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold whitespace-nowrap ${
            tab === 'plans' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Calendar className="h-3.5 w-3.5" />
          <span>{t.admin.tabs.plans}</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('settings')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold whitespace-nowrap ${
            tab === 'settings' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Settings className="h-3.5 w-3.5" />
          <span>{t.admin.tabs.settings}</span>
        </button>
      </div>

      {/* TAB 1: Users & Subscriptions */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-[#0F101A] p-1">
              {(['all', 'pending', 'active', 'expired', 'rejected', 'suspended'] as const).map(
                (st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
                      statusFilter === st
                        ? 'bg-[#1D2036] text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {st === 'all' ? (lang === 'ar' ? 'الكل' : 'All') : t.auth.statusLabels[st]}
                  </button>
                )
              )}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 ltr:left-3 rtl:right-3" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder={lang === 'ar' ? 'بحث بالاسم أو الهاتف...' : 'Search name or phone...'}
                className="w-full rounded-xl border border-white/10 bg-[#0F101A] py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none ltr:pl-9 ltr:pr-3 rtl:pr-9 rtl:pl-3"
              />
            </div>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#0F101A] p-10 text-center text-sm text-slate-400">
              {lang === 'ar' ? 'لا يوجد مستخدمون مطابقون.' : 'No matching users found.'}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0F101A]">
              <table className="w-full text-start text-xs">
                <thead className="border-b border-white/10 bg-[#0B0C14] text-slate-400">
                  <tr>
                    <th className="px-4 py-3 text-start font-medium">
                      {lang === 'ar' ? 'الاسم والهاتف' : 'User & Phone'}
                    </th>
                    <th className="px-4 py-3 text-start font-medium">
                      {lang === 'ar' ? 'الباقة' : 'Plan'}
                    </th>
                    <th className="px-4 py-3 text-start font-medium">
                      {lang === 'ar' ? 'الحالة' : 'Status'}
                    </th>
                    <th className="px-4 py-3 text-start font-medium">
                      {lang === 'ar' ? 'التسجيل / الانتهاء' : 'Registered / Ends'}
                    </th>
                    <th className="px-4 py-3 text-start font-medium">
                      {lang === 'ar' ? 'التوليدات' : 'Usage'}
                    </th>
                    <th className="px-4 py-3 text-end font-medium">
                      {lang === 'ar' ? 'الإجراءات' : 'Actions'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredUsers.map((u) => {
                    const planObj = plans.find((p) => p.id === u.selectedPlanId);
                    return (
                      <tr key={u.id} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-white">{u.name}</div>
                          <div className="font-mono-num text-slate-400">{u.phone}</div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-300">
                          {lang === 'ar' ? planObj?.nameAr : planObj?.nameEn}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`font-semibold ${
                              u.status === 'active'
                                ? 'text-emerald-400'
                                : u.status === 'pending'
                                ? 'text-amber-300'
                                : 'text-red-400'
                            }`}
                          >
                            {t.auth.statusLabels[u.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-mono-num text-slate-400">
                          <div>{new Date(u.createdAt).toLocaleDateString()}</div>
                          {u.subscriptionEnd && (
                            <div className="text-[11px] text-blue-300">
                              → {new Date(u.subscriptionEnd).toLocaleDateString()}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5 font-mono-num text-slate-200">
                          {u.generationCount}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            {u.status === 'pending' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleUserAction(u.id, 'approve')}
                                  className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500 whitespace-nowrap"
                                >
                                  {t.admin.approve}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUserAction(u.id, 'reject')}
                                  className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[11px] font-medium text-red-200 hover:bg-red-500/20 whitespace-nowrap"
                                >
                                  {t.admin.reject}
                                </button>
                              </>
                            )}
                            {u.status === 'active' && (
                              <button
                                type="button"
                                onClick={() => handleUserAction(u.id, 'suspend')}
                                className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-200 hover:bg-amber-500/20 whitespace-nowrap"
                              >
                                {t.admin.suspend}
                              </button>
                            )}
                            {(u.status === 'expired' ||
                              u.status === 'rejected' ||
                              u.status === 'suspended') && (
                              <button
                                type="button"
                                onClick={() => handleUserAction(u.id, 'renew')}
                                className="rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-500 whitespace-nowrap"
                              >
                                {u.status === 'suspended' ? t.admin.reactivate : t.admin.renew}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openEditDatesModal(u)}
                              className="rounded-lg border border-white/10 bg-[#151726] px-2.5 py-1 text-[11px] text-slate-200 hover:border-blue-500/40 whitespace-nowrap"
                            >
                              {t.admin.editDates}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u.id)}
                              aria-label={t.admin.delete}
                              className="rounded-lg border border-red-500/20 bg-red-500/10 p-1.5 text-red-300 hover:bg-red-500/20"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Plans & Pricing Editor */}
      {tab === 'plans' && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="space-y-4 rounded-2xl border border-white/10 bg-[#0F101A] p-5"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="font-mono-num text-xs text-blue-300">{plan.id}</span>
                <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={plan.isActive}
                    onChange={(e) =>
                      setPlans((prev) =>
                        prev.map((p) =>
                          p.id === plan.id ? { ...p, isActive: e.target.checked } : p
                        )
                      )
                    }
                    className="accent-violet-500"
                  />
                  <span>{lang === 'ar' ? 'مفعّلة' : 'Active'}</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">
                    {lang === 'ar' ? 'الاسم (عربي)' : 'Name (AR)'}
                  </label>
                  <input
                    type="text"
                    value={plan.nameAr}
                    onChange={(e) =>
                      setPlans((prev) =>
                        prev.map((p) => (p.id === plan.id ? { ...p, nameAr: e.target.value } : p))
                      )
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#090A12] px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">
                    {lang === 'ar' ? 'الاسم (إنجليزي)' : 'Name (EN)'}
                  </label>
                  <input
                    type="text"
                    value={plan.nameEn}
                    onChange={(e) =>
                      setPlans((prev) =>
                        prev.map((p) => (p.id === plan.id ? { ...p, nameEn: e.target.value } : p))
                      )
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#090A12] px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-slate-400">
                    {lang === 'ar' ? 'السعر' : 'Price'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={plan.price}
                    onChange={(e) =>
                      setPlans((prev) =>
                        prev.map((p) =>
                          p.id === plan.id ? { ...p, price: Number(e.target.value) } : p
                        )
                      )
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#090A12] px-3 py-2 font-mono-num text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">
                    {lang === 'ar' ? 'المدة (بالأيام)' : 'Duration (days)'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={plan.durationDays}
                    onChange={(e) =>
                      setPlans((prev) =>
                        prev.map((p) =>
                          p.id === plan.id ? { ...p, durationDays: Number(e.target.value) } : p
                        )
                      )
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#090A12] px-3 py-2 font-mono-num text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  {lang === 'ar' ? 'الوصف (عربي)' : 'Description (AR)'}
                </label>
                <input
                  type="text"
                  value={plan.descriptionAr}
                  onChange={(e) =>
                    setPlans((prev) =>
                      prev.map((p) =>
                        p.id === plan.id ? { ...p, descriptionAr: e.target.value } : p
                      )
                    )
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#090A12] px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  {lang === 'ar' ? 'الوصف (إنجليزي)' : 'Description (EN)'}
                </label>
                <input
                  type="text"
                  value={plan.descriptionEn}
                  onChange={(e) =>
                    setPlans((prev) =>
                      prev.map((p) =>
                        p.id === plan.id ? { ...p, descriptionEn: e.target.value } : p
                      )
                    )
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#090A12] px-3 py-2 text-xs text-white"
                />
              </div>

              <button
                type="button"
                onClick={() => handleSavePlan(plan)}
                className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 py-2.5 text-xs font-semibold text-white hover:from-violet-500 hover:to-blue-500"
              >
                {t.admin.saveChanges}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: Site Settings */}
      {tab === 'settings' && settings && (
        <form
          onSubmit={handleSaveSettings}
          className="max-w-2xl space-y-5 rounded-2xl border border-white/10 bg-[#0F101A] p-6"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs text-slate-300">
                {lang === 'ar' ? 'اسم الموقع' : 'Site Name'}
              </label>
              <input
                type="text"
                value={settings.siteName}
                onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-[#090A12] px-3.5 py-2 text-sm text-white"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-slate-300">
                {lang === 'ar' ? 'العملة' : 'Currency'}
              </label>
              <input
                type="text"
                value={settings.currency}
                onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-[#090A12] px-3.5 py-2 text-sm text-white"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-slate-300">
                {lang === 'ar' ? 'الشعار (عربي)' : 'Tagline (AR)'}
              </label>
              <input
                type="text"
                value={settings.taglineAr}
                onChange={(e) => setSettings({ ...settings, taglineAr: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-[#090A12] px-3.5 py-2 text-sm text-white"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-slate-300">
                {lang === 'ar' ? 'الشعار (إنجليزي)' : 'Tagline (EN)'}
              </label>
              <input
                type="text"
                value={settings.taglineEn}
                onChange={(e) => setSettings({ ...settings, taglineEn: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-[#090A12] px-3.5 py-2 text-sm text-white"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-slate-300">
                {lang === 'ar' ? 'الحد الأقصى للأحرف لكل توليد' : 'Max Characters / Generation'}
              </label>
              <input
                type="number"
                min={100}
                max={10000}
                value={settings.maxCharsPerGeneration}
                onChange={(e) =>
                  setSettings({ ...settings, maxCharsPerGeneration: Number(e.target.value) })
                }
                className="w-full rounded-xl border border-white/10 bg-[#090A12] px-3.5 py-2 font-mono-num text-sm text-white"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-slate-300">
                {lang === 'ar'
                  ? 'الحد اليومي للتوليد (0 = غير محدود)'
                  : 'Daily Limit (0 = unlimited)'}
              </label>
              <input
                type="number"
                min={0}
                value={settings.dailyGenerationLimit}
                onChange={(e) =>
                  setSettings({ ...settings, dailyGenerationLimit: Number(e.target.value) })
                }
                className="w-full rounded-xl border border-white/10 bg-[#090A12] px-3.5 py-2 font-mono-num text-sm text-white"
              />
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#090A12] p-3.5 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={settings.registrationEnabled}
              onChange={(e) =>
                setSettings({ ...settings, registrationEnabled: e.target.checked })
              }
              className="h-4 w-4 accent-violet-500"
            />
            <span>
              {lang === 'ar'
                ? 'السماح بتسجيل مستخدمين جدد'
                : 'Allow new user registrations'}
            </span>
          </label>

          <button
            type="submit"
            className="rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-6 py-3 text-sm font-bold text-white hover:from-violet-500 hover:to-blue-500"
          >
            {t.admin.saveChanges}
          </button>
        </form>
      )}

      {/* Edit User Dates & Plan Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <form
            onSubmit={handleSaveUserDates}
            className="w-full max-w-md space-y-4 rounded-2xl border border-white/15 bg-[#0F101A] p-6"
          >
            <h2 className="text-lg font-bold text-white">
              {editingUser.name} · <span className="font-mono-num text-sm">{editingUser.phone}</span>
            </h2>

            <div>
              <label className="mb-1 block text-xs text-slate-400">
                {lang === 'ar' ? 'الباقة' : 'Plan'}
              </label>
              <select
                value={editPlanId}
                onChange={(e) => setEditPlanId(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#090A12] px-3 py-2 text-xs text-white"
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {lang === 'ar' ? p.nameAr : p.nameEn}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-400">
                {lang === 'ar' ? 'الحالة' : 'Status'}
              </label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as SubscriptionStatus)}
                className="w-full rounded-xl border border-white/10 bg-[#090A12] px-3 py-2 text-xs text-white"
              >
                {(['pending', 'active', 'expired', 'rejected', 'suspended'] as const).map((s) => (
                  <option key={s} value={s}>
                    {t.auth.statusLabels[s]}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  {lang === 'ar' ? 'تاريخ البداية' : 'Start Date'}
                </label>
                <input
                  type="date"
                  required
                  value={editStart}
                  onChange={(e) => setEditStart(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#090A12] px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  {lang === 'ar' ? 'تاريخ النهاية' : 'End Date'}
                </label>
                <input
                  type="date"
                  required
                  value={editEnd}
                  onChange={(e) => setEditEnd(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#090A12] px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="rounded-xl border border-white/15 px-4 py-2 text-xs text-slate-300"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
              >
                {t.admin.saveChanges}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
