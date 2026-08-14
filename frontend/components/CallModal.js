import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  MicrophoneIcon,
  PhoneIcon,
  PhoneXMarkIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid';

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function statusLabel(callStatus, callInfo, duration) {
  switch (callStatus) {
    case 'calling':
      return 'Вызов…';
    case 'incoming':
      return `Входящий звонок от ${callInfo?.callerName || ''}`;
    case 'connecting':
      return 'Соединение…';
    case 'active':
      return `Идёт звонок ${formatDuration(duration)}`;
    case 'ended':
      return 'Звонок завершён';
    default:
      return '';
  }
}

export default function CallModal({
  callStatus,
  callInfo,
  localStream,
  remoteStream,
  isMuted,
  isVideoOff,
  duration,
  permissionError,
  onAccept,
  onDecline,
  onEnd,
  onToggleMute,
  onToggleVideo,
  peerName,
  peerAvatar,
}) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const isVisible = ['calling', 'incoming', 'connecting', 'active', 'ended'].includes(callStatus);
  const isVideoCall = callInfo?.callType === 'video';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="call-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[999] flex flex-col items-center justify-between overflow-hidden bg-black/90 backdrop-blur-2xl"
        >
          {/* Remote video / avatar background */}
          <div className="absolute inset-0">
            {isVideoCall && remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="h-full w-full object-cover opacity-90"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                {peerAvatar ? (
                  <img
                    src={peerAvatar}
                    alt={peerName}
                    className="h-40 w-40 rounded-full object-cover ring-4 ring-gold/40"
                  />
                ) : (
                  <div className="flex h-40 w-40 items-center justify-center rounded-full bg-graphite text-6xl font-display text-gold ring-4 ring-gold/40">
                    {(peerName || '?')[0].toUpperCase()}
                  </div>
                )}
              </div>
            )}
            {/* dark overlay */}
            <div className="absolute inset-0 bg-black/40" />
          </div>

          {/* Hidden audio element for audio-only calls */}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

          {/* Top bar */}
          <div className="relative z-10 flex w-full items-center justify-between px-5 pt-6">
            <div>
              <p className="text-lg font-display text-white">{peerName || callInfo?.callerName}</p>
              <p className="text-sm text-gold/80">{statusLabel(callStatus, callInfo, duration)}</p>
            </div>
            {callStatus === 'active' && (
              <button
                type="button"
                onClick={onEnd}
                aria-label="Закрыть"
                className="rounded-full p-2 text-white/60 hover:text-white"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Permission error */}
          {permissionError && (
            <div className="relative z-10 mx-5 rounded-xl bg-red-900/60 px-4 py-3 text-sm text-red-200">
              {permissionError}
            </div>
          )}

          {/* Local video PiP */}
          {isVideoCall && localStream && (
            <div className="absolute bottom-32 right-4 z-20 overflow-hidden rounded-2xl shadow-gold">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="h-36 w-24 object-cover"
              />
            </div>
          )}

          {/* Buttons */}
          <div className="relative z-10 mb-12 flex items-center gap-6">
            {callStatus === 'incoming' ? (
              <>
                {/* Decline */}
                <button
                  type="button"
                  onClick={onDecline}
                  aria-label="Отклонить"
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 shadow-lg transition hover:bg-red-500 active:scale-95"
                >
                  <PhoneXMarkIcon className="h-7 w-7 text-white" />
                </button>
                {/* Accept */}
                <button
                  type="button"
                  onClick={onAccept}
                  aria-label="Принять"
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 shadow-lg transition hover:bg-emerald-500 active:scale-95"
                >
                  <PhoneIcon className="h-7 w-7 text-white" />
                </button>
              </>
            ) : (
              <>
                {/* Mute */}
                <button
                  type="button"
                  onClick={onToggleMute}
                  aria-label={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
                  className={`flex h-14 w-14 items-center justify-center rounded-full transition active:scale-95 ${
                    isMuted ? 'bg-white/20 text-white/40' : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  <MicrophoneIcon className="h-6 w-6" />
                </button>

                {/* Video toggle (only for video calls) */}
                {isVideoCall && (
                  <button
                    type="button"
                    onClick={onToggleVideo}
                    aria-label={isVideoOff ? 'Включить камеру' : 'Выключить камеру'}
                    className={`flex h-14 w-14 items-center justify-center rounded-full transition active:scale-95 ${
                      isVideoOff ? 'bg-white/20 text-white/40' : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    {isVideoOff ? (
                      <VideoCameraSlashIcon className="h-6 w-6" />
                    ) : (
                      <VideoCameraIcon className="h-6 w-6" />
                    )}
                  </button>
                )}

                {/* End call */}
                <button
                  type="button"
                  onClick={onEnd}
                  aria-label="Завершить звонок"
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 shadow-lg transition hover:bg-red-500 active:scale-95"
                >
                  <PhoneXMarkIcon className="h-7 w-7 text-white" />
                </button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
