import { useEffect, useRef, useState } from 'react';
import { PauseIcon, PlayIcon } from '@heroicons/react/24/solid';

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export default function VoiceMessagePlayer({ src, duration = 0 }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [total, setTotal] = useState(duration || 0);
  const [speed, setSpeed] = useState(1);
  const [loading, setLoading] = useState(true);
  const [seeking, setSeeking] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onCanPlay = () => setLoading(false);
    const onLoadedMetadata = () => {
      const d = audio.duration;
      if (Number.isFinite(d) && d > 0) setTotal(d);
      setLoading(false);
    };
    const onTimeUpdate = () => {
      if (!seeking) setCurrentTime(audio.currentTime);
    };
    const onEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
      audio.currentTime = 0;
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, [seeking]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setPlaying(false);
      }
    } else {
      audio.pause();
    }
  };

  const cycleSpeed = () => {
    const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const handleSeekChange = (event) => {
    const value = Number(event.target.value);
    setCurrentTime(value);
  };

  const handleSeekStart = () => setSeeking(true);

  const handleSeekEnd = (event) => {
    setSeeking(false);
    const value = Number(event.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = value;
      setCurrentTime(value);
    }
  };

  const progress = total > 0 ? (currentTime / total) * 100 : 0;

  return (
    <div className="flex w-full min-w-[220px] max-w-sm items-center gap-3 rounded-2xl border border-white/10 bg-black/40 p-3">
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold-gradient text-black disabled:opacity-50"
        aria-label={playing ? 'Пауза' : 'Воспроизвести'}
      >
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
        ) : playing ? (
          <PauseIcon className="h-5 w-5" />
        ) : (
          <PlayIcon className="h-5 w-5 pl-0.5" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <input
          type="range"
          min={0}
          max={total || 1}
          step={0.01}
          value={currentTime}
          onChange={handleSeekChange}
          onMouseDown={handleSeekStart}
          onTouchStart={handleSeekStart}
          onMouseUp={handleSeekEnd}
          onTouchEnd={handleSeekEnd}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15"
          style={{
            background: `linear-gradient(to right, #C9A84C ${progress}%, rgba(255,255,255,0.15) ${progress}%)`,
          }}
          aria-label="Позиция воспроизведения"
        />
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-neutral-500">
          <span>{formatTime(currentTime)}</span>
          <button
            type="button"
            onClick={cycleSpeed}
            className="rounded-full border border-white/10 px-2 py-0.5 text-white/80 hover:border-gold/40"
          >
            {speed}x
          </button>
          <span>{formatTime(total)}</span>
        </div>
      </div>

      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={src} preload="metadata" />
    </div>
  );
}
import { PauseIcon, PlayIcon } from '@heroicons/react/24/solid';

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export default function VoiceMessagePlayer({ src, duration = 0 }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [total, setTotal] = useState(duration);
  const [speed, setSpeed] = useState(1);
  const bars = useMemo(
    () => Array.from({ length: 28 }, (_, i) => 20 + Math.abs(Math.sin(i * 0.8)) * 80),
    []
  );

  const progress = total ? (currentTime / total) * 100 : 0;

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  const cycleSpeed = () => {
    const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  return (
    <div className="flex w-full min-w-[220px] max-w-sm items-center gap-3 rounded-2xl border border-white/10 bg-black/40 p-3">
      <button
        type="button"
        onClick={toggle}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold-gradient text-black"
      >
        {playing ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5 pl-0.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex h-10 items-center gap-1 overflow-hidden">
          {bars.map((bar, index) => (
            <span
              key={index}
              className={`w-full rounded-full ${index / bars.length * 100 <= progress ? 'bg-gold' : 'bg-white/15'}`}
              style={{ height: `${bar}%` }}
            />
          ))}
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-neutral-500">
          <span>{formatTime(currentTime)}</span>
          <button type="button" onClick={cycleSpeed} className="rounded-full border border-white/10 px-2 py-0.5 text-white/80">
            {speed}x
          </button>
          <span>{formatTime(total)}</span>
        </div>
      </div>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => setTotal(event.currentTarget.duration || duration)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
        }}
      >
        <track kind="captions" />
      </audio>
    </div>
  );
}
