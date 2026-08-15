import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import {
  ChatBubbleLeftRightIcon,
  GiftIcon,
  HeartIcon,
  LinkIcon,
  LockClosedIcon,
  PaperClipIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';
import Layout from '../../components/Layout';
import HandshakeBadge from '../../components/HandshakeBadge';
import CoinDonation from '../../components/CoinDonation';
import Username from '../../components/Username';
import MediaViewer from '../../components/MediaViewer';
import api, { apiError } from '../../lib/api';
import { useRequireAuth } from '../../lib/auth';
import { formatDateTime } from '../../lib/constants';
import { resolveTheme } from '../../lib/themes';

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
  const [blocked, setBlocked] = useState(false);
  const [attachFiles, setAttachFiles] = useState([]);
  const [attachError, setAttachError] = useState('');
  const [lightboxItems, setLightboxItems] = useState(null);
  const fileInputRef = useRef(null);

  const isSelf = user && profile && user.username === profile.username;

  const load = useCallback(async () => {
    if (!username) return;
    try {
      const [{ data }, blockedRes] = await Promise.all([
        api.get(`/accounts/profiles/${username}/`),
        api.get('/accounts/profiles/blocked/'),
      ]);
      setProfile(data);
      const blockedUsers = Array.isArray(blockedRes.data) ? blockedRes.data : [];
      setBlocked(blockedUsers.some((item) => item.blocked?.username === username));
      if (!data.private_profile || data.username === user?.username) {
        const postsRes = await api.get(`/posts/posts/?author=${username}`);
        setPosts(
          Array.isArray(postsRes.data) ? postsRes.data : postsRes.data.results || []
        );
      }
    } catch (err) {
      setError(apiError(err, 'Профиль не найден.'));
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
      setError(apiError(err, 'Не удалось открыть чат.'));
    }
  };

  const publish = async (event) => {
    event.preventDefault();
    if (!newPost.trim() && attachFiles.length === 0) return;
    try {
      let data;
      if (attachFiles.length > 0) {
        const formData = new FormData();
        formData.append('content', newPost.trim());
        attachFiles.forEach((f) => formData.append('attachments', f));
        const res = await api.post('/posts/posts/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        data = res.data;
      } else {
        const res = await api.post('/posts/posts/', { content: newPost.trim() });
        data = res.data;
      }
      setPosts((prev) => [data, ...prev]);
      setNewPost('');
      setAttachFiles([]);
    } catch (err) {
      setError(apiError(err, 'Не удалось опубликовать запись.'));
    }
  };

  const handleFileChange = (e) => {
    setAttachError('');
    const selected = Array.from(e.target.files || []);
    const combined = [...attachFiles, ...selected];
    if (combined.length > 5) {
      setAttachError('Максимум 5 файлов на публикацию.');
      return;
    }
    const totalSize = combined.reduce((acc, f) => acc + f.size, 0);
    if (totalSize > 100 * 1024 * 1024) {
      setAttachError('Общий размер файлов не должен превышать 100 МБ.');
      return;
    }
    setAttachFiles(combined);
    e.target.value = '';
  };

  const removeAttachFile = (index) => {
    setAttachFiles((prev) => prev.filter((_, i) => i !== index));
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
      setError(apiError(err, 'Не удалось поставить лайк.'));
    }
  };

  const toggleBlock = async () => {
    try {
      if (blocked) {
        await api.delete(`/accounts/profiles/block/${profile.username}/`);
        setBlocked(false);
      } else {
        const confirmed = window.confirm(`Заблокировать @${profile.username}?`);
        if (!confirmed) return;
        await api.post(`/accounts/profiles/block/${profile.username}/`);
        setBlocked(true);
      }
    } catch (err) {
      setError(apiError(err, 'Не удалось обновить блокировку.'));
    }
  };

  if (!profile) {
    return (
      <Layout title="Профиль">
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
        style={{ borderColor: `${theme.primary}55`, background: `linear-gradient(180deg, ${theme.bg}, rgba(0,0,0,0.75))`, color: theme.primary }}
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
              <h1 className="text-2xl"><Username user={profile} withAt /></h1>
              <HandshakeBadge level={profile.handshake_level || 'green'} showLabel={false} />
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
                <ChatBubbleLeftRightIcon className="h-4 w-4" /> Сообщение
              </button>
              <button
                type="button"
                onClick={() => setShowDonation(true)}
                className="btn-ghost"
                style={{ borderColor: `${theme.primary}55`, color: theme.primary }}
              >
                <GiftIcon className="h-4 w-4" /> Донат
              </button>
              <button
                type="button"
                onClick={toggleBlock}
                className={`rounded-xl border px-4 py-3 text-sm font-semibold ${blocked ? 'border-emerald-500/40 text-emerald-300' : 'border-red-500/40 text-red-300'}`}
              >
                {blocked ? 'Разблокировать' : 'Заблокировать'}
              </button>
            </div>
          )}
        </div>
      </div>

      {error && <p className="mt-4 text-xs text-red-400">{error}</p>}

      {isSelf && (
        <form onSubmit={publish} className="card mt-6">
          <label className="label" htmlFor="post-body">
            Новая запись
          </label>
          <textarea
            id="post-body"
            rows={3}
            className="input resize-none"
            value={newPost}
            onChange={(event) => setNewPost(event.target.value)}
            placeholder="Что у вас нового?"
          />
          {attachFiles.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {attachFiles.map((f, i) => {
                const isImage = f.type.startsWith('image/');
                const isVideo = f.type.startsWith('video/');
                const url = URL.createObjectURL(f);
                return (
                  <div key={i} className="relative rounded-lg overflow-hidden border border-white/10 bg-black/30">
                    {isImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt={f.name} className="h-24 w-full object-cover" />
                    )}
                    {isVideo && (
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <video src={url} className="h-24 w-full object-cover" />
                    )}
                    {!isImage && !isVideo && (
                      <div className="flex h-24 items-center justify-center p-2 text-xs text-neutral-400 text-center break-all">
                        {f.name}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeAttachFile(i)}
                      className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {attachError && <p className="mt-2 text-xs text-red-400">{attachError}</p>}
          <div className="mt-3 flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-dark flex items-center gap-1.5 text-sm"
              title="Прикрепить файл"
            >
              <PaperClipIcon className="h-4 w-4" />
              Прикрепить
            </button>
            <button type="submit" className="btn-primary ml-auto">
              Опубликовать
            </button>
          </div>
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
            {post.attachments?.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {post.attachments.map((att, i) => {
                  if (att.file_type === 'image') {
                    return (
                      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
                      <img
                        key={att.id}
                        src={att.file}
                        alt=""
                        className="max-h-96 w-full rounded-xl border border-white/10 object-cover cursor-pointer"
                        onClick={() =>
                          setLightboxItems(
                            post.attachments
                              .filter((a) => a.file_type === 'image')
                              .map((a) => ({ type: 'image', src: a.file }))
                          )
                        }
                      />
                    );
                  }
                  if (att.file_type === 'video') {
                    return (
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <video
                        key={att.id}
                        src={att.file}
                        controls
                        className="max-h-96 w-full rounded-xl border border-white/10 object-cover"
                      />
                    );
                  }
                  return (
                    <a
                      key={att.id}
                      href={att.file}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-neutral-300 hover:text-gold"
                    >
                      <PaperClipIcon className="h-4 w-4 flex-shrink-0" />
                      {att.file.split('/').pop()}
                    </a>
                  );
                })}
              </div>
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
              <span>{post.comment_count} комментариев</span>
              <span>{post.share_count} репостов</span>
            </div>
          </article>
        ))}
        {!posts.length && !profile.private_profile && (
          <p className="py-10 text-center text-sm text-neutral-600">Записей пока нет.</p>
        )}
        {profile.private_profile && !isSelf && (
          <p className="py-10 text-center text-sm text-neutral-600">
            Этот профиль приватный.
          </p>
        )}
      </div>

      {lightboxItems && (
        <MediaViewer items={lightboxItems} onClose={() => setLightboxItems(null)} />
      )}

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
