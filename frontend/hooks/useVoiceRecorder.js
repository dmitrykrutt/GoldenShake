import { useCallback, useEffect, useRef, useState } from 'react';

export default function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const durationRef = useRef(0);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => {
    cleanupStream();
    if (preview?.url) URL.revokeObjectURL(preview.url);
  }, [cleanupStream, preview]);

  const startRecording = useCallback(async () => {
    setError('');
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 1,
        latency: 0.01,
      },
    });
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    streamRef.current = stream;
    mediaRecorderRef.current = recorder;
    chunksRef.current = [];
    setDuration(0);
    durationRef.current = 0;
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      setPreview({
        blob,
        url: URL.createObjectURL(blob),
        duration: durationRef.current,
        file: new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' }),
      });
      cleanupStream();
    };
    recorder.start();
    setIsRecording(true);
    timerRef.current = window.setInterval(() => {
      durationRef.current += 1;
      setDuration(durationRef.current);
    }, 1000);
  }, [cleanupStream]);

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;
    mediaRecorderRef.current.stop();
    window.clearInterval(timerRef.current);
    timerRef.current = null;
    setIsRecording(false);
  }, []);

  const discardPreview = useCallback(() => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setDuration(0);
    durationRef.current = 0;
  }, [preview]);

  return {
    isRecording,
    duration,
    preview,
    error,
    setError,
    startRecording,
    stopRecording,
    discardPreview,
  };
}
