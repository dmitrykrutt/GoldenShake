import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  GiftIcon,
  MapPinIcon,
  MicrophoneIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
  PhoneIcon,
  PlusIcon,
  StopIcon,
  TrashIcon,
  VideoCameraIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import Layout from '../../components/Layout';
import MessageBubble from '../../components/MessageBubble';
import CoinDonation from '../../components/CoinDonation';
import CallModal from '../../components/CallModal';
import Username from '../../components/Username';
import VoiceMessagePlayer from '../../components/VoiceMessagePlayer';
import api, { apiError, tokens } from '../../lib/api';
import { connect } from '../../lib/ws';
import { useRequireAuth } from '../../lib/auth';
import { useWebRTC } from '../../hooks/useWebRTC';
import useVoiceRecorder from '../../hooks/useVoiceRecorder';

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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedAttachment, setSelectedAttachment] = useState(null);
  const [fullMediaViewer, setFullMediaViewer] = useState(null);

  const [isInputFocused, setIsInputFocused] = useState(false);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);

  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const typingTimer = useRef(null);
  const attachmentPreviewUrlRef = useRef(null);

  const peer = room?.memberships?.find((m) => m.user?.id !== user?.id)?.user;
  const {
    isRecording,
    duration: voiceDuration,
    preview: voicePreview,
    startRecording,
    stopRecording,
    discardPreview,
    setError: setVoiceError,
  } = useVoiceRecorder();

  const appendSystemMessage = useCallback((content) => {
    if (!content) return;
    setMessages((prev) => {
      const existing = prev.find(
        (message) =>
          message.message_type === 'system' &&
          message.content === content &&
          Date.now() - new Date(message.created_at).getTime() < 5000
      );
      if (existing) return prev;
      return [
        ...prev,
        {
          id: `local-${Date.now()}`,
          message_type: 'system',
          content,
          created_at: new Date().toISOString(),
          sender: peer || user,
          localFallback: true,
        },
      ];
    });
  }, [peer, user]);

  const {
    callStatus,
    callInfo,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    hasVideoTrack,
    remoteHasVideo,
    duration,
    permissionError,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleVideo,
    handleCallEvent,
  } = useWebRTC(id, user?.id ? String(user.id) : null, socketRef, { onSystemMessage: appendSystemMessage });

  useEffect(() => () => {
    if (attachmentPreviewUrlRef.current) URL.revokeObjectURL(attachmentPreviewUrlRef.current);
  }, []);

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
        if (event.type && event.type.startsWith('chat.call_')) {
          handleCallEvent(event);
          return;
        }

        switch (event.type) {
          case 'chat.message': {
            const rawMsg = event.message;
            const normalized = {
              ...rawMsg,
              sender: typeof rawMsg.sender === 'object' && rawMsg.sender !== null
                ? rawMsg.sender
                : {
                    id: rawMsg.sender_id || (rawMsg.sender === user?.username ? user?.id : peer?.id),
                    username: rawMsg.sender || rawMsg.sender_username || user?.username,
                    avatar: rawMsg.sender === user?.username ? user?.avatar : peer?.avatar,
                  },
            };

            setMessages((prev) => {
              const filtered = normalized.message_type === 'system'
                ? prev.filter((message) => !(message.localFallback && message.content === normalized.content))
                : prev;
              return filtered.some((m) => m.id === normalized.id)
                ? filtered
                : [...filtered, normalized];
            });
            break;
          }
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
  }, [id, user, peer, handleCallEvent]);

  useEffect(scrollToBottom, [messages, scrollToBottom]);

  const notifyTyping = (isTyping) => {
    socketRef.current?.send({ action: 'typing', is_typing: isTyping });
  };

  const handleDraft = (event) => {
    setDraft(event.target.value);
    const el = event.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    notifyTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => notifyTyping(false), 1800);
  };

  const send = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;

    const payload = {
      action: 'send_message',
      content: body,
      message_type: 'text',
      reply_to: replyTo?.id,
    };

    const sent = socketRef.current?.send(payload);
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
    setMobileActionsOpen(false);
    notifyTyping(false);
  };

  const upload = async (file, forcedKind = null) => {
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    setError('');
    try {
      const kind = forcedKind || (file.type.startsWith('image/')
        ? 'image'
        : file.type.startsWith('video/')
          ? 'video'
          : file.type.startsWith('audio/')
            ? 'voice'
            : 'file');
      const payload = new FormData();
      payload.append('room', id);
      payload.append('media', file);
      payload.append('message_type', kind);
      payload.append('content', '');
      if (replyTo?.id) {
        payload.append('reply_to', replyTo.id);
      }
      const { data } = await api.post('/chat/messages/', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (!progressEvent.total) return;
          setUploadProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100));
        },
      });
      setMessages((prev) => [...prev, data]);
    } catch (err) {
      setError(apiError(err, 'Upload failed.'));
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setSelectedAttachment(null);
      setReplyTo(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleAttachmentSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (attachmentPreviewUrlRef.current) URL.revokeObjectURL(attachmentPreviewUrlRef.current);
    attachmentPreviewUrlRef.current = file.type.startsWith('image/') || file.type.startsWith('video/')
      ? URL.createObjectURL(file)
      : null;
    setSelectedAttachment({
      file,
      previewUrl: attachmentPreviewUrlRef.current,
      kind: file.type.startsWith('image/')
        ? 'image'
        : file.type.startsWith('video/')
          ? 'video'
          : 'file',
    });
    setMobileActionsOpen(false);
  };

  const clearSelectedAttachment = () => {
    if (attachmentPreviewUrlRef.current) {
      URL.revokeObjectURL(attachmentPreviewUrlRef.current);
      attachmentPreviewUrlRef.current = null;
    }
    setSelectedAttachment(null);
  };

  const deleteMessage = (message) => {
    const forAll = window.confirm('Удалить для всех? Отмена удалит только у вас.');
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

  const isTypingActive = isInputFocused || draft.trim().length > 0;

  return (
    <Layout title={room?.display_title || 'Чат'} fullBleed isChatRoom={true}>
      <CallModal
        callStatus={callStatus}
        callInfo={callInfo}
        localStream={localStream}
        remoteStream={remoteStream}
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        hasVideoTrack={hasVideoTrack}
        remoteHasVideo={remoteHasVideo}
        duration={duration}
        permissionError={permissionError}
        peerName={peer?.full_name || peer?.username || callInfo?.callerName}
        peerAvatar={peer?.avatar}
        onAccept={acceptCall}
        onDecline={declineCall}
        onEnd={endCall}
        onToggleMute={toggleMute}
        onToggleVideo={toggleVideo}
      />

      <div className="chat-page max-w-full overflow-x-hidden">
        {/* Хедер чата */}
        <header className="chat-header flex items-center justify-between border-b border-white/5 bg-black/90 px-3 backdrop-blur-xl">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <Link
              href="/chats"
              className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-400 hover:bg-white/5 hover:text-gold shrink-0 -ml-1"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </Link>

            <button
              type="button"
              onClick={() => peer?.username && router.push(`/profile/${peer.username}`)}
              className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
            >
              {peer?.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={peer.avatar} alt={peer.username} className="h-9 w-9 rounded-full object-cover ring-1 ring-gold/30 shrink-0" />
              ) : (
                <div className="grid h-9 w-9 place-items-center rounded-full bg-graphite text-xs font-bold text-gold shrink-0 ring-1 ring-gold/20">
                  {(peer?.username || room?.display_title || '?').slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h1 className="truncate font-display text-sm font-semibold leading-tight text-white">
                  <Username user={peer} username={room?.display_title || 'Загрузка…'} />
                </h1>
                <p className="truncate text-[11px] text-neutral-500 leading-tight">
                  {typingUsers.length
                    ? `${typingUsers.join(', ')} печатает…`
                    : connected
                      ? 'Зашифровано · онлайн'
                      : 'Переподключение…'}
                </p>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              aria-label="Audio call"
              onClick={() => startCall({ video: false })}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:text-gold"
            >
              <PhoneIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Video call"
              onClick={() => startCall({ video: true })}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:text-gold"
            >
              <VideoCameraIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Pin chat"
              onClick={pinChat}
              className={`flex h-8 w-8 items-center justify-center rounded-lg hover:text-gold ${
                room?.is_pinned ? 'text-gold' : 'text-neutral-400'
              }`}
            >
              <MapPinIcon className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Область сообщений */}
        <div className="chat-messages space-y-2 p-3 pb-4 max-w-full overflow-x-hidden">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwn={String(message.sender?.id || message.sender_id) === String(user?.id)}
              onOpenProfile={(username) => username && router.push(`/profile/${username}`)}
              onDelete={deleteMessage}
              onReply={setReplyTo}
              onPin={pinMessage}
              onUnlock={unlockFile}
              onOpenMedia={(media) => setFullMediaViewer(media)}
            />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Панель ввода */}
        <div className="chat-input-area border-t border-white/5 bg-black/95 backdrop-blur-xl">
          {error && (
            <p className="border-b border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs text-red-400">
              {error}
            </p>
          )}

          {replyTo && (
            <div className="flex items-center gap-2 border-b border-white/10 bg-graphite/80 px-3 py-1.5 text-xs">
              <div className="w-1 self-stretch rounded-full bg-gold" />
              <div className="min-w-0 flex-1">
                <span className="font-semibold text-gold text-[11px]">
                  Ответ на сообщение {replyTo.sender?.username || replyTo.sender}
                </span>
                <p className="truncate text-neutral-400 text-[11px]">
                  {replyTo.content || 'Вложение'}
                </p>
              </div>
              <button type="button" onClick={() => setReplyTo(null)} aria-label="Отменить ответ" className="p-1">
                <XMarkIcon className="h-4 w-4 text-neutral-400 hover:text-gold" />
              </button>
            </div>
          )}

          {selectedAttachment && (
            <div className="p-2">
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-graphite/50 p-2">
                {selectedAttachment.previewUrl && selectedAttachment.kind === 'image' && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedAttachment.previewUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
                )}
                {selectedAttachment.previewUrl && selectedAttachment.kind === 'video' && (
                  <video src={selectedAttachment.previewUrl} className="h-12 w-12 rounded-lg object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-white">{selectedAttachment.file.name}</p>
                  <p className="text-[10px] text-neutral-500">
                    {Math.max(1, Math.round(selectedAttachment.file.size / 1024))} КБ
                    {uploading && uploadProgress ? ` · ${uploadProgress}%` : ''}
                  </p>
                </div>
                <button type="button" onClick={clearSelectedAttachment} className="p-1.5 text-neutral-400 hover:text-red-400">
                  <TrashIcon className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => upload(selectedAttachment.file, selectedAttachment.kind)} className="btn-primary px-3 py-1 text-xs">
                  Отправить
                </button>
              </div>
            </div>
          )}

          {voicePreview && (
            <div className="p-2">
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-graphite/50 p-2">
                <VoiceMessagePlayer src={voicePreview.url} duration={voicePreview.duration} />
                <button type="button" onClick={discardPreview} className="p-1.5 text-neutral-400 hover:text-red-400">
                  <TrashIcon className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => upload(voicePreview.file, 'voice')} className="btn-primary px-3 py-1 text-xs">
                  Отправить
                </button>
              </div>
            </div>
          )}

          {mobileActionsOpen && (
            <div className="flex items-center gap-2 border-b border-white/10 bg-graphite/90 px-3 py-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-neutral-200 hover:text-gold"
              >
                <PaperClipIcon className="h-4 w-4 text-gold" /> Файл
              </button>
              <button
                type="button"
                onClick={() => { setMobileActionsOpen(false); setShowDonation(true); }}
                className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-neutral-200 hover:text-gold"
              >
                <GiftIcon className="h-4 w-4 text-gold" /> Донат
              </button>
            </div>
          )}

          <form onSubmit={send} className="flex items-end gap-1.5 p-2">
            <input ref={fileRef} type="file" accept="image/*,video/*,*/*" onChange={handleAttachmentSelect} className="hidden" id="chat-upload" />
            
            {isTypingActive ? (
              <button
                type="button"
                onClick={() => setMobileActionsOpen(!mobileActionsOpen)}
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition shrink-0 ${
                  mobileActionsOpen ? 'bg-gold text-black font-bold rotate-45' : 'text-neutral-400 hover:text-gold'
                }`}
                title="Дополнительно"
              >
                <PlusIcon className="h-5 w-5" />
              </button>
            ) : (
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  aria-label="Attach file"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-neutral-400 hover:text-gold"
                >
                  <PaperClipIcon className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  aria-label="Send handshakes"
                  onClick={() => setShowDonation(true)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-neutral-400 hover:text-gold"
                >
                  <GiftIcon className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  aria-label={isRecording ? 'Остановить запись' : 'Записать голосовое'}
                  onClick={async () => {
                    try {
                      if (isRecording) {
                        stopRecording();
                      } else {
                        setVoiceError('');
                        await startRecording();
                      }
                    } catch (recordingError) {
                      setError(
                        recordingError?.name === 'NotAllowedError'
                          ? 'Для звонков и голосовых сообщений необходим доступ к микрофону.'
                          : 'Не удалось начать запись голосового сообщения.'
                      );
                    }
                  }}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${isRecording ? 'text-red-400' : 'text-neutral-400 hover:text-gold'}`}
                >
                  {isRecording ? <StopIcon className="h-5 w-5" /> : <MicrophoneIcon className="h-5 w-5" />}
                </button>
              </div>
            )}

            <textarea
              rows={1}
              value={draft}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              onChange={handleDraft}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  send(event);
                }
              }}
              placeholder={isRecording ? `Запись… ${voiceDuration}с` : 'Сообщение…'}
              className="input max-h-32 flex-1 resize-none py-2 px-3 text-sm rounded-xl leading-snug"
            />

            <button type="submit" aria-label="Send" className="btn-primary flex h-10 w-10 items-center justify-center p-0 rounded-xl shrink-0">
              <PaperAirplaneIcon className="h-5 w-5" />
            </button>
          </form>
        </div>
      </div>

      {/* Полноэкранный просмотрщик фото */}
      {fullMediaViewer && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 p-4 backdrop-blur-md">
          <div className="absolute top-4 right-4 flex items-center gap-3">
            <a
              href={fullMediaViewer.src}
              download="photo.jpg"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-gold hover:text-black transition"
              title="Скачать"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
            </a>
            <button
              type="button"
              onClick={() => setFullMediaViewer(null)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-red-500/80 transition"
              title="Закрыть"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fullMediaViewer.src}
            alt=""
            className="max-h-[85vh] max-w-[95vw] rounded-2xl object-contain shadow-2xl"
          />
        </div>
      )}

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
