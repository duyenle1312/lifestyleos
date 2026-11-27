import type { ReactNode } from "react";
import { Nav } from "./Nav";
import { Footer } from "./Footer";
import { Serif } from "./Serif";

export function LegalPage({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: ReactNode;
}) {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-2xl px-4 pt-6 pb-12 sm:px-6 md:pt-10">
        <h1 className="text-[34px] leading-[1.08] font-semibold tracking-[-0.02em] md:text-[44px]">
          {title} <Serif>{accent}</Serif>
        </h1>
        <p className="mt-3 text-[13px] text-[#6b6e78]">Last updated 27 November 2026</p>
        <div className="mt-8 space-y-4 text-[15px] leading-relaxed text-[#14161c]/85 [&_a]:underline [&_a]:underline-offset-2 [&_h2]:pt-4 [&_h2]:text-[20px] [&_h2]:font-semibold [&_h2]:text-[#14161c] [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
          {children}
        </div>
      </main>
      <Footer />
    </>
  );
}
