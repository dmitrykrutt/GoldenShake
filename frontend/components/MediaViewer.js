import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDownTrayIcon, ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from '@heroicons/react/24/outline';

export default function MediaViewer({ items = [], initialIndex = 0, onClose }) {
  const [index, setIndex] = useState(initialIndex);
  const current = useMemo(() => items[index] || null, [items, index]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
      if (event.key === 'ArrowLeft') setIndex((value) => Math.max(value - 1, 0));
      if (event.key === 'ArrowRight') setIndex((value) => Math.min(value + 1, items.length - 1));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items.length, onClose]);

  if (!current) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative max-h-full max-w-6xl"
          onClick={(event) => event.stopPropagation()}
        >
          <button type="button" onClick={onClose} className="absolute right-3 top-3 z-10 rounded-full bg-black/50 p-2 text-white">
            <XMarkIcon className="h-6 w-6" />
          </button>
          {current.type === 'video' ? (
            <video
              controls
              preload="metadata"
              className="max-h-[88vh] rounded-2xl bg-black"
            >
              <source src={current.src} />
              <track kind="captions" />
            </video>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current.src} alt={current.alt || ''} className="max-h-[88vh] rounded-2xl object-contain" />
          )}
          <div className="mt-3 flex items-center justify-between text-white">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIndex((value) => Math.max(value - 1, 0))}
                disabled={index === 0}
                className="rounded-full border border-white/10 p-2 disabled:opacity-30"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setIndex((value) => Math.min(value + 1, items.length - 1))}
                disabled={index === items.length - 1}
                className="rounded-full border border-white/10 p-2 disabled:opacity-30"
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>
            <a href={current.src} download className="rounded-full border border-white/10 p-2">
              <ArrowDownTrayIcon className="h-5 w-5" />
            </a>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
