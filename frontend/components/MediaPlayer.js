import { useState } from 'react';
import {
  ArrowDownTrayIcon,
  DocumentIcon,
} from '@heroicons/react/24/solid';
import MediaViewer from './MediaViewer';
import VoiceMessagePlayer from './VoiceMessagePlayer';

export default function MediaPlayer({ type, src, name = 'attachment', meta = {} }) {
  const [lightbox, setLightbox] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  if (!src) return null;

  if (type === 'image') {
    return (
      <>
        <button
          type="button"
          onClick={() => setLightbox(true)}
          className="block overflow-hidden"
          aria-label="Открыть изображение"
        >
          {!imgLoaded && (
            <div className="skeleton h-40 w-64 rounded-xl" />
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={name}
            onLoad={() => setImgLoaded(true)}
            className="rounded-xl border border-white/10 object-cover transition hover:border-gold/40"
            style={{
              maxWidth: '320px',
              maxHeight: '240px',
              display: imgLoaded ? 'block' : 'none',
              borderRadius: '12px',
            }}
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
      <div
        className="overflow-hidden border border-white/10 bg-black"
        style={{ maxWidth: '320px', maxHeight: '240px', borderRadius: '12px' }}
      >
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          controls
          preload="metadata"
          poster={meta.poster}
          className="h-full w-full object-contain"
          style={{ maxWidth: '320px', maxHeight: '240px' }}
        >
          <source src={src} />
        </video>
      </div>
    );
  }

  if (type === 'audio' || type === 'voice') {
    return <VoiceMessagePlayer src={src} duration={meta.duration} />;
  }

  // Generic file download
  const sizeText = meta.size
    ? typeof meta.size === 'number'
      ? meta.size < 1024 * 1024
        ? `${(meta.size / 1024).toFixed(1)} КБ`
        : `${(meta.size / (1024 * 1024)).toFixed(1)} МБ`
      : meta.size
    : null;

  return (
    <a
      href={src}
      download
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm transition hover:border-gold/40"
    >
      <DocumentIcon className="h-5 w-5 shrink-0 text-gold" />
      <span className="min-w-0 flex-1 truncate">{name}</span>
      <span className="flex shrink-0 items-center gap-1 text-xs text-neutral-500">
        {sizeText && <span>{sizeText}</span>}
        <ArrowDownTrayIcon className="h-4 w-4 text-neutral-500" />
      </span>
    </a>
  );
}
