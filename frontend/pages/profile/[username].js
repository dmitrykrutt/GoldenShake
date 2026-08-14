import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  ChatBubbleLeftRightIcon,
  GiftIcon,
  HeartIcon,
  LinkIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';
import Layout from '../../components/Layout';
import HandshakeBadge from '../../components/HandshakeBadge';
import VerificationBadge from '../../components/VerificationBadge';
import CoinDonation from '../../components/CoinDonation';
import api, { apiError } from '../../lib/api';
import { useRequireAuth } from '../../lib/auth';
import { formatDateTime } from '../../lib/constants';

const THEMES = [
  { id: 'midnight', primary: '#6C63FF', accent: '#FF6584', bg: '#0D0D1A' },
  { id: 'golden', primary: '#F5A623', accent: '#F76B1C', bg: '#1A1200' },
  { id: 'emerald', primary: '#00C896', accent: '#00E5FF', bg: '#001A12' },
  { id: 'crimson', primary: '#E63946', accent: '#FF6B6B', bg: '#1A0005' },
  { id: 'ocean', primary: '#0077B6', accent: '#00B4D8', bg: '#00080F' },
  { id: 'sakura', primary: '#FF85A1', accent: '#FFC2D1', bg: '#1A0010' },
  { id: 'graphite', primary: '#9E9E9E', accent: '#E0E0E0', bg: '#111111' },
  { id: 'aurora', primary: '#7B2FBE', accent: '#00F5D4', bg: '#080318' },
];

function resolveTheme(themeId) {
  return THEMES.find((t) => t.id === themeId) || THEMES[0];
}

