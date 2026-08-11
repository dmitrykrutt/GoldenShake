import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  ArrowLeftIcon,
  GiftIcon,
  MapPinIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
  PhoneIcon,
  VideoCameraIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import Layout from '../../components/Layout';
import MessageBubble from '../../components/MessageBubble';
import CoinDonation from '../../components/CoinDonation';
import VerificationBadge from '../../components/VerificationBadge';
import api, { API_URL, apiError, tokens } from '../../lib/api';
import { connect } from '../../lib/ws';
import { useRequireAuth } from '../../lib/auth';

export default function ChatRoomPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useRequireAuth();

  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [balances, setBalances] = useState({});
  const [showDonation, setShowDonation] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const typingTimer = useRef(null);

  const peer = room?.memberships?.find((m) => m.user?.id !== user?.id)?.user;

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!id || !user) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const [roomRes, messagesRes, balanceRes] = await Promise.all([
          api.get(`/chat/rooms/${id}/`),
          api.get(`/chat/rooms/${id}/messages/`),
          api.get('/coins/balance/'),
        ]);
        if (cancelled) return;
        setRoom(roomRes.data);
        const list = Array.isArray(messagesRes.data)
          ? messagesRes.data
          : messagesRes.data.results || [];
        setMessages([...list].reverse());
        setBalances(balanceRes.data.balances || {});
        await api.post(`/chat/rooms/${id}/read/`);
      } catch (err) {
        if (!cancelled) setError(apiError(err, 'Could not open this chat.'));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, user]);

  useEffect(() => {
    if (!id || !user || !tokens.access) return undefined;

    const socket = connect(`/ws/chat/${id}/`, {
      onOpen: () => setConnected(true),
      onClose: () => setConnected(false),
      onMessage: (event) => {
        switch (event.type) {
          case 'chat.message':
            setMessages((prev) =>
              prev.some((m) => m.id === event.message.id) ? prev : [...prev, event.message]
            );
            break;
          case 'chat.message_deleted':
            setMessages((prev) =>
              event.for_all
                ? prev.map((m) =>
                    m.id === event.message_id ? { ...m, deleted_for_all: true } : m
                  )
                : prev.filter((m) => m.id !== event.message_id)
            );
            break;
          case 'chat.message_pinned':
            setMessages((prev) =>
              prev.map((m) =>
                m.id === event.message_id ? { ...m, is_pinned: event.pinned } : m
              )
            );
            break;
          case 'chat.typing':
            setTypingUsers((prev) => {
              if (event.is_typing) {
                return prev.includes(event.user) ? prev : [...prev, event.user];
              }
              return prev.filter((name) => name !== event.user);
            });
            break;
          case 'error':
            setError(event.detail);
            break;
          default:
            break;
        }
      },
    });

    socketRef.current = socket;
    return () => socket.close();
  }, [id, user]);

  useEffect(scrollToBottom, [messages, scrollToBottom]);

  const notifyTyping = (isTyping) => {
    socketRef.current?.send({ action: 'typing', is_typing: isTyping });
  };

  const handleDraft = (event) => {
    setDraft(event.target.value);
    notifyTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => notifyTyping(false), 1800);
  };

  const send = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    const sent = socketRef.current?.send({
      action: 'send_message',
      content: body,
      message_type: 'text',
      reply_to: replyTo?.id,
    });
    if (!sent) {
      try {
        const { data } = await api.post('/chat/messages/', {
          room: id,
          content: body,
          message_type: 'text',
          reply_to: replyTo?.id,
        });
        setMessages((prev) => [...prev, data]);
      } catch (err) {
        setError(apiError(err, 'Message could not be delivered.'));
        return;
      }
    }
    setDraft('');
    setReplyTo(null);
    notifyTyping(false);
  };

  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const kind = file.type.startsWith('image/')
        ? 'image'
        : file.type.startsWith('video/')
          ? 'video'
          : file.type.startsWith('audio/')
            ? 'audio'
            : 'file';
      const payload = new FormData();
      payload.append('room', id);
      payload.append('media', file);
      payload.append('message_type', kind);
      payload.append('content', '');
      const { data } = await api.post('/chat/messages/', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessages((prev) => [...prev, data]);
    } catch (err) {
      setError(apiError(err, 'Upload failed.'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const deleteMessage = (message) => {
    const forAll = window.confirm('Delete for everyone? Cancel deletes only for you.');
    socketRef.current?.send({
      action: 'delete_message',
      message_id: message.id,
      for_all: forAll,
    });
  };

  const pinMessage = (message) => {
    socketRef.current?.send({
      action: 'pin_message',
      message_id: message.id,
      pinned: !message.is_pinned,
    });
  };

  const unlockFile = async (message) => {
    try {
      const { data } = await api.post(`/chat/messages/${message.id}/unlock/`);
      setMessages((prev) => prev.map((m) => (m.id === message.id ? data : m)));
    } catch (err) {
      setError(apiError(err, 'Could not unlock this file.'));
    }
  };

  const pinChat = () => socketRef.current?.send({ action: 'pin_chat', pinned: !room?.is_pinned });

  const startCall = (video) => {
    router.push(`/chats/${id}?call=${video ? 'video' : 'audio'}`, undefined, { shallow: true });
    window.open(
      `${API_URL.replace(/\/$/, '')}/api/docs/#/calls`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  return (
    <Layout title={room?.display_title || 'Chat'} fullBleed>
      <div className="flex h-[calc(100vh-0px)] flex-col lg:h-screen">
        <header className="flex items-center gap-3 border-b border-white/5 bg-black/70 px-4 py-3 backdrop-blur-xl">
          <Link href="/chats" className="text-neutral-400 hover:text-gold">
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate font-display text-base">
                {room?.display_title || 'Loading…'}
              </h1>
              <VerificationBadge verified={peer?.is_verified} size={14} />
            </div>
            <p className="text-[11px] text-neutral-500">
              {typingUsers.length
                ? `${typingUsers.join(', ')} typing…`
                : connected
                  ? 'Encrypted · online'
                  : 'Reconnecting…'}
            </p>
          </div>

          <button
            type="button"
            aria-label="Audio call"
            onClick={() => startCall(false)}
            className="rounded-lg p-2 text-neutral-400 hover:text-gold"
          >
            <PhoneIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Video call"
            onClick={() => startCall(true)}
            className="rounded-lg p-2 text-neutral-400 hover:text-gold"
          >
            <VideoCameraIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Pin chat"
            onClick={pinChat}
            className={`rounded-lg p-2 hover:text-gold ${
              room?.is_pinned ? 'text-gold' : 'text-neutral-400'
            }`}
          >
            <MapPinIcon className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto p-4 scrollbar-gold">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwn={message.sender?.id === user?.id}
              onDelete={deleteMessage}
              onReply={setReplyTo}
              onPin={pinMessage}
              onUnlock={unlockFile}
            />
          ))}
          <div ref={bottomRef} />
        </div>

        {error && (
          <p className="border-t border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-400">
            {error}
          </p>
        )}

        {replyTo && (
          <div className="flex items-center gap-2 border-t border-white/5 bg-graphite/60 px-4 py-2 text-xs">
            <span className="min-w-0 flex-1 truncate text-neutral-400">
              Replying to <strong className="text-gold">{replyTo.sender?.username}</strong>:{' '}
              {replyTo.content}
            </span>
            <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply">
              <XMarkIcon className="h-4 w-4 text-neutral-500 hover:text-gold" />
            </button>
          </div>
        )}

        <form
          onSubmit={send}
          className="flex items-end gap-2 border-t border-white/5 bg-black/70 p-3 backdrop-blur-xl"
        >
          <input ref={fileRef} type="file" onChange={upload} className="hidden" id="chat-upload" />
          <button
            type="button"
            aria-label="Attach file"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="rounded-xl p-2.5 text-neutral-400 hover:text-gold disabled:opacity-50"
          >
            <PaperClipIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Send handshakes"
            onClick={() => setShowDonation(true)}
            className="rounded-xl p-2.5 text-neutral-400 hover:text-gold"
          >
            <GiftIcon className="h-5 w-5" />
          </button>

          <textarea
            rows={1}
            value={draft}
            onChange={handleDraft}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                send(event);
              }
            }}
            placeholder="Write an encrypted message…"
            className="input max-h-40 flex-1 resize-none py-2.5"
          />

          <button type="submit" aria-label="Send" className="btn-primary p-3">
            <PaperAirplaneIcon className="h-5 w-5" />
          </button>
        </form>
      </div>

      {showDonation && peer && (
        <CoinDonation
          recipientUsername={peer.username}
          roomId={id}
          balances={balances}
          onClose={() => setShowDonation(false)}
          onDone={() => api.get('/coins/balance/').then(({ data }) => setBalances(data.balances))}
        />
      )}
    </Layout>
  );
}
