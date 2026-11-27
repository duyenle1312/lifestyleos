import { useId } from "react";

// The app icon (src/app/icon.svg) inlined so it scales crisply next to the wordmark.
export function Logo({ size = 24 }: { size?: number }) {
  const gradient = useId();
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className="inline-block shrink-0"
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b9bff" />
          <stop offset="1" stopColor="#0a5fd6" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="32" fill={`url(#${gradient})`} />
      <g fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 31 32 17l17 14" />
        <path d="M20 28v17h24V28" />
      </g>
      <rect x="29" y="37" width="6" height="8" rx="1.5" fill="#fff" />
    </svg>
  );
}
