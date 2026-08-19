import { useState, useRef } from 'react';
import {
  ArrowUturnLeftIcon,
  CheckIcon,
  EllipsisVerticalIcon,
  LockClosedIcon,
  MapPinIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import Username from './Username';
import VoiceMessagePlayer from './VoiceMessagePlayer';

export default function MessageBubble({
  message,
  isOwn = false,
  onOpenProfile,
  onDelete,
  onReply,
  onPin,
  onUnlock,
  onOpenMedia,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const touchTimerRef = useRef(null);

  if (message.message_type === 'system') {
    return (
      <div className="my-2 flex justify-center px-4">
        <div className="rounded-full border border-white/10 bg-black/60 px-3.5 py-1 text-center text-xs text-neutral-400 backdrop-blur-md select-none">
          {message.content}
        </div>
      </div>
    );
  }

  const senderName = message.sender?.username || message.sender_username || message.sender || 'Пользователь';
  const senderAvatar = message.sender?.avatar;
  const reply = message.reply_to_message || message.reply_to;

  const isMediaOnly = (message.message_type === 'image' || message.message_type === 'video' || message.message_type === 'voice') && !message.content;

  // Telegram Long Press для мобильных устройств
  const handleTouchStart = () => {
    touchTimerRef.current = setTimeout(() => {
      if (typeof window !== 'undefined' && window.navigator?.vibrate) {
        window.navigator.vibrate(40);
      }
      setMenuOpen(true);
    }, 450);
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
    }
  };

  return (
    <div
      className={`group relative flex w-full gap-2 px-2 py-0.5 select-none ${isOwn ? 'justify-end' : 'justify-start'}`}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenuOpen(true);
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
    >
      {!isOwn && (
        <button
          type="button"
          onClick={() => onOpenProfile?.(senderName)}
          className="mt-auto shrink-0 self-end -mb-0.5"
        >
          {senderAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={senderAvatar} alt={senderName} className="h-7 w-7 rounded-full object-cover ring-1 ring-gold/30" />
          ) : (
            <div className="grid h-7 w-7 place-items-center rounded-full bg-graphite text-[10px] font-bold text-gold ring-1 ring-gold/20">
              {senderName.slice(0, 2).toUpperCase()}
            </div>
          )}
        </button>
      )}

      <div
        className={`relative max-w-[85%] sm:max-w-[70%] transition-all break-words ${
          isMediaOnly
            ? 'p-0 bg-transparent border-0'
            : isOwn
              ? 'rounded-2xl rounded-br-sm bg-gradient-to-br from-[#8C7431] to-[#6A5420] px-3.5 py-2 text-white shadow-sm'
              : 'rounded-2xl rounded-bl-sm border border-white/10 bg-graphite/80 px-3.5 py-2 text-neutral-200 shadow-sm backdrop-blur-md'
        }`}
      >
        {/* Шапка имени для собеседника */}
        {!isOwn && !isMediaOnly && (
          <div className="mb-1">
            <span className="text-[11px] font-bold text-gold cursor-pointer hover:underline" onClick={() => onOpenProfile?.(senderName)}>
              <Username user={message.sender} username={senderName} />
            </span>
          </div>
        )}

        {/* Цитата ответа (Reply) */}
        {reply && (
          <div
            className={`mb-1.5 flex flex-col rounded-lg border-l-2 py-1 px-2 text-xs ${
              isOwn
                ? 'border-gold/80 bg-black/30 text-neutral-200'
                : 'border-gold bg-white/5 text-neutral-300'
            }`}
          >
            <span className="font-semibold text-gold text-[11px]">
              {reply.sender?.username || reply.sender_username || reply.sender || 'Сообщение'}
            </span>
            <span className="truncate text-[11px] opacity-80">
              {reply.content || (reply.media_meta ? 'Вложение' : 'Сообщение')}
            </span>
          </div>
        )}

        {/* Текст сообщения */}
        {message.content && (
          <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed select-text">
            {message.content}
          </p>
        )}

        {/* Голосовое сообщение без громоздких рамок */}
        {message.message_type === 'voice' && message.media && (
          <div className="my-0.5">
            <VoiceMessagePlayer src={message.media} duration={message.media_meta?.duration} />
          </div>
        )}

        {/* Изображение с кликом в полный размер */}
        {message.message_type === 'image' && message.media && (
          <div className="my-0.5 overflow-hidden rounded-2xl cursor-pointer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={message.media}
              alt=""
              onClick={() => onOpenMedia?.({ type: 'image', src: message.media })}
              className="max-h-80 w-full rounded-2xl object-cover hover:opacity-95 transition"
            />
          </div>
        )}

        {/* Видео */}
        {message.message_type === 'video' && message.media && (
          <div className="my-0.5 overflow-hidden rounded-2xl">
            <video src={message.media} controls className="max-h-80 w-full rounded-2xl object-cover" />
          </div>
        )}

        {/* Файл */}
        {message.message_type === 'file' && message.media && (
          <a
            href={message.media}
            target="_blank"
            rel="noopener noreferrer"
            className="my-1 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 p-2.5 text-xs text-white hover:bg-black/50"
          >
            <span className="text-base">📎</span>
            <span className="truncate">{message.media_meta?.filename || 'Скачать файл'}</span>
          </a>
        )}

        {/* Заблокированный платный файл */}
        {message.message_type === 'locked_file' && message.locked && (
          <div className="my-1 rounded-xl border border-gold/40 bg-black/40 p-3 text-center">
            <LockClosedIcon className="mx-auto h-6 w-6 text-gold" />
            <p className="mt-1 text-xs font-semibold text-white">Платный контент</p>
            <p className="text-[11px] text-neutral-400">
              Стоимость: {message.locked.price_amount} {message.locked.price_rarity}
            </p>
            {!isOwn && (
              <button
                type="button"
                onClick={() => onUnlock?.(message)}
                className="btn-primary mt-2 py-1 px-3 text-xs"
              >
                Разблокировать
              </button>
            )}
          </div>
        )}

        {/* Время сообщения */}
        {!isMediaOnly && (
          <div className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${isOwn ? 'text-neutral-300' : 'text-neutral-500'}`}>
            <span>
              {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {isOwn && <CheckIcon className="h-3 w-3 text-gold" />}
          </div>
        )}
      </div>

      {/* Кнопка с тремя точками только для ноутбуков/десктопов */}
      <div className="hidden sm:flex relative self-center opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="rounded-full p-1 text-neutral-400 hover:bg-white/10 hover:text-white"
        >
          <EllipsisVerticalIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Меню действий (Telegram style popup) */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" onClick={() => setMenuOpen(false)} />
          <div
            className={`fixed z-50 min-w-[160px] rounded-2xl border border-white/15 bg-graphite/95 py-1.5 shadow-2xl backdrop-blur-2xl ${
              isOwn ? 'right-6 bottom-24 sm:bottom-auto sm:top-1/2' : 'left-6 bottom-24 sm:bottom-auto sm:top-1/2'
            }`}
          >
            <button
              type="button"
              onClick={() => { setMenuOpen(false); onReply?.(message); }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs font-semibold text-neutral-200 hover:bg-white/10"
            >
              <ArrowUturnLeftIcon className="h-4 w-4 text-gold" /> Ответить
            </button>
            <button
              type="button"
              onClick={() => { setMenuOpen(false); onPin?.(message); }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs font-semibold text-neutral-200 hover:bg-white/10"
            >
              <MapPinIcon className="h-4 w-4 text-gold" /> {message.is_pinned ? 'Открепить' : 'Закрепить'}
            </button>
            {isOwn && (
              <button
                type="button"
                onClick={() => { setMenuOpen(false); onDelete?.(message); }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs font-semibold text-red-400 hover:bg-red-500/15"
              >
                <TrashIcon className="h-4 w-4" /> Удалить
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
