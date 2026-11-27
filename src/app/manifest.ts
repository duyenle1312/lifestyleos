import type { MetadataRoute } from "next";

// Makes the app installable ("Add to Home Screen") and launch full-screen without browser chrome.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lifestyle OS",
    short_name: "Lifestyle OS",
    description: "Expense tracking, shopping list, kitchen inventory and receipt scanning.",
    id: "/",
    // "/" is the public landing page; the installed app opens straight into Expenses.
    start_url: "/expenses",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f6f5f2",
    theme_color: "#f6f5f2",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Shopping List", url: "/shopping", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Scan Receipt", url: "/scan", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
