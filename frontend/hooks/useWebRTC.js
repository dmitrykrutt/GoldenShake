import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../lib/api';
import { connect } from '../lib/ws';

/**
 * Manages WebRTC audio/video calls via the backend signaling WS.
 *
 * @param {string|number} chatId  – chat room id used for the WS path
 * @param {string}        userId  – current authenticated user id (string)
 */
export function useWebRTC(chatId, userId) {
  const [callStatus, setCallStatus] = useState('idle'); // idle | calling | incoming | connecting | active | ended
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callInfo, setCallInfo] = useState(null); // { callId, callerName, callerAvatar, callType }
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [permissionError, setPermissionError] = useState('');
  const [duration, setDuration] = useState(0);

  const wsRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const callInfoRef = useRef(null);
  const callTypeRef = useRef('audio');
  const connectedAtRef = useRef(null);
  const durationTimerRef = useRef(null);
  const timeoutTimerRef = useRef(null);
  const iceServersRef = useRef([{ urls: 'stun:stun.l.google.com:19302' }]);
  const pendingCandidatesRef = useRef([]);

  callInfoRef.current = callInfo;

  // Fetch ICE servers once
  useEffect(() => {
    if (!chatId) return;
    api
      .get('/calls/ice-servers/')
      .then((res) => {
        const servers = res.data?.ice_servers;
        if (Array.isArray(servers) && servers.length > 0) {
          iceServersRef.current = servers;
        }
      })
      .catch(() => {
        // fallback already set
      });
  }, [chatId]);

  const stopTracks = useCallback((stream) => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
  }, []);

  const cleanupPc = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    pendingCandidatesRef.current = [];
  }, []);

  const stopDurationTimer = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, []);

  const stopTimeoutTimer = useCallback(() => {
    if (timeoutTimerRef.current) {
      clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }
  }, []);

  const logCall = useCallback(async (callId, callType) => {
    if (!callId) return;
    const durationSec = connectedAtRef.current
      ? Math.round((Date.now() - connectedAtRef.current) / 1000)
      : 0;
    try {
      await api.post('/calls/logs/', {
        chat_id: chatId,
        duration_seconds: durationSec,
        call_type: callType || callTypeRef.current || 'audio',
      });
    } catch {
      // non-critical
    }
  }, [chatId]);

  const teardown = useCallback(
    (reason) => {
      stopDurationTimer();
      stopTimeoutTimer();
      stopTracks(localStreamRef.current);
      localStreamRef.current = null;
      setLocalStream(null);
      setRemoteStream(null);
      cleanupPc();
      setDuration(0);
      connectedAtRef.current = null;
      if (reason !== 'silent') {
        setCallStatus('ended');
        setTimeout(() => setCallStatus('idle'), 2000);
      }
    },
    [cleanupPc, stopDurationTimer, stopTimeoutTimer, stopTracks],
  );

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current) {
        wsRef.current.send({
          action: 'ice_candidate',
          candidate: event.candidate.toJSON(),
        });
      }
    };
    const rs = new MediaStream();
    setRemoteStream(rs);
    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => rs.addTrack(track));
    };
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setCallStatus('active');
        connectedAtRef.current = Date.now();
        stopTimeoutTimer();
        durationTimerRef.current = setInterval(() => {
          setDuration(Math.round((Date.now() - connectedAtRef.current) / 1000));
        }, 1000);
      }
      if (['failed', 'disconnected', 'closed'].includes(pc.iceConnectionState)) {
        const info = callInfoRef.current;
        logCall(info?.callId, info?.callType);
        teardown('');
      }
    };
    pcRef.current = pc;

    // flush pending candidates
    pendingCandidatesRef.current.forEach((c) => {
      pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
    });
    pendingCandidatesRef.current = [];

    return pc;
  }, [logCall, stopTimeoutTimer, teardown]);

  const getMedia = useCallback(async (withVideo) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: withVideo,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (err) {
      const msg =
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? 'Доступ к микрофону/камере запрещён. Разрешите доступ в настройках браузера.'
          : 'Не удалось получить доступ к микрофону/камере.';
      setPermissionError(msg);
      throw err;
    }
  }, []);

  const addTracks = useCallback((pc, stream) => {
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });
  }, []);

  // ----------- Signaling handlers -------------------------------------------
  const handleIncoming = useCallback((msg) => {
    if (msg.caller_id === String(userId)) return; // own broadcast
    setCallInfo({
      callId: msg.call_id,
      callerName: msg.caller,
      callType: msg.call_type,
    });
    setCallStatus('incoming');
    // auto-decline after 30 s if not answered
    timeoutTimerRef.current = setTimeout(() => {
      wsRef.current?.send({ action: 'call_decline', call_id: msg.call_id });
      setCallStatus('idle');
      setCallInfo(null);
    }, 30000);
  }, [userId]);

  const handleAccepted = useCallback(
    async (msg) => {
      // only the caller handles this (callee gets their own accepted echo but we proceed)
      if (msg.user_id === String(userId)) return; // callee sent it; caller continues
      stopTimeoutTimer();
      setCallStatus('connecting');
      const withVideo = callTypeRef.current === 'video';
      try {
        const stream = await getMedia(withVideo);
        const pc = createPeerConnection();
        addTracks(pc, stream);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        wsRef.current?.send({
          action: 'offer',
          sdp: pc.localDescription,
          call_id: callInfoRef.current?.callId,
        });
      } catch {
        teardown('');
      }
    },
    [addTracks, createPeerConnection, getMedia, stopTimeoutTimer, teardown, userId],
  );

  const handleOffer = useCallback(
    async (msg) => {
      if (msg.sender_id === String(userId)) return;
      setCallStatus('connecting');
      const withVideo = callInfoRef.current?.callType === 'video';
      try {
        const stream = await getMedia(withVideo);
        const pc = createPeerConnection();
        addTracks(pc, stream);
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        wsRef.current?.send({
          action: 'answer',
          sdp: pc.localDescription,
          call_id: msg.call_id,
        });
      } catch {
        teardown('');
      }
    },
    [addTracks, createPeerConnection, getMedia, teardown, userId],
  );

  const handleAnswer = useCallback(
    async (msg) => {
      if (msg.sender_id === String(userId)) return;
      if (!pcRef.current) return;
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      } catch {
        // ignore
      }
    },
    [userId],
  );

  const handleIceCandidate = useCallback(async (msg) => {
    if (!msg.candidate) return;
    if (pcRef.current && pcRef.current.remoteDescription) {
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate));
      } catch {
        // ignore
      }
    } else {
      pendingCandidatesRef.current.push(msg.candidate);
    }
  }, []);

  const handleEnded = useCallback(
    (msg) => {
      const info = callInfoRef.current;
      logCall(info?.callId, info?.callType);
      teardown(msg.reason === 'declined' ? 'declined' : '');
    },
    [logCall, teardown],
  );

  // ----------- WS setup -----------------------------------------------------
  useEffect(() => {
    if (!chatId || !userId) return undefined;

    const ws = connect(`/ws/calls/${chatId}/`, {
      onMessage: (msg) => {
        switch (msg.type) {
          case 'call.incoming':
            handleIncoming(msg);
            break;
          case 'call.accepted':
            handleAccepted(msg);
            break;
          case 'call.offer':
            handleOffer(msg);
            break;
          case 'call.answer':
            handleAnswer(msg);
            break;
          case 'call.ice_candidate':
            handleIceCandidate(msg);
            break;
          case 'call.ended':
            handleEnded(msg);
            break;
          default:
            break;
        }
      },
    });
    wsRef.current = ws;

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [chatId, userId, handleIncoming, handleAccepted, handleOffer, handleAnswer, handleIceCandidate, handleEnded]);

  // ----------- Public API ---------------------------------------------------
  const startCall = useCallback(
    async ({ video = false } = {}) => {
      if (callStatus !== 'idle') return;
      callTypeRef.current = video ? 'video' : 'audio';
      setCallStatus('calling');
      setCallInfo({ callType: video ? 'video' : 'audio' });

      wsRef.current?.send({
        action: 'call_start',
        call_type: video ? 'video' : 'audio',
      });

      // timeout if no one answers in 30 s
      timeoutTimerRef.current = setTimeout(() => {
        wsRef.current?.send({ action: 'call_end', reason: 'no_answer' });
        setCallStatus('ended');
        setCallInfo(null);
        setTimeout(() => setCallStatus('idle'), 2000);
      }, 30000);
    },
    [callStatus],
  );

  const acceptCall = useCallback(async () => {
    stopTimeoutTimer();
    const info = callInfoRef.current;
    if (!info) return;
    wsRef.current?.send({ action: 'call_accept', call_id: info.callId });
    setCallStatus('connecting');
  }, [stopTimeoutTimer]);

  const declineCall = useCallback(() => {
    stopTimeoutTimer();
    const info = callInfoRef.current;
    wsRef.current?.send({ action: 'call_decline', call_id: info?.callId });
    setCallStatus('idle');
    setCallInfo(null);
  }, [stopTimeoutTimer]);

  const endCall = useCallback(() => {
    const info = callInfoRef.current;
    wsRef.current?.send({ action: 'call_end', call_id: info?.callId });
    logCall(info?.callId, info?.callType);
    teardown('');
  }, [logCall, teardown]);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setIsMuted((v) => !v);
  }, []);

  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setIsVideoOff((v) => !v);
  }, []);

  return {
    callStatus,
    callInfo,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    duration,
    permissionError,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleVideo,
  };
}

export default useWebRTC;
