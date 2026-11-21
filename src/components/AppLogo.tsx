import { useId } from "react";

/** Lifestyle OS mark — keep in sync with src/app/icon.svg (the favicon). */
export function AppLogo({ className }: { className?: string }) {
  const gradientId = useId();
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Lifestyle OS">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b9bff" />
          <stop offset="1" stopColor="#0a5fd6" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="32" fill={`url(#${gradientId})`} />
      <g fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 31 32 17l17 14" />
        <path d="M20 28v17h24V28" />
      </g>
      <rect x="29" y="37" width="6" height="8" rx="1.5" fill="#fff" />
    </svg>
  );
}
