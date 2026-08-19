import { useEffect, useRef } from 'react';
import {
  MicrophoneIcon,
  PhoneIcon,
  PhoneXMarkIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
} from '@heroicons/react/24/solid';

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function CallModal({
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
  peerName,
  peerAvatar,
  onAccept,
  onDecline,
  onEnd,
  onToggleMute,
  onToggleVideo,
}) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const isLocalVideoVisible = hasVideoTrack && !isVideoOff;
  const isAnyVideoActive = isLocalVideoVisible || remoteHasVideo;

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream, isLocalVideoVisible]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(() => {});
    }
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [remoteStream, remoteHasVideo]);

  if (callStatus === 'idle') return null;

  const displayName = peerName || callInfo?.callerName || 'Собеседник';
  const displayAvatar = peerAvatar || callInfo?.callerAvatar;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-2xl select-none">
      <audio ref={remoteAudioRef} autoPlay playsInline />

      <div className="relative flex h-full max-h-[640px] w-full max-w-md flex-col items-center justify-between overflow-hidden rounded-[32px] border border-white/10 bg-[#161618] p-6 shadow-2xl">
        
        {/* Видео-контейнер при разговоре с видео */}
        {callStatus === 'connected' && isAnyVideoActive ? (
          <div className="absolute inset-0 z-0 bg-black">
            {remoteHasVideo ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center bg-neutral-950 p-6 text-center">
                {displayAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={displayAvatar}
                    alt=""
                    className="h-28 w-28 rounded-full object-cover ring-2 ring-gold/40 opacity-70"
                  />
                ) : (
                  <div className="grid h-28 w-28 place-items-center rounded-full bg-graphite font-display text-3xl font-bold text-gold opacity-70">
                    {displayName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <p className="mt-4 text-xs font-medium text-neutral-400">Камера собеседника отключена</p>
              </div>
            )}

            {/* Локальное превью в плавающем окне */}
            <div className="absolute top-4 right-4 z-20 h-40 w-28 overflow-hidden rounded-2xl border-2 border-white/20 bg-black/80 shadow-2xl backdrop-blur-md">
              {isLocalVideoVisible ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover scale-x-[-1]"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center p-2 text-center text-neutral-400">
                  <VideoCameraSlashIcon className="h-6 w-6 text-neutral-500" />
                  <span className="text-[10px] mt-1">Камера выкл</span>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Верхний статус */}
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-black/70 px-3.5 py-1 text-xs font-semibold text-gold backdrop-blur-xl">
            {isAnyVideoActive || callInfo?.isVideo ? (
              <VideoCameraIcon className="h-3.5 w-3.5" />
            ) : (
              <PhoneIcon className="h-3.5 w-3.5" />
            )}
            <span>{isAnyVideoActive || callInfo?.isVideo ? 'Видеозвонок' : 'Аудиозвонок'}</span>
          </div>

          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
            {callStatus === 'calling' && 'Исходящий вызов…'}
            {callStatus === 'incoming' && (callInfo?.isVideo ? 'Входящий видеозвонок' : 'Входящий аудиозвонок')}
            {callStatus === 'connected' && `В разговоре · ${formatDuration(duration)}`}
          </p>

          <h2 className="mt-1 font-display text-2xl font-bold text-white drop-shadow-md">
            {displayName}
          </h2>
        </div>

        {/* Центральный аватар */}
        {(!isAnyVideoActive || callStatus !== 'connected') ? (
          <div className="relative z-10 my-auto flex flex-col items-center">
            <div className="relative">
              {callStatus !== 'connected' && (
                <span className="absolute -inset-4 animate-ping rounded-full bg-gold/20 duration-1000" />
              )}
              {displayAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={displayAvatar}
                  alt={displayName}
                  className="relative h-32 w-32 rounded-full object-cover ring-4 ring-gold/40 shadow-2xl"
                />
              ) : (
                <div className="relative grid h-32 w-32 place-items-center rounded-full bg-[#242426] font-display text-4xl font-bold text-gold ring-4 ring-gold/40 shadow-2xl">
                  {displayName.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {permissionError && (
          <p className="relative z-10 my-2 rounded-xl bg-red-500/30 px-4 py-2 text-center text-xs font-medium text-red-200 backdrop-blur-md">
            {permissionError}
          </p>
        )}

        {/* Нижняя панель действий */}
        <div className="relative z-10 flex w-full items-center justify-center gap-5 pt-3">
          {callStatus === 'incoming' ? (
            <>
              <button
                type="button"
                onClick={onDecline}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white shadow-xl transition-all duration-200 active:scale-90 hover:bg-red-500"
                title="Отклонить"
              >
                <PhoneXMarkIcon className="h-7 w-7" />
              </button>

              <button
                type="button"
                onClick={onAccept}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-black shadow-xl transition-all duration-200 active:scale-90 hover:bg-emerald-400 animate-bounce"
                title="Принять"
              >
                <PhoneIcon className="h-7 w-7" />
              </button>
            </>
          ) : (
            <>
              {callStatus === 'connected' && (
                <>
                  <button
                    type="button"
                    onClick={onToggleMute}
                    className={`flex h-14 w-14 items-center justify-center rounded-full transition-all duration-200 active:scale-90 shadow-lg ${
                      isMuted
                        ? 'bg-red-600 text-white shadow-red-600/30'
                        : 'border border-white/15 bg-white/10 text-white hover:bg-white/20 backdrop-blur-xl'
                    }`}
                    title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
                  >
                    <MicrophoneIcon className="h-6 w-6" />
                  </button>

                  <button
                    type="button"
                    onClick={onToggleVideo}
                    className={`flex h-14 w-14 items-center justify-center rounded-full transition-all duration-200 active:scale-90 shadow-lg ${
                      isLocalVideoVisible
                        ? 'bg-gold-gradient text-black shadow-gold'
                        : 'border border-white/15 bg-white/10 text-neutral-300 hover:bg-white/20 backdrop-blur-xl'
                    }`}
                    title={isLocalVideoVisible ? 'Выключить камеру' : 'Включить камеру'}
                  >
                    {isLocalVideoVisible ? (
                      <VideoCameraIcon className="h-6 w-6" />
                    ) : (
                      <VideoCameraSlashIcon className="h-6 w-6" />
                    )}
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={onEnd}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-xl shadow-red-600/30 transition-all duration-200 active:scale-90 hover:bg-red-500"
                title="Завершить вызов"
              >
                <PhoneXMarkIcon className="h-7 w-7" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
