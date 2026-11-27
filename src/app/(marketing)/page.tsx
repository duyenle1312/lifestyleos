import type { Metadata, ResolvingMetadata } from "next";
import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { ProofStrip } from "@/components/landing/ProofStrip";
import { StatsBand } from "@/components/landing/StatsBand";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Features } from "@/components/landing/Features";
import { Blocks } from "@/components/landing/Blocks";
import { WhoFor } from "@/components/landing/WhoFor";
import { Faq } from "@/components/landing/Faq";
import { FinalCta } from "@/components/landing/FinalCta";
import { Footer } from "@/components/landing/Footer";
import { ScrollReveal } from "@/components/landing/ScrollReveal";

const title = "Lifestyle OS — budget in any language";
const description =
  "Snap a receipt in any language. Lifestyle OS translates every line into English and adds it to your budget. Free during beta.";

// Setting openGraph/twitter here replaces the parent's objects, which would drop the
// share image from app/opengraph-image.tsx, so carry the parent's images over.
export async function generateMetadata(_props: PageProps<"/">, parent: ResolvingMetadata): Promise<Metadata> {
  const { openGraph, twitter } = await parent;
  return {
    title,
    description,
    openGraph: { type: "website", siteName: "Lifestyle OS", title, description, images: openGraph?.images },
    twitter: { card: "summary_large_image", title, description, images: twitter?.images },
  };
}

export default function LandingPage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <ProofStrip />
        <StatsBand />
        <WhoFor />
        <Features />
        <Blocks />
        <HowItWorks />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
      <ScrollReveal />
    </>
  );
}
