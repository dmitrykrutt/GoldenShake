import HandshakeIcon from './HandshakeIcon';
import { RARITY_META } from '../lib/constants';

export default function HandshakeBadge({ level = 'green', size = 'sm' }) {
  const meta = RARITY_META[level?.replace('_plus', '')] || RARITY_META.green;
  const isPlus = String(level).includes('plus');

  const sizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  }[size] || 'text-sm';

  return (
    <span
      className="inline-flex items-center gap-0.5"
      title={`${meta.label}${isPlus ? ' +' : ''}`}
    >
      <HandshakeIcon className={sizeClasses} color={meta.color} />
      {isPlus && <span className="text-[11px] font-bold leading-none" style={{ color: meta.color }}>+</span>}
    </span>
  );
}
