import type { Metadata, Viewport } from "next";
import "./globals.css";
import { THEME_SCRIPT } from "@/lib/theme";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { siteUrl } from "@/lib/siteUrl";

const description = "Expense tracking, shopping list, kitchen inventory and receipt scanning.";

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
    { media: "(prefers-color-scheme: light)", color: "#f6f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full font-sans antialiased">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
