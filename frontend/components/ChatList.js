import Link from 'next/link';
import {
  MapPinIcon,
  ShieldCheckIcon,
  UsersIcon,
  TrashIcon,
  NoSymbolIcon,
} from '@heroicons/react/24/solid';
import { formatDate } from '../lib/constants';
import Username from './Username';

function Avatar({ room, peer }) {
  const image = peer?.avatar || room?.avatar;
  const label = peer?.username || room?.display_title || '?';
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={label}
        className="h-12 w-12 rounded-full object-cover ring-1 ring-gold/30 shrink-0"
      />
    );
  }
  return (
    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-graphite font-display text-base font-bold text-gold ring-1 ring-gold/20">
      {(room?.display_title || '#').slice(0, 2).toUpperCase()}
    </div>
  );
}

function ChatListItem({ room, activeId, currentUserId, onDelete, onBlock }) {
  const active = String(room?.id) === String(activeId);
  const preview = room?.last_message?.content || (room?.last_message?.message_type ? 'Медиа сообщение' : 'Диалог зашифрован');
  const peer = room?.is_group
    ? null
    : room?.memberships?.find((member) => String(member.user?.id) !== String(currentUserId))?.user;

  const handleDelete = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete?.(room);
  };

  const handleBlock = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onBlock?.(room);
  };

  return (
    <li>
      <Link
        href={`/chats/${room.id}`}
        className={`group flex items-center gap-3 px-4 py-3.5 transition ${active ? 'bg-gold/10' : 'hover:bg-white/5'}`}
      >
        <Avatar room={room} peer={peer} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-white">
              <Username user={peer} username={room.display_title || 'Чат'} />
            </span>
            {room.is_garant_chat && <ShieldCheckIcon className="h-3.5 w-3.5 text-gold shrink-0" />}
            {room.is_group && <UsersIcon className="h-3.5 w-3.5 text-neutral-500 shrink-0" />}
            {room.is_pinned && <MapPinIcon className="h-3.5 w-3.5 text-gold/70 shrink-0" />}
          </div>
          <p className="truncate text-xs text-neutral-500 mt-0.5">{preview}</p>
        </div>

        {/* Кнопки быстрых действий */}
        <div className="flex items-center gap-1.5 shrink-0">
          {!room.is_group && peer && (
            <button
              type="button"
              onClick={handleBlock}
              title="Заблокировать пользователя"
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/25 transition opacity-80 group-hover:opacity-100"
            >
              <NoSymbolIcon className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={handleDelete}
            title="Удалить чат"
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/25 transition opacity-80 group-hover:opacity-100"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Время и непрочитанные */}
        <div className="flex flex-col items-end gap-1 shrink-0 ml-1">
          <span className="text-[10px] text-neutral-500 font-medium">
            {formatDate(room.last_message?.created_at || room.updated_at)}
          </span>
          {room.unread_count > 0 && (
            <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-gold px-1.5 text-[10px] font-bold text-black shadow-gold">
              {room.unread_count > 99 ? '99+' : room.unread_count}
            </span>
          )}
        </div>
      </Link>
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
