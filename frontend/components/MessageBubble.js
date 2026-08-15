import { useState } from 'react';
import {
  ArrowUturnLeftIcon,
  LockClosedIcon,
  MapPinIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import MediaPlayer from './MediaPlayer';
import { RARITY_META, formatDate } from '../lib/constants';
import Username from './Username';

function LockedFileCard({ locked, onUnlock, busy }) {
  const rarity = RARITY_META[locked.price_rarity] || RARITY_META.green;
  return (
    <div className="rounded-xl border border-gold/30 bg-black/50 p-4">
      <div className="flex items-center gap-2 text-gold">
        <LockClosedIcon className="h-5 w-5" />
        <span className="text-sm font-semibold">Закрытый контент</span>
      </div>
      {locked.preview_text && (
        <p className="mt-2 text-xs text-neutral-400">{locked.preview_text}</p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={onUnlock}
        className="btn-primary mt-3 w-full text-xs"
      >
        Разблокировать за {locked.price_amount}{' '}
        <span style={{ color: rarity.color }}>{rarity.label}</span>
      </button>
    </div>
  );
}

export default function MessageBubble({
  message,
  isOwn,
  onDelete,
  onReply,
  onPin,
  onUnlock,
  onOpenProfile,
}) {
  const [busy, setBusy] = useState(false);
  const locked = message.locked_file;
  const isLocked = Boolean(locked) && !locked.is_unlocked;

  const handleUnlock = async () => {
    setBusy(true);
    try {
      await onUnlock?.(message);
    } finally {
      setBusy(false);
    }
  };

  if (message.deleted_for_all) {
    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
        <div className="rounded-2xl border border-white/5 bg-graphite/40 px-4 py-2 text-xs italic text-neutral-600">
          Сообщение удалено
        </div>
      </div>
    );
  }

  if (message.message_type === 'system') {
    return (
      <div className="flex justify-center">
        <div className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-xs text-neutral-400">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`group flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isOwn &&
        (message.sender?.avatar ? (
          <button type="button" onClick={() => onOpenProfile?.(message.sender?.username)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={message.sender.avatar}
              alt={message.sender.username}
              className="mt-auto h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-gold/30"
            />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onOpenProfile?.(message.sender?.username)}
            className="mt-auto grid h-8 w-8 shrink-0 place-items-center rounded-full bg-graphite text-xs font-bold text-gold"
          >
            {(message.sender?.username || '?').slice(0, 2).toUpperCase()}
          </button>
        ))}

      <div className={`flex max-w-[78%] flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
        {!isOwn && (
          <button type="button" onClick={() => onOpenProfile?.(message.sender?.username)} className="mb-0.5 px-1 text-[11px] font-medium text-gold/80">
            <Username user={message.sender} />
          </button>
        )}

        <div
          className={`relative rounded-2xl px-4 py-2.5 text-sm shadow-glass ${
            isOwn
              ? 'rounded-br-md border border-gold/30 bg-gold/10 text-neutral-100'
              : 'rounded-bl-md border border-white/5 bg-graphite text-neutral-200'
          }`}
        >
          {message.reply_to_preview && (
            <div className="mb-2 border-l-2 border-gold/50 pl-2 text-xs text-neutral-400">
              {message.reply_to_preview}
            </div>
          )}

          {message.is_pinned && (
            <MapPinIcon className="absolute -left-5 top-2 h-3.5 w-3.5 text-gold" />
          )}

          {isLocked ? (
            <LockedFileCard locked={locked} onUnlock={handleUnlock} busy={busy} />
          ) : (
            <>
              {message.media && (
                <div className="mb-2">
                  <MediaPlayer
                    type={message.message_type}
                    src={message.media}
                    name={message.media_meta?.name || 'attachment'}
                    meta={message.media_meta || {}}
                  />
                </div>
              )}
              {message.message_type === 'coin_donation' ? (
                <div className="flex items-center gap-2 font-semibold text-gold">
                  🤝 {message.content || 'Handshake donation'}
                </div>
              ) : (
                message.content && (
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                )
              )}
            </>
          )}

          <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-neutral-500">
            {message.edited_at && <span>редактировано</span>}
            <span>{formatDate(message.created_at)}</span>
          </div>
        </div>

        <div className="mt-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            aria-label="Ответить"
            onClick={() => onReply?.(message)}
            className="rounded-md p-1 text-neutral-500 hover:text-gold"
          >
            <ArrowUturnLeftIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Закрепить"
            onClick={() => onPin?.(message)}
            className="rounded-md p-1 text-neutral-500 hover:text-gold"
          >
            <MapPinIcon className="h-3.5 w-3.5" />
          </button>
          {isOwn && (
            <button
              type="button"
              aria-label="Удалить сообщение"
              onClick={() => onDelete?.(message)}
              className="rounded-md p-1 text-neutral-500 hover:text-red-400"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
