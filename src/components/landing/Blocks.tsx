import Image from "next/image";
import { PhoneFrame } from "./PhoneFrame";
import { Serif } from "./Serif";
import { revealDelay } from "./revealDelay";

const h2 = "mb-2.5 text-[26px] leading-[1.08] font-semibold tracking-[-0.02em] md:text-[30px]";
const lead = "max-w-[460px] text-base leading-normal text-[#4a4d57]";
const rowBase = "grid items-center gap-9 md:grid-cols-2 [&+&]:border-t [&+&]:border-[#14161c]/[0.08]";
const row = `${rowBase} py-8`;

const CHECKS = [
  "Filter by category, sort by date or payment method",
  "Totals per currency, never mixed together",
  "Search any item, in English",
];

// Shown as plain list rows (status in the app's pantry), never as notifications.
const PANTRY = [
  { item: "Milk", status: "expired yesterday", dot: "bg-[#ff3b30]" },
  { item: "Yogurt", status: "expires in 2 days", dot: "bg-[#ff9500]" },
  { item: "Bread", status: "expires in 3 days", dot: "bg-[#ff9500]" },
  { item: "Rice", status: "good until March", dot: "bg-[#34c759]" },
];

export function Blocks() {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 md:px-11">
      <div id="expenses" className={`${row} scroll-mt-4`}>
        <div data-reveal>
          <h2 className={h2}>
            See where it all <Serif>went.</Serif>
          </h2>
          <p className={lead}>
            Every scanned item lands in your expenses with its shop, date and category. Browse the month by day or
            by card, and see what you spent in each currency.
          </p>
          <ul className="mt-3 space-y-2 text-sm text-[#4a4d57]">
            {CHECKS.map((c) => (
              <li key={c}>
                <span aria-hidden="true" className="mr-2 font-bold text-[#14161c]">
                  ✓
                </span>
                {c}
              </li>
            ))}
          </ul>
        </div>
        <div data-reveal style={revealDelay(1)} className="justify-self-center">
          <PhoneFrame
            src="/landing/expenses-month.png"
            alt="The expenses screen, grouped by day"
            width={780}
            height={1520}
            sizes="190px"
            className="landing-bob w-[170px] lg:w-[190px]"
          />
        </div>
      </div>

      <div id="pantry" className={`${rowBase} scroll-mt-4 py-12 md:py-16`}>
        <ul
          data-reveal
          aria-label="Example pantry items"
          className="order-2 divide-y divide-[#14161c]/[0.08] rounded-[18px] border border-[#14161c]/[0.06] bg-white px-4 md:order-1"
        >
          {PANTRY.map((p) => (
            <li key={p.item} className="flex items-center gap-2.5 py-3 text-sm">
              <span aria-hidden="true" className={`size-2.5 flex-none rounded-full ${p.dot}`} />
              <span>
                <b className="font-semibold">{p.item}</b> {p.status}
              </span>
            </li>
          ))}
        </ul>
        <div data-reveal className="order-1 md:order-2">
          <h2 className={h2}>
            Stop throwing food <Serif>away.</Serif>
          </h2>
          <p className={lead}>
            Unfamiliar labels and unfamiliar date formats make it easy to lose track. Filter the pantry to
            what&apos;s expiring soon and use it first.
          </p>
        </div>
      </div>

      <div className={row}>
        <div data-reveal>
          <h2 className={h2}>
            Works <Serif>offline,</Serif> too.
          </h2>
          <p className={lead}>
            No local SIM yet? Lifestyle OS keeps working offline and syncs when you&apos;re back online. Add it to
            your home screen and it opens like an app.
          </p>
        </div>
        <div data-reveal style={revealDelay(1)}>
          <Image
            src="/landing/desktop.png"
            alt="Lifestyle OS on a laptop, with the split view"
            width={2560}
            height={1600}
            sizes="(min-width: 1280px) 580px, (min-width: 768px) 45vw, 100vw"
            className="landing-bob h-auto w-full rounded-[18px] shadow-[0_18px_40px_rgba(0,0,0,0.12)]"
          />
        </div>
      </div>
    </section>
  );
}