export default function ProfilePage() {
  const router = useRouter();
  const { username } = router.query;
  const { user } = useRequireAuth();

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [balances, setBalances] = useState({});
  const [showDonation, setShowDonation] = useState(false);
  const [newPost, setNewPost] = useState('');
  const [error, setError] = useState('');

  const isSelf = user && profile && user.username === profile.username;

  const load = useCallback(async () => {
    if (!username) return;
    try {
      const { data } = await api.get(`/accounts/profiles/${username}/`);
      setProfile(data);
      if (!data.private_profile || data.username === user?.username) {
        const postsRes = await api.get(`/posts/posts/?author=${username}`);
        setPosts(
          Array.isArray(postsRes.data) ? postsRes.data : postsRes.data.results || []
        );
      }
    } catch (err) {
      setError(apiError(err, 'Profile not found.'));
    }
  }, [username, user?.username]);

  useEffect(() => {
    if (user) {
      load();
      api.get('/coins/balance/').then(({ data }) => setBalances(data.balances || {}));
    }
  }, [user, load]);

  const startChat = async () => {
    try {
      const { data } = await api.post('/chat/rooms/', {
        participant_usernames: [profile.username],
      });
      router.push(`/chats/${data.id}`);
    } catch (err) {
      setError(apiError(err, 'Could not open a chat.'));
    }
  };

  const publish = async (event) => {
    event.preventDefault();
    if (!newPost.trim()) return;
    try {
      const { data } = await api.post('/posts/posts/', { content: newPost.trim() });
      setPosts((prev) => [data, ...prev]);
      setNewPost('');
    } catch (err) {
      setError(apiError(err, 'Could not publish the post.'));
    }
  };

  const toggleLike = async (post) => {
    try {
      await api.post(`/posts/posts/${post.id}/like/`);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                is_liked: !p.is_liked,
                like_count: p.like_count + (p.is_liked ? -1 : 1),
              }
            : p
        )
      );
    } catch (err) {
      setError(apiError(err, 'Could not like this post.'));
    }
  };

  if (!profile) {
    return (
      <Layout title="Profile">
        {error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : (
          <div className="skeleton h-48 w-full" />
        )}
      </Layout>
    );
  }

  const theme = resolveTheme(profile.theme_color);

  return (
    <Layout title={`@${profile.username}`}>
      <div
        className="card relative overflow-hidden"
        style={{ borderColor: `${theme.primary}55` }}
      >
        <div
          className="absolute inset-x-0 top-0 h-24 opacity-20"
          style={{
            background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent}, transparent)`,
          }}
        />
        <div className="relative flex flex-wrap items-start gap-5">
          {profile.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar}
              alt={profile.username}
              className="h-24 w-24 rounded-2xl object-cover ring-2 ring-gold/40"
            />
          ) : (
            <div className="grid h-24 w-24 place-items-center rounded-2xl bg-graphite-light font-display text-3xl text-gold ring-2 ring-gold/20">
              {profile.username.slice(0, 2).toUpperCase()}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl">@{profile.username}</h1>
              <VerificationBadge verified={profile.is_verified} size={20} />
              <HandshakeBadge level={profile.handshake_level || 'green'} />
              {profile.private_profile && (
                <span className="badge border border-white/10 bg-black/40 px-2 py-0.5 text-neutral-400">
                  <LockClosedIcon className="h-3 w-3" /> Private
                </span>
              )}
            </div>

            {profile.bio && (
              <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm text-neutral-300">
                {profile.bio}
              </p>
            )}

            {profile.social_links && Object.keys(profile.social_links).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(profile.social_links).map(([label, url]) => (
                  <a
                    key={label}
                    href={String(url)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="badge border border-gold/25 bg-gold/10 px-2.5 py-1 text-gold hover:bg-gold/20"
                  >
                    <LinkIcon className="h-3 w-3" /> {label}
                  </a>
                ))}
              </div>
            )}

            <p className="mt-3 text-[11px] text-neutral-600">
              Joined {formatDateTime(profile.date_joined)}
              {profile.is_online ? ' · online now' : ''}
            </p>
          </div>

          {!isSelf && (
            <div className="flex flex-col gap-2">
              <button type="button" onClick={startChat} className="btn-primary">
                <ChatBubbleLeftRightIcon className="h-4 w-4" /> Message
              </button>
              <button
                type="button"
                onClick={() => setShowDonation(true)}
                className="btn-ghost"
              >
                <GiftIcon className="h-4 w-4" /> Donate
              </button>
            </div>
          )}
        </div>
      </div>

      {error && <p className="mt-4 text-xs text-red-400">{error}</p>}

      {isSelf && (
        <form onSubmit={publish} className="card mt-6">
          <label className="label" htmlFor="post-body">
            Share an update
          </label>
          <textarea
            id="post-body"
            rows={3}
            className="input resize-none"
            value={newPost}
            onChange={(event) => setNewPost(event.target.value)}
            placeholder="What's on your mind?"
          />
          <button type="submit" className="btn-primary mt-3">
            Publish
          </button>
        </form>
      )}

      <div className="mt-6 space-y-4">
        {posts.map((post) => (
          <article key={post.id} className="card">
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <span className="font-medium text-gold">@{post.author?.username}</span>
              <span>·</span>
              <span>{formatDateTime(post.created_at)}</span>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-200">{post.content}</p>
            {post.media && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.media}
                alt=""
                className="mt-3 max-h-96 rounded-xl border border-white/10 object-cover"
              />
            )}
            <div className="mt-4 flex items-center gap-5 text-xs text-neutral-500">
              <button
                type="button"
                onClick={() => toggleLike(post)}
                className="flex items-center gap-1.5 hover:text-gold"
              >
                {post.is_liked ? (
                  <HeartSolid className="h-4 w-4 text-gold" />
                ) : (
                  <HeartIcon className="h-4 w-4" />
                )}
                {post.like_count}
              </button>
              <span>{post.comment_count} comments</span>
              <span>{post.share_count} shares</span>
            </div>
          </article>
        ))}
        {!posts.length && !profile.private_profile && (
          <p className="py-10 text-center text-sm text-neutral-600">No posts yet.</p>
        )}
        {profile.private_profile && !isSelf && (
          <p className="py-10 text-center text-sm text-neutral-600">
            This profile is private.
          </p>
        )}
      </div>

      {showDonation && (
        <CoinDonation
          recipientUsername={profile.username}
          balances={balances}
          onClose={() => setShowDonation(false)}
          onDone={() =>
            api.get('/coins/balance/').then(({ data }) => setBalances(data.balances))
          }
        />
      )}
    </Layout>
  );
}
