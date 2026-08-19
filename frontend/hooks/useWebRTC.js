import { useCallback, useEffect, useRef, useState } from 'react';
import { callSounds } from '../utils/callSounds';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

const AUDIO_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  sampleRate: 48000,
  channelCount: 1,
};

export function useWebRTC(roomId, currentUserId, socketRef, { onSystemMessage } = {}) {
  const [callStatus, setCallStatus] = useState('idle');
  const [callInfo, setCallInfo] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [hasVideoTrack, setHasVideoTrack] = useState(false);
  const [remoteHasVideo, setRemoteHasVideo] = useState(false);
  const [duration, setDuration] = useState(0);
  const [permissionError, setPermissionError] = useState('');

  const myClientIdRef = useRef(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `dev_${Math.random().toString(36).substring(2, 11)}`
  );
  const peerClientIdRef = useRef(null);

  const pcRef = useRef(null);
  const timerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const iceCandidatesQueue = useRef([]);
  const isCallerRef = useRef(false);
  const isVideoRequestedRef = useRef(false);

  const cleanup = useCallback(() => {
    callSounds.stop();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    remoteStreamRef.current = null;
    peerClientIdRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setCallStatus('idle');
    setCallInfo(null);
    setDuration(0);
    setIsMuted(false);
    setIsVideoOff(false);
    setHasVideoTrack(false);
    setRemoteHasVideo(false);
    setPermissionError('');
    iceCandidatesQueue.current = [];
    isCallerRef.current = false;
    isVideoRequestedRef.current = false;
  }, []);

  const getMediaStream = async (wantVideo = false) => {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('WebRTC недоступен. Требуется HTTPS соединение.');
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: AUDIO_CONSTRAINTS,
        video: wantVideo ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      setHasVideoTrack(wantVideo);
      setIsVideoOff(!wantVideo);
      return stream;
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error('Разрешите доступ к микрофону/камере в настройках браузера.');
      }
      throw err;
    }
  };

  const setupPeerConnection = useCallback((stream) => {
    if (pcRef.current) return pcRef.current;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    if (typeof window !== 'undefined') {
      remoteStreamRef.current = new MediaStream();
    }

    // Добавляем аудиодорожку
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) pc.addTrack(audioTrack, stream);
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) pc.addTrack(videoTrack, stream);
      else pc.addTransceiver('video', { direction: 'sendrecv' });
    } else {
      pc.addTransceiver('audio', { direction: 'sendrecv' });
      pc.addTransceiver('video', { direction: 'sendrecv' });
    }

    pc.ontrack = (event) => {
      if (event.track) {
        if (!remoteStreamRef.current && typeof window !== 'undefined') {
          remoteStreamRef.current = new MediaStream();
        }
        remoteStreamRef.current.addTrack(event.track);
        setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()));

        if (event.track.kind === 'video') {
          setRemoteHasVideo(event.track.enabled && event.track.readyState === 'live');
          event.track.onunmute = () => setRemoteHasVideo(true);
          event.track.onmute = () => setRemoteHasVideo(false);
          event.track.onended = () => setRemoteHasVideo(false);
        }
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef?.current) {
        socketRef.current.send({
          action: 'call_ice_candidate',
          payload: event.candidate,
          client_id: myClientIdRef.current,
          target_client_id: peerClientIdRef.current,
          room_id: roomId,
        });
      }
    };

    return pc;
  }, [roomId, socketRef]);

  const handleCallEvent = useCallback(async (event) => {
    switch (event.type) {
      case 'chat.call_incoming': {
        if (isCallerRef.current || event.caller_client_id === myClientIdRef.current) return;
        
        peerClientIdRef.current = event.caller_client_id;
        const wantVideo = Boolean(event.is_video);
        isVideoRequestedRef.current = wantVideo;
        setHasVideoTrack(wantVideo);
        setCallInfo({
          callerId: event.caller_id,
          callerName: event.caller_username,
          callerAvatar: event.caller_avatar,
          isVideo: wantVideo,
        });
        setCallStatus('incoming');
        callSounds.playRingtone();
        break;
      }

      case 'chat.call_accepted': {
        if (isCallerRef.current && event.target_client_id === myClientIdRef.current) {
          peerClientIdRef.current = event.accepted_client_id;
          callSounds.stop();
          setCallStatus('connected');

          try {
            const stream = localStreamRef.current || await getMediaStream(isVideoRequestedRef.current);
            const pc = setupPeerConnection(stream);
            const offer = await pc.createOffer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: true,
            });
            await pc.setLocalDescription(offer);

            socketRef?.current?.send({
              action: 'call_offer',
              payload: offer,
              client_id: myClientIdRef.current,
              target_client_id: event.accepted_client_id,
              room_id: roomId,
            });
          } catch (err) {
            console.error('Create offer error:', err);
          }
          return;
        }

        if (event.accepted_client_id !== myClientIdRef.current && !isCallerRef.current) {
          cleanup();
        }
        break;
      }

      case 'chat.call_camera_toggle': {
        if (event.sender_client_id === myClientIdRef.current) return;
        setRemoteHasVideo(Boolean(event.is_camera_on));
        break;
      }

      case 'chat.call_declined': {
        cleanup();
        onSystemMessage?.('Звонок отклонён');
        break;
      }

      case 'chat.call_ended': {
        if (
          event.ended_client_id === peerClientIdRef.current ||
          event.target_client_id === myClientIdRef.current ||
          isCallerRef.current
        ) {
          cleanup();
          onSystemMessage?.('Звонок завершён');
        }
        break;
      }

      case 'chat.call_offer': {
        if (event.target_client_id && event.target_client_id !== myClientIdRef.current) return;

        try {
          peerClientIdRef.current = event.sender_client_id;
          const stream = localStreamRef.current || await getMediaStream(isVideoRequestedRef.current);
          const pc = setupPeerConnection(stream);

          await pc.setRemoteDescription(new RTCSessionDescription(event.payload));

          while (iceCandidatesQueue.current.length > 0) {
            const candidate = iceCandidatesQueue.current.shift();
            await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socketRef?.current?.send({
            action: 'call_answer',
            payload: answer,
            client_id: myClientIdRef.current,
            target_client_id: event.sender_client_id,
            room_id: roomId,
          });
        } catch (err) {
          console.error('Answer offer error:', err);
        }
        break;
      }

      case 'chat.call_answer': {
        if (event.target_client_id && event.target_client_id !== myClientIdRef.current) return;

        try {
          if (pcRef.current) {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(event.payload));
            while (iceCandidatesQueue.current.length > 0) {
              const candidate = iceCandidatesQueue.current.shift();
              await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
            }
          }
        } catch (err) {
          console.error('Call answer error:', err);
        }
        break;
      }

      case 'chat.call_ice_candidate': {
        if (event.target_client_id && event.target_client_id !== myClientIdRef.current) return;

        try {
          if (pcRef.current && pcRef.current.remoteDescription) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(event.payload)).catch(() => {});
          } else {
            iceCandidatesQueue.current.push(event.payload);
          }
        } catch (err) {
          console.error('Candidate error:', err);
        }
        break;
      }

      default:
        break;
    }
  }, [cleanup, onSystemMessage, roomId, setupPeerConnection, socketRef]);

  useEffect(() => {
    if (callStatus === 'connected') {
      timerRef.current = setInterval(() => setDuration((p) => p + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStatus]);

  const startCall = async ({ video = false }) => {
    try {
      setPermissionError('');
      isCallerRef.current = true;
      isVideoRequestedRef.current = video;
      setCallInfo({ isVideo: video });
      setCallStatus('calling');

      const stream = await getMediaStream(video);
      setupPeerConnection(stream);
      callSounds.playRingback();

      socketRef?.current?.send({
        action: 'call_initiate',
        client_id: myClientIdRef.current,
        is_video: video,
        room_id: roomId,
      });
    } catch (err) {
      setPermissionError(err.message || 'Ошибка доступа к медиа');
      cleanup();
    }
  };

  const acceptCall = async () => {
    try {
      setPermissionError('');
      callSounds.stop();
      setCallStatus('connected');

      const video = isVideoRequestedRef.current;
      const stream = await getMediaStream(video);
      setupPeerConnection(stream);

      socketRef?.current?.send({
        action: 'call_accept',
        client_id: myClientIdRef.current,
        target_client_id: peerClientIdRef.current,
        room_id: roomId,
      });
    } catch (err) {
      setPermissionError(err.message || 'Ошибка доступа к медиа');
      cleanup();
    }
  };

  const declineCall = () => {
    socketRef?.current?.send({
      action: 'call_decline',
      client_id: myClientIdRef.current,
      room_id: roomId,
    });
    cleanup();
  };

  const endCall = () => {
    socketRef?.current?.send({
      action: 'call_end',
      client_id: myClientIdRef.current,
      target_client_id: peerClientIdRef.current,
      room_id: roomId,
    });
    cleanup();
  };

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    const nextState = !isMuted;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !nextState;
    });
    setIsMuted(nextState);
  };

  const toggleVideo = async () => {
    if (!localStreamRef.current || !pcRef.current) return;

    const currentVideoTrack = localStreamRef.current.getVideoTracks()[0];
    const videoSender = pcRef.current.getSenders().find((s) => s.track?.kind === 'video' || (s.dtlsTransport && !s.track));

    if (currentVideoTrack && hasVideoTrack && !isVideoOff) {
      // 1. Выключаем камеру
      currentVideoTrack.enabled = false;
      currentVideoTrack.stop();
      localStreamRef.current.removeTrack(currentVideoTrack);
      if (videoSender) {
        await videoSender.replaceTrack(null);
      }
      setIsVideoOff(true);
      setHasVideoTrack(false);
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));

      socketRef?.current?.send({
        action: 'call_camera_toggle',
        client_id: myClientIdRef.current,
        target_client_id: peerClientIdRef.current,
        is_camera_on: false,
        room_id: roomId,
      });
    } else {
      // 2. Включаем камеру
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        const newTrack = videoStream.getVideoTracks()[0];
        localStreamRef.current.addTrack(newTrack);

        if (videoSender) {
          await videoSender.replaceTrack(newTrack);
        } else {
          pcRef.current.addTrack(newTrack, localStreamRef.current);
          const offer = await pcRef.current.createOffer();
          await pcRef.current.setLocalDescription(offer);
          socketRef?.current?.send({
            action: 'call_offer',
            payload: offer,
            client_id: myClientIdRef.current,
            target_client_id: peerClientIdRef.current,
            room_id: roomId,
          });
        }

        setHasVideoTrack(true);
        setIsVideoOff(false);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));

        socketRef?.current?.send({
          action: 'call_camera_toggle',
          client_id: myClientIdRef.current,
          target_client_id: peerClientIdRef.current,
          is_camera_on: true,
          room_id: roomId,
        });
      } catch (err) {
        setPermissionError('Не удалось получить доступ к камере.');
      }
    }
  };

  return {
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
  };
}
