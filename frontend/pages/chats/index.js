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
    setError('');
    try {
      const { data } = await api.post('/chat/rooms/', {
        participant_usernames: [newUsername.replace('@', '').trim()],
      });
      setCreating(false);
      setNewUsername('');
      setRooms((prev) => [data, ...prev.filter((r) => r.id !== data.id)]);
    } catch (err) {
      setError(apiError(err, 'Could not start the chat.'));
    }
  };

  return (
    <Layout title="Chats">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl">Chats</h1>
          <p className="mt-1 text-sm text-neutral-500">
            All conversations are end-to-end encrypted.
          </p>
        </div>
        <button type="button" onClick={() => setCreating(true)} className="btn-primary">
          <PlusIcon className="h-4 w-4" /> New chat
        </button>
      </div>

      <div className="relative mb-4">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-600" />
        <input
          className="input pl-11"
          placeholder="Search conversations"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {error && <p className="mb-4 text-xs text-red-400">{error}</p>}

      <div className="card overflow-hidden p-0">
        <ChatList rooms={filtered} loading={authLoading || loading} />
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <form onSubmit={createChat} className="w-full max-w-sm rounded-2xl glass-gold p-6">
            <h2 className="font-display text-xl">Start a conversation</h2>
            <label className="label mt-5" htmlFor="new-username">
              Username
            </label>
            <input
              id="new-username"
              required
              className="input"
              value={newUsername}
              onChange={(event) => setNewUsername(event.target.value)}
              placeholder="@nikolai"
            />
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                className="btn-dark flex-1"
                onClick={() => setCreating(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary flex-1">
                Start
              </button>
            </div>
          </form>
        </div>
      )}
    </Layout>
  );
}
