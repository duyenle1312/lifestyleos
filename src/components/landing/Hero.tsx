import Image from "next/image";
import { Serif } from "./Serif";
import { SessionCta } from "./SessionCta";

// Illustrative lines for the floating card: original (as printed) above the English name.
const LINES = [
  { original: "Кисело мляко", lang: "bg", english: "Yogurt", price: "€1.29" },
  { original: "ข้าวหอมมะลิ", lang: "th", english: "Jasmine rice", price: "฿89" },
  { original: "Hafermilch", lang: "de", english: "Oat milk", price: "€1.95" },
];

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
        <p className="mt-2.5 text-[13px] text-[#5f626b]">Free during beta · Email sign-in, no password</p>
      </div>

      {/* Phone + floating card. Below lg the card sits under the phone and overlaps its
          lower edge; from lg it floats out to the left as in the mockup. */}
      <div className="relative flex flex-col items-center justify-self-center">
        <Image
          src="/landing/scan.png"
          alt="The Lifestyle OS scan screen on a phone"
          width={780}
          height={1370}
          preload
          sizes="220px"
          className="h-auto w-[200px] rounded-[30px] border-[7px] border-[#111] shadow-[0_30px_60px_rgba(0,0,0,0.18)] lg:w-[220px]"
        />
        <ul
          aria-label="Example receipt lines, translated"
          className="relative -mt-20 w-[240px] rounded-2xl bg-white px-3.5 py-3 text-[13px] shadow-[0_18px_40px_rgba(0,0,0,0.16)] lg:absolute lg:bottom-[50px] lg:-left-[118px] lg:mt-0"
        >
          {LINES.map((line) => (
            <li
              key={line.english}
              className="flex items-end justify-between gap-3 border-b border-black/[0.06] py-[5px] last:border-0"
            >
              <span>
                <span lang={line.lang} className="block text-[11px] text-[#6b6e78]">
                  {line.original}
                </span>
                <b className="font-semibold">{line.english}</b>
              </span>
              <span>{line.price}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
