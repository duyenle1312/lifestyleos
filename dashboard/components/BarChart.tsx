"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { Range } from "@/lib/types";

export type Bucket = { v: number; start: Date; end: Date };

const dateLbl = (d: Date, range: Range) =>
  range === 365
    ? d.toLocaleDateString("en-GB", { month: "short" })
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export const bucketName = (range: Range) => ({ 30: "per day", 84: "per week", 365: "per month" })[range];

type Tip = { i: number; x: number; y: number };

// Bar chart with gridlines, axis labels and a floating tooltip, as in the mockup.
export function BarChart({
  buckets,
  range,
  unit,
  formatter,
  tipNote,
}: {
  buckets: Bucket[];
  range: Range;
  unit: string;
  formatter: (n: number) => string;
  tipNote?: string;
}) {
  // `tip` keeps the last bar so the tooltip fades out with its content intact.
  const [tip, setTip] = useState<Tip | null>(null);
  const [visible, setVisible] = useState(false);
  const tipRef = useRef<HTMLDivElement>(null);

  const max = Math.max(1, ...buckets.map((b) => b.v));
  const nice = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / nice) * nice;
  const avg = buckets.reduce((acc, b) => acc + b.v, 0) / Math.max(1, buckets.length);
  const per = bucketName(range);

  // Clamp the tooltip to the viewport once its width is known.
  useLayoutEffect(() => {
    const el = tipRef.current;
    if (!el || !tip) return;
    el.style.left = `${Math.max(8, Math.min(tip.x + 12, window.innerWidth - el.offsetWidth - 10))}px`;
    el.style.top = `${Math.max(8, tip.y - 56)}px`;
  }, [tip]);

  const show = (i: number, x: number, y: number) => {
    setTip({ i, x, y });
    setVisible(true);
  };

  const b = tip ? buckets[tip.i] : undefined;
  const when = b
    ? range === 30
      ? dateLbl(b.start, 30)
      : `${dateLbl(b.start, 84)} – ${dateLbl(b.end, 84)}`
    : "";
  const diffPct = b && avg > 0 ? Math.round(((b.v - avg) / avg) * 100) : 0;
  const diffStr = diffPct >= 0 ? `+${diffPct}% vs avg` : `${diffPct}% vs avg`;

  return (
    <div className="chart-wrap">
      <div className="chart-title">
        <span>
          {unit} {per}
        </span>
        <span className="tnum">
          Avg {formatter(avg)} {per}
        </span>
      </div>
      <div className="chart">
        <div className="gl" style={{ bottom: "100%" }}>
          <span>{formatter(top)}</span>
        </div>
        <div className="gl" style={{ bottom: "50%" }}>
          <span>{formatter(Math.round(top / 2))}</span>
        </div>
        <div className="gl" style={{ bottom: 0, border: 0 }}>
          <span>{formatter(0)}</span>
        </div>
        {buckets.map((bk, i) => (
          <div
            key={i}
            className="bar-hit"
            onMouseMove={(e) => show(i, e.clientX, e.clientY)}
            onMouseLeave={() => setVisible(false)}
            onTouchStart={(e) => {
              const t = e.touches[0];
              if (t) show(i, t.clientX, t.clientY);
            }}
            onTouchEnd={() => setVisible(false)}
          >
            <div className="bar" style={{ height: `${Math.max(bk.v > 0 ? 3 : 0, (bk.v / top) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="axis">
        <span>{dateLbl(buckets[0].start, range)}</span>
        <span>{dateLbl(buckets[Math.floor(buckets.length / 2)].start, range)}</span>
        <span>{dateLbl(buckets[buckets.length - 1].start, range)}</span>
      </div>
      <div ref={tipRef} className={visible ? "tip visible" : "tip"} role="tooltip">
        {b && (
          <>
            <div>
              <b className="tnum">{formatter(b.v)}</b> {unit.toLowerCase()}
            </div>
            <div className="tip-meta">
              {when} · {diffStr}
            </div>
            {tipNote && <div className="tip-note">{tipNote}</div>}
          </>
        )}
      </div>
    </div>
  );
}
