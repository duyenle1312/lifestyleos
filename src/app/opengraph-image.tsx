import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Read at build time (this route is statically prerendered).
const logoSrc = `data:image/png;base64,${(
  await readFile(join(process.cwd(), "public/logo.png"))
).toString("base64")}`;

export const alt = "Lifestyle OS — expense tracking, shopping list, kitchen inventory and receipt scanning";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FEATURES = [
  { label: "Expenses", color: "#34c759" },
  { label: "Shopping", color: "#ff9500" },
  { label: "Inventory", color: "#007aff" },
  { label: "Receipt scan", color: "#af52de" },
];

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: "#f2f2f7",
          color: "#000000",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          <img src={logoSrc} width={200} height={200} alt="" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: -3, lineHeight: 1 }}>
              Lifestyle OS
            </div>
            <div style={{ fontSize: 36, color: "rgba(60, 60, 67, 0.6)", marginTop: 16 }}>
              Your household, in one place.
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 20, marginTop: 72 }}>
          {FEATURES.map((f) => (
            <div
              key={f.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "16px 28px",
                borderRadius: 999,
                background: "#ffffff",
                fontSize: 30,
                fontWeight: 600,
              }}
            >
              <div style={{ width: 18, height: 18, borderRadius: 999, background: f.color }} />
              {f.label}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
