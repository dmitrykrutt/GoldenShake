import Link from 'next/link';
import { MapPinIcon, ShieldCheckIcon, UsersIcon } from '@heroicons/react/24/solid';
import VerificationBadge from './VerificationBadge';
import { formatDate } from '../lib/constants';

function Avatar({ room }) {
  if (room.avatar) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={room.avatar}
        alt={room.display_title}
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

export default function ChatList({ rooms = [], activeId = null, loading = false }) {
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
        No conversations yet. Start one from a profile page.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-white/5">
      {rooms.map((room) => {
        const active = String(room.id) === String(activeId);
        const preview = room.last_message?.content || 'Encrypted message';
        return (
          <li key={room.id}>
            <Link
              href={`/chats/${room.id}`}
              className={`flex items-center gap-3 px-4 py-3 transition ${
                active ? 'bg-gold/10' : 'hover:bg-white/5'
              }`}
            >
              <Avatar room={room} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold text-white">
                    {room.display_title || 'Chat'}
                  </span>
                  {room.is_garant_chat && <ShieldCheckIcon className="h-3.5 w-3.5 text-gold" />}
                  {room.is_group && <UsersIcon className="h-3.5 w-3.5 text-neutral-500" />}
                  {room.is_pinned && <MapPinIcon className="h-3.5 w-3.5 text-gold/70" />}
                  <VerificationBadge verified={room.is_verified_peer} size={12} />
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
      })}
    </ul>
  );
}
