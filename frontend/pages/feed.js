import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  HeartIcon,
  PhotoIcon,
  PaperAirplaneIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';
import Layout from '../components/Layout';
import Username from '../components/Username';
import api, { apiError } from '../lib/api';
import { useRequireAuth } from '../lib/auth';
import { formatDate } from '../lib/constants';

export default function FeedPage() {
  const { user } = useRequireAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPostText, setNewPostText] = useState('');
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');

  const fileInputRef = useRef(null);

  const loadFeed = useCallback(async () => {
    try {
      const { data } = await api.get('/social/posts/');
      setPosts(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      setError(apiError(err, 'Не удалось загрузить ленту.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadFeed();
  }, [user, loadFeed]);

  const handleMediaSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedMedia(file);
    setMediaPreview(URL.createObjectURL(file));
  };

  const clearMedia = () => {
    setSelectedMedia(null);
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPostText.trim() && !selectedMedia) return;

    setPublishing(true);
    setError('');

    try {
      const formData = new FormData();
      if (newPostText.trim()) formData.append('content', newPostText.trim());
      if (selectedMedia) formData.append('media', selectedMedia);

      const { data } = await api.post('/social/posts/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setPosts((prev) => [data, ...prev]);
      setNewPostText('');
      clearMedia();
    } catch (err) {
      setError(apiError(err, 'Не удалось опубликовать запись.'));
    } finally {
      setPublishing(false);
    }
  };

  const toggleLike = async (postId) => {
    try {
      const { data } = await api.post(`/social/posts/${postId}/like/`);
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? { ...post, is_liked: data.is_liked, likes_count: data.likes_count }
            : post
        )
      );
    } catch (_) {}
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Удалить эту публикацию?')) return;
    try {
      await api.delete(`/social/posts/${postId}/`);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err) {
      alert(apiError(err, 'Не удалось удалить публикацию.'));
    }
  };

  return (
    <Layout title="Лента">
      <div className="mx-auto max-w-xl pb-20 pt-2">
        <h1 className="text-2xl font-display font-bold text-white mb-5">Лента</h1>

        {/* Форма создания публикации */}
        <div className="card mb-6 p-4">
          <form onSubmit={handleCreatePost}>
            <div className="flex gap-3 items-start">
              {user?.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatar} alt="" className="h-10 w-10 rounded-full object-cover ring-1 ring-gold/30 shrink-0" />
              ) : (
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-graphite font-display text-xs font-bold text-gold ring-1 ring-gold/20">
                  {user?.username?.slice(0, 2).toUpperCase() || 'GS'}
                </div>
              )}
              <textarea
                value={newPostText}
                onChange={(e) => setNewPostText(e.target.value)}
                placeholder="Поделитесь мыслями или новостями…"
                rows={2}
                className="input flex-1 resize-none bg-black/40 text-sm py-2 px-3 leading-relaxed"
              />
            </div>

            {/* Превью выбранного фото/видео */}
            {mediaPreview && (
              <div className="relative mt-3 inline-block overflow-hidden rounded-xl border border-white/10">
                {selectedMedia?.type.startsWith('video/') ? (
                  <video src={mediaPreview} className="max-h-56 rounded-xl object-cover" controls />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaPreview} alt="" className="max-h-56 rounded-xl object-cover" />
                )}
                <button
                  type="button"
                  onClick={clearMedia}
                  className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/80 text-white hover:bg-red-600 transition"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            )}

            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

            <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleMediaSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-gold transition font-medium"
              >
                <PhotoIcon className="h-5 w-5 text-gold" /> Прикрепить медиа
              </button>

              <button
                type="submit"
                disabled={publishing || (!newPostText.trim() && !selectedMedia)}
                className="btn-primary py-1.5 px-4 text-xs font-bold flex items-center gap-1.5 shadow-gold"
              >
                <PaperAirplaneIcon className="h-3.5 w-3.5" />
                {publishing ? 'Публикация…' : 'Опубликовать'}
              </button>
            </div>
          </form>
        </div>

        {/* Список реальных публикаций */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card h-36 skeleton" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="card p-10 text-center text-neutral-500">
            <p className="text-sm">В ленте пока нет публикаций.</p>
            <p className="text-xs mt-1 text-neutral-600">Будьте первым, кто опубликует пост!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <div key={post.id} className="card p-4 transition hover:border-white/15">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Link href={`/profile/${post.author?.username}`}>
                      {post.author?.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={post.author.avatar} alt="" className="h-10 w-10 rounded-full object-cover ring-1 ring-gold/30 shrink-0" />
                      ) : (
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-graphite font-display text-xs font-bold text-gold ring-1 ring-gold/20">
                          {post.author?.username?.slice(0, 2).toUpperCase() || 'GS'}
                        </div>
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link href={`/profile/${post.author?.username}`} className="truncate font-semibold text-sm text-white hover:text-gold block leading-tight">
                        <Username user={post.author} username={post.author?.username} />
                      </Link>
                      <p className="text-[11px] text-neutral-500 leading-tight mt-0.5">{formatDate(post.created_at)}</p>
                    </div>
                  </div>

                  {user && String(post.author?.id) === String(user.id) && (
                    <button
                      type="button"
                      onClick={() => handleDeletePost(post.id)}
                      className="text-neutral-500 hover:text-red-400 transition p-1"
                      title="Удалить"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {post.content && (
                  <p className="mt-3 text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap">
                    {post.content}
                  </p>
                )}

                {post.media && (
                  <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black">
                    {post.media_type === 'video' ? (
                      <video src={post.media} controls className="max-h-96 w-full object-contain" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.media} alt="" className="max-h-96 w-full object-contain" />
                    )}
                  </div>
                )}

                <div className="mt-4 flex items-center gap-4 border-t border-white/5 pt-3 text-neutral-400">
                  <button
                    type="button"
                    onClick={() => toggleLike(post.id)}
                    className={`flex items-center gap-1.5 text-xs font-semibold transition active:scale-90 ${
                      post.is_liked ? 'text-red-500' : 'hover:text-red-400'
                    }`}
                  >
                    {post.is_liked ? <HeartSolid className="h-5 w-5" /> : <HeartIcon className="h-5 w-5" />}
                    <span>{post.likes_count || 0}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
