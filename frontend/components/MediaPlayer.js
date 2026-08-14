import { useState } from 'react';
import {
  ArrowDownTrayIcon,
} from '@heroicons/react/24/solid';
import MediaViewer from './MediaViewer';
import VoiceMessagePlayer from './VoiceMessagePlayer';

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
        {lightbox && (
          <MediaViewer
            items={[{ type: 'image', src, alt: name }]}
            onClose={() => setLightbox(false)}
          />
        )}
      </>
    );
  }

  if (type === 'video') {
    return (
      <>
        <button type="button" onClick={() => setLightbox(true)} className="block w-full">
          <video
            controls
            preload="none"
            poster={meta.poster}
            className="max-h-80 w-full rounded-xl border border-white/10 bg-black"
          >
            <source src={src} />
            <track kind="captions" />
            Your browser does not support embedded video.
          </video>
        </button>
        {lightbox && (
          <MediaViewer
            items={[{ type: 'video', src, alt: name }]}
            onClose={() => setLightbox(false)}
          />
        )}
      </>
    );
  }

  if (type === 'audio' || type === 'voice') {
    return <VoiceMessagePlayer src={src} duration={meta.duration} />;
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
