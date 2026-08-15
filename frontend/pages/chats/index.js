import { useCallback, useEffect, useMemo, useState } from 'react';
import { MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline';
import Layout from '../../components/Layout';
import ChatList from '../../components/ChatList';
import api, { apiError } from '../../lib/api';
import { useRequireAuth } from '../../lib/auth';

export default function ChatsPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [error, setError] = useState('');
  const [createError, setCreateError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [blockOnDelete, setBlockOnDelete] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/chat/rooms/');
      setRooms(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      setError(apiError(err, 'Could not load chats.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter((room) =>
      (room.display_title || '').toLowerCase().includes(q)
    );
  }, [rooms, query]);

  const createChat = async (event) => {
    event.preventDefault();
    setCreateError('');
    try {
      const username = newUsername.replace('@', '').trim();
      // Check if the user exists first; surface a friendly 404 message.
      try {
        await api.get(`/accounts/profiles/${encodeURIComponent(username)}/`);
      } catch (lookupErr) {
        if (lookupErr?.response?.status === 404) {
          setCreateError('Пользователь не найден');
          return;
        }
      }
      const { data } = await api.post('/chat/rooms/', {
        participant_usernames: [username],
      });
      setCreating(false);
      setNewUsername('');
      setCreateError('');
      setRooms((prev) => [data, ...prev.filter((r) => r.id !== data.id)]);
    } catch (err) {
      setCreateError(apiError(err, 'Could not start the chat.'));
    }
  };

  const handleDeleteChat = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/chat/rooms/${deleteTarget.id}/`);
      if (blockOnDelete && deleteTarget.peer?.username) {
        await api.post(`/accounts/profiles/block/${encodeURIComponent(deleteTarget.peer.username)}/`);
      }
      setRooms((prev) => prev.filter((room) => room.id !== deleteTarget.id));
      setDeleteTarget(null);
      setBlockOnDelete(false);
    } catch (err) {
      setError(apiError(err, 'Не удалось удалить чат.'));
    }
  };

  const handleBlockUser = async (room) => {
    const peer = room.memberships?.find((member) => String(member.user?.id) !== String(user?.id))?.user;
    if (!peer?.username) return;
    try {
      await api.post(`/accounts/profiles/block/${encodeURIComponent(peer.username)}/`);
    } catch (err) {
      setError(apiError(err, 'Не удалось заблокировать пользователя.'));
    }
  };

  return (
    <Layout title="Чаты">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl">Чаты</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Все переписки зашифрованы.
          </p>
        </div>
        <button type="button" onClick={() => setCreating(true)} className="btn-primary">
          <PlusIcon className="h-4 w-4" /> Новый чат
        </button>
      </div>

      <div className="relative mb-4">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-600" />
        <input
          className="input pl-11"
          placeholder="Поиск переписок"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {error && <p className="mb-4 text-xs text-red-400">{error}</p>}

      <div className="card overflow-hidden p-0">
        <ChatList
          rooms={filtered}
          loading={authLoading || loading}
          currentUserId={user?.id}
          onDelete={(room) =>
            setDeleteTarget({
              ...room,
              peer: room.memberships?.find((member) => String(member.user?.id) !== String(user?.id))?.user,
            })
          }
          onBlock={handleBlockUser}
        />
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <form onSubmit={createChat} className="w-full max-w-sm rounded-2xl glass-gold p-6">
            <h2 className="font-display text-xl">Начать переписку</h2>
            <label className="label mt-5" htmlFor="new-username">
              Имя пользователя
            </label>
            <input
              id="new-username"
              required
              className="input"
              value={newUsername}
              onChange={(event) => { setNewUsername(event.target.value); setCreateError(''); }}
              placeholder="@nikolai"
            />
            {createError && (
              <p className="mt-2 text-xs text-red-400">{createError}</p>
            )}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                className="btn-dark flex-1"
                onClick={() => { setCreating(false); setCreateError(''); }}
              >
                Отмена
              </button>
              <button type="submit" className="btn-primary flex-1">
                Начать
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl glass-gold p-6">
            <h2 className="font-display text-xl">Удалить чат?</h2>
            <p className="mt-3 text-sm text-neutral-300">
              Вы уверены что хотите удалить чат с @{deleteTarget.peer?.username || deleteTarget.display_title}? Это действие нельзя отменить.
            </p>
            <label className="mt-5 flex items-center gap-3 text-sm text-neutral-300">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#C9A84C]"
                checked={blockOnDelete}
                onChange={(event) => setBlockOnDelete(event.target.checked)}
              />
              Заблокировать пользователя
            </label>
            <div className="mt-6 flex gap-3">
              <button type="button" className="btn-dark flex-1" onClick={() => { setDeleteTarget(null); setBlockOnDelete(false); }}>
                Отмена
              </button>
              <button type="button" className="flex-1 rounded-xl bg-red-600 px-4 py-3 font-semibold text-white" onClick={handleDeleteChat}>
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
