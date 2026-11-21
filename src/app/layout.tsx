import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { AppShell } from "@/components/AppShell";

const description = "Expense tracking, shopping list, kitchen inventory and receipt scanning.";

// Social crawlers need an absolute og:image URL. NEXT_PUBLIC_SITE_URL wins;
// otherwise fall back to Vercel's production domain, then localhost.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Lifestyle OS",
  description,
  applicationName: "Lifestyle OS",
  // Images come from app/opengraph-image.tsx (and icon.svg / apple-icon.tsx).
  openGraph: {
    type: "website",
    siteName: "Lifestyle OS",
    title: "Lifestyle OS",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "Lifestyle OS",
    description,
  },
  appleWebApp: {
    capable: true,
    title: "Lifestyle OS",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full font-sans antialiased">
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
