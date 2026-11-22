import type { NextConfig } from "next";

// Auth and data loading happen in the browser (supabase-js), so the
// scaffold's cacheComponents / partialPrefetching are left off: the server only renders the shell.
const nextConfig: NextConfig = {
  // Open on the Expenses tab.
  async redirects() {
    return [{ source: "/", destination: "/expenses", permanent: false }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
