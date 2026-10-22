interface IconProps {
  className?: string;
}

export function SunIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="4.6" fill="currentColor" />
      <g
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        opacity="0.95"
      >
        <path d="M12 2.4v2.3" />
        <path d="M12 19.3v2.3" />
        <path d="M2.4 12h2.3" />
        <path d="M19.3 12h2.3" />
        <path d="M5.2 5.2 6.8 6.8" />
        <path d="M17.2 17.2l1.6 1.6" />
        <path d="M18.8 5.2 17.2 6.8" />
        <path d="M6.8 17.2l-1.6 1.6" />
      </g>
    </svg>
  );
}

export function MoonIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M20.4 14.7A8.8 8.8 0 0 1 9.3 3.6 8.9 8.9 0 1 0 20.4 14.7Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function EqualBadge() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="M6 8h8M6 12h8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CrossBadge() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="m7 7 6 6M13 7l-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LockIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 12 12"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="2.1" y="5.1" width="7.8" height="5.6" rx="1.5" fill="currentColor" />
      <path
        d="M3.9 5.1V3.9a2.1 2.1 0 0 1 4.2 0v1.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ArrowLeftIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M15 5l-7 7 7 7"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TangoMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <circle cx="17" cy="18" r="7" fill="#ffc247" />
      <path
        d="M35 12a10.2 10.2 0 1 0 7.6 16.4A11.6 11.6 0 0 1 35 12Z"
        fill="#8fb0ff"
      />
      <circle cx="17" cy="35" r="4.6" fill="#8fb0ff" opacity="0.75" />
      <circle cx="33" cy="34" r="4.6" fill="#ffc247" opacity="0.75" />
    </svg>
  );
}

export function QueensMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        d="M12 34h24l2-16-7.5 6L24 12l-6.5 12L10 18l2 16Z"
        fill="none"
        stroke="#c9b6ff"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path d="M12 38h24" stroke="#c9b6ff" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function PinpointMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <circle cx="24" cy="22" r="13" fill="none" stroke="#7ef0cf" strokeWidth="2.2" opacity="0.5" />
      <circle cx="24" cy="22" r="7" fill="none" stroke="#7ef0cf" strokeWidth="2.2" />
      <circle cx="24" cy="22" r="2.6" fill="#7ef0cf" />
      <path d="M24 35v7" stroke="#7ef0cf" strokeWidth="2.2" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

export function CrossclimbMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        d="M13 36V24M24 36V15M35 36V9"
        stroke="#ffb27a"
        strokeWidth="4.4"
        strokeLinecap="round"
      />
      <path d="M10 36h28" stroke="#ffb27a" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}
