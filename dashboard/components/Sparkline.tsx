import { useId } from "react";

// Area + line sparkline, as in the mockup.
export function Sparkline({ values, color }: { values: number[]; color: string }) {
  const id = `sp${useId().replace(/[^\w-]/g, "")}`; // safe inside url(#…)
  if (!values.length) return null;
  const w = 74, h = 28, pad = 2;
  const min = Math.min(...values);
  const max = Math.max(...values, min + 1);
  const pts = values
    .map((v, i) => {
      const x = pad + (i / Math.max(1, values.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / (max - min)) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg className="sparkline" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`${pad},${h} ${pts} ${w - pad},${h}`} fill={`url(#${id})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
