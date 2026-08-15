import { HANDSHAKE_LEVELS, getGradientStyle } from '../lib/badges';
import VerificationBadge from './VerificationBadge';

function HandshakeIcon({ color, size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ filter: `drop-shadow(0 0 4px ${color}88)` }}
    >
      <path
        d="M7 11.5L5.5 13 9 16.5l1.5-1.5M17 11.5L18.5 13 15 16.5l-1.5-1.5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 4L8 8H5l-2 3 4 4 2-2 3 3 3-3 2 2 4-4-2-3h-3L12 4z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={`${color}22`}
      />
    </svg>
  );
}

export default function Username({
  user,
  username,
  className = '',
  size = 16,
  withAt = false,
}) {
  const name = username || user?.username || '';
  const level = user?.displayed_handshake_level;
  const handshake = level ? HANDSHAKE_LEVELS[level] : null;

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span style={getGradientStyle(user?.username_gradient)}>{withAt ? `@${name}` : name}</span>
      {user?.show_verified_badge && user?.is_verified && <VerificationBadge verified size={size} />}
      {handshake && (
        <span title={handshake.label}>
          <HandshakeIcon color={handshake.color} size={size} />
        </span>
      )}
    </span>
  );
}
