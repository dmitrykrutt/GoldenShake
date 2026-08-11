import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownTrayIcon,
  PauseIcon,
  PlayIcon,
  SpeakerWaveIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid';

/** Fixed pseudo-random waveform so server and client renders match. */
const WAVE_BARS = Array.from({ length: 48 }, (_, i) =>
  Math.round(28 + 52 * Math.abs(Math.sin(i * 1.37) * Math.cos(i * 0.53)))
);

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function PhotoLightbox({ src, alt = '', onClose }) {
  useEffect(() => {
    const handler = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="Close image"
        className="absolute right-5 top-5 rounded-full border border-gold/30 p-2 text-gold hover:bg-gold/10"
        onClick={onClose}
      >
        <XMarkIcon className="h-6 w-6" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[88vh] max-w-full rounded-2xl border border-gold/20 object-contain shadow-gold-lg"
      />
    </div>
  );
}

export function AudioWaveform({ src, duration = 0 }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(duration);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
    setPlaying(!playing);
  };

  const seek = (event) => {
    const audio = audioRef.current;
    if (!audio || !total) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    audio.currentTime = ratio * total;
  };

  return (
    <div className="flex w-full max-w-xs items-center gap-3 rounded-xl bg-black/40 p-2.5">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause audio' : 'Play audio'}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold-gradient text-black transition hover:brightness-110"
      >
        {playing ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5 pl-0.5" />}
      </button>

      <div className="min-w-0 flex-1">
        <div
          className="flex h-9 cursor-pointer items-center gap-[2px]"
          onClick={seek}
          role="presentation"
        >
          {WAVE_BARS.map((height, index) => {
            const active = (index / WAVE_BARS.length) * 100 <= progress;
            return (
              <span
                key={index}
                style={{ height: `${height}%` }}
                className={`w-full rounded-full transition-colors ${
                  active ? 'bg-gold' : 'bg-graphite-lighter'
                }`}
              />
            );
          })}
        </div>
        <div className="mt-1 flex justify-between text-[10px] tabular-nums text-neutral-500">
          <span>{formatTime(current)}</span>
          <span>{formatTime(total)}</span>
        </div>
      </div>

      <SpeakerWaveIcon className="h-4 w-4 shrink-0 text-neutral-600" />

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => setTotal(event.currentTarget.duration)}
        onTimeUpdate={(event) => {
          const audio = event.currentTarget;
          setCurrent(audio.currentTime);
          setProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0);
        }}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
          setCurrent(0);
        }}
      >
        <track kind="captions" />
      </audio>
    </div>
  );
}

export default function MediaPlayer({ type, src, name = 'attachment', meta = {} }) {
  const [lightbox, setLightbox] = useState(false);

  if (!src) return null;

  if (type === 'image') {
    return (
      <>
        <button type="button" onClick={() => setLightbox(true)} className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={name}
            className="max-h-72 rounded-xl border border-white/10 object-cover transition hover:border-gold/40"
          />
        </button>
        {lightbox && <PhotoLightbox src={src} alt={name} onClose={() => setLightbox(false)} />}
      </>
    );
  }

  if (type === 'video') {
    return (
      <video
        controls
        preload="metadata"
        poster={meta.poster}
        className="max-h-80 w-full rounded-xl border border-white/10 bg-black"
      >
        <source src={src} />
        <track kind="captions" />
        Your browser does not support embedded video.
      </video>
    );
  }

  if (type === 'audio') {
    return <AudioWaveform src={src} duration={meta.duration} />;
  }

  return (
    <a
      href={src}
      download
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm transition hover:border-gold/40"
    >
      <ArrowDownTrayIcon className="h-5 w-5 text-gold" />
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {meta.size && <span className="text-xs text-neutral-500">{meta.size}</span>}
    </a>
  );
}
