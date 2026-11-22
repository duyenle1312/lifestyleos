import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Read at build time (this route is statically prerendered). Reuses the
// favicon mark so the share card always matches the app's logo.
const logoSrc = `data:image/svg+xml;base64,${(
  await readFile(join(process.cwd(), "src/app/icon.svg"))
).toString("base64")}`;

// Inter stands in for the app's SF Pro, which can't be embedded. next/og's
// bundled font has a single weight, so bold must be supplied explicitly.
// The README's desktop screenshot (fake demo data), so the card shows the real UI.
const shotSrc = `data:image/png;base64,${(
  await readFile(join(process.cwd(), "docs/screenshots/desktop.png"))
).toString("base64")}`;

const font = (w: number) => readFile(join(process.cwd(), `src/app/fonts/inter-${w}.woff`));
const [inter500, inter700] = await Promise.all([font(500), font(700)]);

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
          position: "relative",
          overflow: "hidden",
          // --bg-grouped (light) in globals.css: warm paper.
          background: "#f6f5f2",
          color: "#000000",
          fontFamily: "Inter",
        }}
      >
        {/* Brand column */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            width: 520,
            paddingLeft: 80,
          }}
        >
          <img src={logoSrc} width={112} height={112} alt="" />
          <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -2, lineHeight: 1, marginTop: 36 }}>
            Lifestyle OS
          </div>
          <div style={{ fontSize: 28, fontWeight: 500, color: "rgba(60, 60, 67, 0.6)", marginTop: 18 }}>
            Your household, in one place.
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 40, width: 400 }}>
            {FEATURES.map((f) => (
              <div
                key={f.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 20px",
                  borderRadius: 999,
                  background: "#ffffff",
                  border: "1px solid rgba(60, 60, 67, 0.12)",
                  fontSize: 22,
                  fontWeight: 500,
                }}
              >
                <div style={{ width: 12, height: 12, borderRadius: 999, background: f.color }} />
                {f.label}
              </div>
            ))}
          </div>
        </div>

        {/* App screenshot, bleeding off the right and bottom edges */}
        <div
          style={{
            position: "absolute",
            left: 568,
            top: 88,
            display: "flex",
            borderRadius: 18,
            overflow: "hidden",
            border: "1px solid rgba(60, 60, 67, 0.14)",
            boxShadow: "0 24px 64px rgba(0, 0, 0, 0.14)",
          }}
        >
          <img src={shotSrc} width={1040} height={650} alt="" />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Inter", data: inter500, weight: 500, style: "normal" },
        { name: "Inter", data: inter700, weight: 700, style: "normal" },
      ],
    },
  );
}
