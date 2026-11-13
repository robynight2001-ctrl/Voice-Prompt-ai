import { useEffect, useRef, useState } from 'react';
import {
  Download,
  FileUp,
  FolderOpen,
  HardDrive,
  Trash2,
  Upload,
} from 'lucide-react';
import type { Lang } from '../i18n/translations';
import { TEXT } from '../i18n/translations';
import {
  deleteLocalProject,
  exportProjectsToJson,
  importProjectsFromJson,
  listLocalProjects,
  type LocalVoiceProject,
} from '../lib/localProjectsDb';
import { VOICE_CHARACTERS, type UserProfile } from '../shared/voices';
import { AudioPlayerBar } from './AudioPlayerBar';

interface ProjectsPageProps {
  lang: Lang;
  user: UserProfile | null;
  onOpenProjectInStudio: (project: LocalVoiceProject) => void;
  onGoToStudio: () => void;
  onGoToAuth: () => void;
}

export function ProjectsPage({
  lang,
  user,
  onOpenProjectInStudio,
  onGoToStudio,
  onGoToAuth,
}: ProjectsPageProps) {
  const t = TEXT[lang];
  const [projects, setProjects] = useState<LocalVoiceProject[]>([]);
  const [blobUrls, setBlobUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const storageOwnerId = user?.id || 'guest_local';

  const loadProjects = async () => {
    setLoading(true);
    try {
      const list = await listLocalProjects(storageOwnerId);
      setProjects(list);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load local projects.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects();
  }, [storageOwnerId]);

  useEffect(() => {
    const nextUrls: Record<string, string> = {};
    for (const p of projects) {
      nextUrls[p.id] = URL.createObjectURL(p.audioBlob);
    }
    setBlobUrls(nextUrls);
    return () => {
      Object.values(nextUrls).forEach((u) => URL.revokeObjectURL(u));
    };
  }, [projects]);

  const handleDelete = async (id: string) => {
    await deleteLocalProject(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const triggerDownloadText = (content: string, fileName: string) => {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSingle = async (project: LocalVoiceProject) => {
    const json = await exportProjectsToJson([project]);
    const safeTitle = project.title.replace(/[^\w\u0600-\u06FF-]+/g, '_');
    triggerDownloadText(json, `${safeTitle || 'project'}.vpai.json`);
  };

  const handleExportAll = async () => {
    if (projects.length === 0) return;
    const json = await exportProjectsToJson(projects);
    const dateTag = new Date().toISOString().slice(0, 10);
    triggerDownloadText(json, `voiceprompt-backup-${dateTag}.vpai.json`);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const text = await file.text();
      const imported = await importProjectsFromJson(text, storageOwnerId);
      await loadProjects();
      setStatusMsg(`${t.projects.importSuccess} (${imported.length})`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to import project file.');
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-blue-300">
            <HardDrive className="h-4 w-4" />
            <span>IndexedDB · Local Device Only</span>
          </div>
          <h1 className="text-2xl font-bold text-white">{t.projects.title}</h1>
          <p className="max-w-2xl text-sm text-slate-400">{t.projects.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.vpai.json"
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#0F101A] px-4 py-2.5 text-xs font-medium text-slate-200 transition-colors hover:border-blue-500/40 hover:text-white whitespace-nowrap shrink-0"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>{t.projects.importBtn}</span>
          </button>

          {projects.length > 0 && (
            <button
              type="button"
              onClick={handleExportAll}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:from-violet-500 hover:to-blue-500 whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{t.projects.exportAll}</span>
            </button>
          )}
        </div>
      </div>

      {!user && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-amber-200">
            {lang === 'ar'
              ? 'سجّل الدخول برقم هاتفك لربط مساحة المشاريع المحلية بحسابك بشكل مستقل على هذا الجهاز.'
              : 'Sign in with your phone number to keep your local project space separated under your account.'}
          </p>
          <button
            type="button"
            onClick={onGoToAuth}
            className="rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 whitespace-nowrap shrink-0"
          >
            {t.actions.login}
          </button>
        </div>
      )}

      {statusMsg && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {statusMsg}
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl border border-white/10 bg-[#0F101A]" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#0F101A] p-12 text-center">
          <FolderOpen className="mx-auto mb-3 h-10 w-10 text-slate-500" />
          <h2 className="text-lg font-bold text-white">{t.projects.emptyTitle}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">{t.projects.emptyDesc}</p>
          <button
            type="button"
            onClick={onGoToStudio}
            className="mt-6 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-2.5 text-xs font-semibold text-white"
          >
            {t.projects.goToStudio}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map((p) => {
            const charObj = VOICE_CHARACTERS.find((v) => v.id === p.characterId);
            const audioUrl = blobUrls[p.id];
            return (
              <div
                key={p.id}
                className="space-y-4 rounded-2xl border border-white/10 bg-[#0F101A] p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <h2 className="text-base font-bold text-white">{p.title}</h2>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span>{lang === 'ar' ? charObj?.nameAr : charObj?.nameEn}</span>
                      <span aria-hidden="true">·</span>
                      <span>{t.options.emotions[p.settings.emotion]}</span>
                      <span aria-hidden="true">·</span>
                      <span>{t.options.dialects[p.settings.dialect]}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num">
                        {new Date(p.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenProjectInStudio(p)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-500 whitespace-nowrap"
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                      <span>{t.projects.openInStudio}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExportSingle(p)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#151726] px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-violet-500/40 whitespace-nowrap"
                    >
                      <FileUp className="h-3.5 w-3.5" />
                      <span>{t.projects.exportJson}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/20 whitespace-nowrap"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{t.projects.deleteProject}</span>
                    </button>
                  </div>
                </div>

                {p.prompt && (
                  <p className="text-xs text-slate-400">
                    <span className="text-slate-500">Prompt: </span>
                    {p.prompt}
                  </p>
                )}

                <p className="rounded-lg border border-white/5 bg-[#090A12] p-3 text-sm text-slate-200">
                  {p.spokenText}
                </p>

                {audioUrl && (
                  <AudioPlayerBar
                    lang={lang}
                    audioUrl={audioUrl}
                    durationSeconds={p.durationSeconds}
                    fileName={`${p.title.replace(/\s+/g, '-')}.wav`}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
