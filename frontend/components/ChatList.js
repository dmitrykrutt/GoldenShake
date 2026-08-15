import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { MapPinIcon, ShieldCheckIcon, UsersIcon } from '@heroicons/react/24/solid';
import { formatDate } from '../lib/constants';
import Username from './Username';

function Avatar({ room, peer }) {
  const image = peer?.avatar || room.avatar;
  const label = peer?.username || room.display_title;
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={image}
        alt={label}
        className="h-12 w-12 rounded-full object-cover ring-1 ring-gold/30"
      />
    );
  }
  return (
    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-graphite-light font-display text-base font-bold text-gold ring-1 ring-gold/20">
      {(room.display_title || '#').slice(0, 2).toUpperCase()}
    </div>
  );
}

function ContextMenu({ x, y, onDelete, onBlock, onClose }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] rounded-xl border border-white/10 bg-graphite shadow-glass backdrop-blur-xl"
      style={{ top: y, left: x }}
    >
      <button
        type="button"
        onClick={onDelete}
        className="flex w-full items-center gap-2 rounded-t-xl px-4 py-3 text-left text-sm font-semibold text-red-400 hover:bg-red-500/10"
      >
        Удалить чат
      </button>
      <button
        type="button"
        onClick={onBlock}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-neutral-300 hover:bg-white/5"
      >
        Заблокировать пользователя
      </button>
      <button
        type="button"
        onClick={onClose}
        className="flex w-full items-center gap-2 rounded-b-xl px-4 py-3 text-left text-sm text-neutral-500 hover:bg-white/5"
      >
        Закрыть
      </button>
    </div>
  );
}

function ChatListItem({ room, activeId, currentUserId, onDelete, onBlock }) {
  const [contextMenu, setContextMenu] = useState(null);
  const active = String(room.id) === String(activeId);
  const preview = room.last_message?.content || 'Зашифрованное сообщение';
  const peer = room.is_group
    ? null
    : room.memberships?.find((member) => String(member.user?.id) !== String(currentUserId))?.user;

  const handleContextMenu = (event) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY });
  };

  return (
    <li className="relative" onContextMenu={handleContextMenu}>
      <Link
        href={`/chats/${room.id}`}
        className={`flex items-center gap-3 px-4 py-3 transition ${active ? 'bg-gold/10' : 'hover:bg-white/5'}`}
      >
        <Avatar room={room} peer={peer} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-white">
              <Username user={peer} username={room.display_title || 'Чат'} />
            </span>
            {room.is_garant_chat && <ShieldCheckIcon className="h-3.5 w-3.5 text-gold" />}
            {room.is_group && <UsersIcon className="h-3.5 w-3.5 text-neutral-500" />}
            {room.is_pinned && <MapPinIcon className="h-3.5 w-3.5 text-gold/70" />}
          </div>
          <p className="truncate text-xs text-neutral-500">{preview}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] text-neutral-600">
            {formatDate(room.last_message?.created_at || room.updated_at)}
          </span>
          {room.unread_count > 0 && (
            <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-gold px-1.5 text-[10px] font-bold text-black">
              {room.unread_count > 99 ? '99+' : room.unread_count}
            </span>
          )}
        </div>
      </Link>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onDelete={() => { setContextMenu(null); onDelete?.(room); }}
          onBlock={() => { setContextMenu(null); onBlock?.(room); }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </li>
  );
}

export default function ChatList({ rooms = [], activeId = null, loading = false, currentUserId = null, onDelete, onBlock }) {
  if (loading) {
    return (
      <div className="space-y-2 p-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!rooms.length) {
    return (
      <div className="p-8 text-center text-sm text-neutral-500">
        Нет диалогов. Начните общение со страницы профиля пользователя.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-white/5">
      {rooms.map((room) => (
        <ChatListItem
          key={room.id}
          room={room}
          activeId={activeId}
          currentUserId={currentUserId}
          onDelete={onDelete}
          onBlock={onBlock}
        />
      ))}
    </ul>
  );
}
import { MapPinIcon, ShieldCheckIcon, UsersIcon } from '@heroicons/react/24/solid';
import { formatDate } from '../lib/constants';
import Username from './Username';

function Avatar({ room, peer }) {
  const image = peer?.avatar || room.avatar;
  const label = peer?.username || room.display_title;
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={image}
        alt={label}
        className="h-12 w-12 rounded-full object-cover ring-1 ring-gold/30"
      />
    );
  }
  return (
    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-graphite-light font-display text-base font-bold text-gold ring-1 ring-gold/20">
      {(room.display_title || '#').slice(0, 2).toUpperCase()}
    </div>
  );
}

function ChatListItem({ room, activeId, currentUserId, onDelete }) {
  const [startX, setStartX] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const active = String(room.id) === String(activeId);
  const preview = room.last_message?.content || 'Encrypted message';
  const peer = room.is_group
    ? null
    : room.memberships?.find((member) => String(member.user?.id) !== String(currentUserId))?.user;

  return (
    <li
      onTouchStart={(event) => setStartX(event.touches[0].clientX)}
      onTouchMove={(event) => {
        if (startX === null) return;
        if (startX - event.touches[0].clientX > 50) setRevealed(true);
        if (event.touches[0].clientX - startX > 50) setRevealed(false);
      }}
      onTouchEnd={() => setStartX(null)}
      className="relative overflow-hidden"
    >
      <div className={`absolute inset-y-0 right-0 flex items-center bg-red-600 px-4 transition ${revealed ? 'translate-x-0' : 'translate-x-full'}`}>
        <button type="button" onClick={() => onDelete?.(room)} className="text-sm font-semibold text-white">
          Удалить
        </button>
      </div>
      <Link
        href={`/chats/${room.id}`}
        className={`flex items-center gap-3 px-4 py-3 transition ${active ? 'bg-gold/10' : 'hover:bg-white/5'} ${revealed ? '-translate-x-20' : 'translate-x-0'}`}
      >
        <Avatar room={room} peer={peer} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-white">
              <Username user={peer} username={room.display_title || 'Chat'} />
            </span>
            {room.is_garant_chat && <ShieldCheckIcon className="h-3.5 w-3.5 text-gold" />}
            {room.is_group && <UsersIcon className="h-3.5 w-3.5 text-neutral-500" />}
            {room.is_pinned && <MapPinIcon className="h-3.5 w-3.5 text-gold/70" />}
          </div>
          <p className="truncate text-xs text-neutral-500">{preview}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] text-neutral-600">
            {formatDate(room.last_message?.created_at || room.updated_at)}
          </span>
          {room.unread_count > 0 && (
            <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-gold px-1.5 text-[10px] font-bold text-black">
              {room.unread_count > 99 ? '99+' : room.unread_count}
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}
