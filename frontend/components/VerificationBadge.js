export default function VerificationBadge({ verified = false, size = 16, title = 'Verified account' }) {
  if (!verified) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className="inline-block shrink-0 drop-shadow-[0_0_6px_rgba(201,168,76,0.6)]"
    >
      <title>{title}</title>
      <path
        fill="#C9A84C"
        d="M12 1.5 14.6 4l3.5-.4 1 3.4 3 1.9-1.5 3.2 1.5 3.2-3 1.9-1 3.4-3.5-.4L12 22.5 9.4 20l-3.5.4-1-3.4-3-1.9L3.4 12 1.9 8.8l3-1.9 1-3.4L9.4 4 12 1.5Z"
      />
      <path
        fill="#0D0D0D"
        d="m10.9 15.4-3-3 1.4-1.4 1.6 1.6 4-4L16.3 10l-5.4 5.4Z"
      />
    </svg>
  );
}
