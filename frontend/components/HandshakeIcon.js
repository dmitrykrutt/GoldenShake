export default function HandshakeIcon({ className = '', color, size }) {
  const style = {
    color: color || 'currentColor',
    fontSize: size ? `${size}px` : undefined,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <i className={`fa-solid fa-handshake-angle ${className}`} style={style} aria-hidden="true" />
  );
}
