import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/siteUrl";

// Public pages only; the app screens sit behind sign-in.
export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/privacy", "/terms"].map((path) => ({ url: new URL(path, siteUrl).toString() }));
}
