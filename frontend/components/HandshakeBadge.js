import { LEVEL_META, RARITY_META } from '../lib/constants';

const SIZES = {
  sm: 'h-6 px-2 text-[10px]',
  md: 'h-7 px-2.5 text-[11px]',
  lg: 'h-9 px-4 text-sm',
};

export default function HandshakeBadge({ level = 'green', size = 'md', showLabel = true }) {
  const meta = LEVEL_META[level] || LEVEL_META.green;
  const rarity = RARITY_META[meta.rarity];
  const isPlus = level.endsWith('_plus');

  return (
    <span
      title={meta.label}
      className={`badge ${SIZES[size] || SIZES.md} border`}
      style={{
        color: rarity.color,
        borderColor: `${rarity.color}55`,
        backgroundColor: `${rarity.color}1A`,
        boxShadow: isPlus ? `0 0 12px ${rarity.color}55` : 'none',
      }}
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
        <path d="M11 4 7.6 7.4a2 2 0 0 0 0 2.8l.6.6 3-3 1.4 1.4-4.2 4.3a1 1 0 0 0 0 1.4l.3.3a1 1 0 0 0 1.4 0l4.3-4.2 1 1-3.6 3.6a1 1 0 0 0 0 1.4l.3.3a1 1 0 0 0 1.4 0l5.1-5.1a2 2 0 0 0 0-2.8L13.9 4A2 2 0 0 0 11 4Z" />
      </svg>
      {showLabel && <span className="font-semibold">{meta.label}</span>}
    </span>
  );
}
