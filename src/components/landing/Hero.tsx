import { HeroCarousel } from "./HeroCarousel";
import { Serif } from "./Serif";
import { SessionCta } from "./SessionCta";

export function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-9 md:pt-15 pb-10 sm:px-6 md:grid-cols-[1.15fr_.85fr] md:gap-6 md:px-11 md:pb-14">
      <div>
        <h1 className="mb-3.5 text-[40px] leading-[1.04] font-semibold tracking-[-0.025em] sm:text-[50px] lg:text-[60px]">
          Read every receipt.
          <br />
          Even the ones you <Serif>can&apos;t.</Serif>
        </h1>
        <p className="max-w-[460px] text-base leading-normal text-[#4a4d57]">
          Just moved abroad? Snap a supermarket receipt in any language. Lifestyle OS translates every line
          into English and adds it to your budget, sorted and totalled.
        </p>
        <div className="mt-5">
          <SessionCta variant="hero" />
        </div>
        <p className="mt-4 text-[13px] text-[#5f626b]">Free during beta · Email sign-in, no password</p>
      </div>

      <div className="justify-self-center">
        <HeroCarousel />
      </div>
    </section>
  );
}
