import { HANDSHAKE_LEVELS, getGradientStyle } from '../lib/badges';
import VerificationBadge from './VerificationBadge';

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
        <span title={handshake.label} style={{ filter: `drop-shadow(0 0 6px ${handshake.color}88)` }}>
          {handshake.emoji}
        </span>
      )}
    </span>
  );
}
