import { Instrument_Serif } from "next/font/google";

const serif = Instrument_Serif({
  weight: "400",
  style: "italic",
  subsets: ["latin"],
  variable: "--font-serif",
  fallback: ["Iowan Old Style", "Georgia", "serif"],
});

// Public pages: no auth, no app chrome. The palette is hard-coded (not the app's
// CSS variables) and color-scheme is light, so the app's dark theme can't leak in.
export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div
      className={`${serif.variable} min-h-screen bg-[#fbf8f2] font-sans text-[#14161c] [color-scheme:light]`}
    >
      {children}
    </div>
  );
}
