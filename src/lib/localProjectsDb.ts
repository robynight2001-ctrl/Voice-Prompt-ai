import type { VoiceSettings } from '../shared/voices';

export interface LocalVoiceProject {
  id: string;
  userId: string;
  title: string;
  prompt: string;
  spokenText: string;
  characterId: string;
  settings: VoiceSettings;
  audioBlob: Blob;
  durationSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExportedProjectPayload {
  format: 'voiceprompt-ai-project-v1';
  exportedAt: string;
  projects: Array<{
    id: string;
    title: string;
    prompt: string;
    spokenText: string;
    characterId: string;
    settings: VoiceSettings;
    durationSeconds: number;
    audioBase64: string;
    mimeType: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

const DB_NAME = 'voiceprompt_local_projects_db';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open local IndexedDB'));
  });
}

export async function listLocalProjects(userId: string): Promise<LocalVoiceProject[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('userId');
    const req = index.getAll(userId);
    req.onsuccess = () => {
      const list = (req.result as LocalVoiceProject[]) || [];
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      resolve(list);
    };
    req.onerror = () => reject(req.error || new Error('Failed to read local projects'));
  });
}

export async function saveLocalProject(project: LocalVoiceProject): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(project);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to save project locally'));
  });
}

export async function deleteLocalProject(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to delete local project'));
  });
}

export function base64ToBlob(base64: string, mimeType = 'audio/wav'): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = String(reader.result || '');
      const commaIdx = res.indexOf(',');
      resolve(commaIdx >= 0 ? res.slice(commaIdx + 1) : res);
    };
    reader.onerror = () => reject(new Error('Failed to convert audio blob'));
    reader.readAsDataURL(blob);
  });
}

export async function exportProjectsToJson(projects: LocalVoiceProject[]): Promise<string> {
  const serialized = await Promise.all(
    projects.map(async (p) => ({
      id: p.id,
      title: p.title,
      prompt: p.prompt,
      spokenText: p.spokenText,
      characterId: p.characterId,
      settings: p.settings,
      durationSeconds: p.durationSeconds,
      audioBase64: await blobToBase64(p.audioBlob),
      mimeType: p.audioBlob.type || 'audio/wav',
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }))
  );

  const payload: ExportedProjectPayload = {
    format: 'voiceprompt-ai-project-v1',
    exportedAt: new Date().toISOString(),
    projects: serialized,
  };

  return JSON.stringify(payload, null, 2);
}

export async function importProjectsFromJson(
  jsonText: string,
  userId: string
): Promise<LocalVoiceProject[]> {
  const parsed = JSON.parse(jsonText) as ExportedProjectPayload;
  if (parsed?.format !== 'voiceprompt-ai-project-v1' || !Array.isArray(parsed.projects)) {
    throw new Error('Invalid VoicePrompt AI project backup file.');
  }

  const imported: LocalVoiceProject[] = [];
  for (const item of parsed.projects) {
    if (!item.audioBase64 || !item.spokenText) continue;
    const project: LocalVoiceProject = {
      id: crypto.randomUUID(),
      userId,
      title: item.title || 'Imported Project',
      prompt: item.prompt || '',
      spokenText: item.spokenText,
      characterId: item.characterId || 'young_woman',
      settings: item.settings,
      audioBlob: base64ToBlob(item.audioBase64, item.mimeType || 'audio/wav'),
      durationSeconds: Number(item.durationSeconds || 0),
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveLocalProject(project);
    imported.push(project);
  }
  return imported;
}
