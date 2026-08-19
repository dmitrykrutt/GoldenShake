import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Cog6ToothIcon,
  ChatBubbleLeftRightIcon,
  ShieldCheckIcon,
  GiftIcon,
  NoSymbolIcon,
  QrCodeIcon,
} from '@heroicons/react/24/outline';
import Layout from '../../components/Layout';
import HandshakeBadge from '../../components/HandshakeBadge';
import Username from '../../components/Username';
import CoinDonation from '../../components/CoinDonation';
import api, { apiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';

export default function ProfilePage() {
  const router = useRouter();
  const { username } = router.query;
  const { user: currentUser } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDonation, setShowDonation] = useState(false);
  const [balances, setBalances] = useState({});

  const isOwn = currentUser && username && currentUser.username.toLowerCase() === username.toLowerCase();

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    setError('');

    api
      .get(`/accounts/profiles/${username}/`)
      .then(({ data }) => setProfile(data))
      .catch((err) => setError(apiError(err, 'Пользователь не найден')))
      .finally(() => setLoading(false));

    if (currentUser) {
      api.get('/coins/balance/').then(({ data }) => setBalances(data.balances || {})).catch(() => {});
    }
  }, [username, currentUser]);

  const startChat = async () => {
    try {
      const { data } = await api.post('/chat/rooms/', {
        participant_usernames: [profile.username],
      });
      router.push(`/chats/${data.id}`);
    } catch (err) {
      setError(apiError(err, 'Не удалось открыть диалог'));
    }
  };

  const blockUser = async () => {
    if (!window.confirm(`Заблокировать пользователя @${profile.username}?`)) return;
    try {
      await api.post(`/accounts/profiles/block/${encodeURIComponent(profile.username)}/`);
      router.push('/chats');
    } catch (err) {
      setError(apiError(err, 'Ошибка блокировки'));
    }
  };

  if (loading) {
    return (
      <Layout title="Загрузка профиля…">
        <div className="mx-auto max-w-md space-y-4 pt-10">
          <div className="skeleton h-32 w-full rounded-3xl" />
          <div className="skeleton h-24 w-full rounded-2xl" />
        </div>
      </Layout>
    );
  }

  if (error || !profile) {
    return (
      <Layout title="Профиль не найден">
        <div className="mx-auto max-w-md text-center pt-16">
          <p className="text-sm text-red-400">{error || 'Пользователь не найден'}</p>
          <button type="button" onClick={() => router.back()} className="btn-dark mt-4 text-xs">
            Вернуться назад
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={`@${profile.username}`}>
      <div className="mx-auto max-w-xl pb-16">
        {/* Шапка профиля */}
        <div className="card relative overflow-hidden p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {profile.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar}
                  alt=""
                  className="h-20 w-20 rounded-full object-cover ring-2 ring-gold/40 shadow-xl"
                />
              ) : (
                <div className="grid h-20 w-20 place-items-center rounded-full bg-graphite font-display text-2xl font-bold text-gold ring-2 ring-gold/30">
                  {profile.username.slice(0, 2).toUpperCase()}
                </div>
              )}

              <div>
                <h1 className="text-xl font-display font-bold text-white flex items-center gap-2">
                  <Username user={profile} />
                </h1>
                <p className="text-xs text-neutral-500">@{profile.username}</p>
                {profile.handshake_level && (
                  <div className="mt-2">
                    <HandshakeBadge level={profile.handshake_level} size="sm" />
                  </div>
                )}
              </div>
            </div>

            {/* Кнопка настроек для владельца профиля */}
            {isOwn && (
              <Link
                href="/settings"
                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-neutral-300 hover:border-gold/40 hover:text-gold transition"
              >
                <Cog6ToothIcon className="h-4 w-4" />
                <span>Настройки</span>
              </Link>
            )}
          </div>

          {profile.bio && (
            <p className="mt-5 text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap border-t border-white/5 pt-4">
              {profile.bio}
            </p>
          )}

          {/* Кнопки действий с собеседником */}
          {!isOwn && (
            <div className="mt-6 flex flex-wrap gap-2.5 border-t border-white/5 pt-4">
              <button
                type="button"
                onClick={startChat}
                className="btn-primary flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <ChatBubbleLeftRightIcon className="h-4 w-4" /> Написать
              </button>

              <button
                type="button"
                onClick={() => setShowDonation(true)}
                className="btn-dark py-2.5 px-4 text-xs font-semibold flex items-center gap-1.5 text-gold hover:text-gold"
              >
                <GiftIcon className="h-4 w-4" /> Донат
              </button>

              <button
                type="button"
                onClick={blockUser}
                className="rounded-xl border border-red-500/20 bg-red-500/10 p-2.5 text-red-400 hover:bg-red-500/20 transition"
                title="Заблокировать"
              >
                <NoSymbolIcon className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Дополнительная статистика */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="card p-4 text-center">
            <ShieldCheckIcon className="mx-auto h-5 w-5 text-gold mb-1" />
            <p className="text-xs text-neutral-500 font-semibold">Гарант-сделки</p>
            <p className="text-lg font-bold text-white mt-0.5">{profile.deals_count || 0}</p>
          </div>
          <div className="card p-4 text-center">
            <QrCodeIcon className="mx-auto h-5 w-5 text-gold mb-1" />
            <p className="text-xs text-neutral-500 font-semibold">Репутация</p>
            <p className="text-lg font-bold text-emerald-400 mt-0.5">{profile.reputation || '100%'}</p>
          </div>
        </div>

        {showDonation && (
          <CoinDonation
            recipientUsername={profile.username}
            balances={balances}
            onClose={() => setShowDonation(false)}
          />
        )}
      </div>
    </Layout>
  );
}
