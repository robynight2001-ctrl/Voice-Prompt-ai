import { useEffect, useRef, useState } from 'react';
import { Bookmark, Download, Pause, Play, RotateCcw } from 'lucide-react';
import type { Lang } from '../i18n/translations';
import { TEXT } from '../i18n/translations';

interface AudioPlayerBarProps {
  lang: Lang;
  audioUrl: string;
  durationSeconds: number;
  fileName?: string;
  onRegenerate?: () => void;
  regenerating?: boolean;
  onSaveLocal?: () => void;
  saved?: boolean;
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '00:00.0';
  const mins = Math.floor(sec / 60);
  const secs = Math.floor(sec % 60);
  const tenths = Math.floor((sec % 1) * 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}

export function AudioPlayerBar({
  lang,
  audioUrl,
  durationSeconds,
  fileName = 'voiceprompt-audio.wav',
  onRegenerate,
  regenerating = false,
  onSaveLocal,
  saved = false,
}: AudioPlayerBarProps) {
  const t = TEXT[lang];
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [realDuration, setRealDuration] = useState(durationSeconds);
  const [playError, setPlayError] = useState<string | null>(null);

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setRealDuration(durationSeconds);
    setPlayError(null);
    if (audioRef.current) {
      audioRef.current.load();
    }
  }, [audioUrl, durationSeconds]);

  const togglePlay = async () => {
    const el = audioRef.current;
    if (!el) return;
    setPlayError(null);
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      try {
        await el.play();
        setPlaying(true);
      } catch (err) {
        setPlaying(false);
        setPlayError(
          err instanceof Error ? err.message : 'Unable to play audio source.'
        );
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  };

  const maxDur = realDuration > 0 ? realDuration : 1;

  return (
    <div className="rounded-xl border border-white/10 bg-[#0F101A] p-4 sm:p-5">
      <audio
        ref={audioRef}
        src={audioUrl}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setRealDuration(d);
        }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
        }}
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 items-center gap-4">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? 'Pause' : 'Play'}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 text-white transition-transform duration-150 hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
          >
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>WAV · 24kHz Studio</span>
              <span className="font-mono-num text-slate-200">
                {formatTime(currentTime)} / {formatTime(realDuration)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={maxDur}
              step={0.05}
              value={Math.min(currentTime, maxDur)}
              onChange={handleSeek}
              aria-label="Audio progress"
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-blue-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={regenerating}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#151726] px-3.5 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-violet-500/40 hover:text-white disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${regenerating ? 'animate-spin' : ''}`} />
              <span>{t.studio.regenerateBtn}</span>
            </button>
          )}

          <a
            href={audioUrl}
            download={fileName}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#151726] px-3.5 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-blue-500/40 hover:text-white whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{t.studio.downloadBtn}</span>
          </a>

          {onSaveLocal && (
            <button
              type="button"
              onClick={onSaveLocal}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                saved
                  ? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                  : 'bg-blue-600 text-white hover:bg-blue-500'
              }`}
            >
              <Bookmark className="h-3.5 w-3.5" />
              <span>{t.studio.saveLocalBtn}</span>
            </button>
          )}
        </div>
      </div>

      {playError && (
        <p className="mt-3 text-xs text-red-300">{playError}</p>
      )}
    </div>
  );
}
