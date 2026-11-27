import Image from "next/image";
import { Serif } from "./Serif";

const h2 = "mb-2.5 text-[26px] leading-[1.08] font-semibold tracking-[-0.02em] md:text-[30px]";
const lead = "max-w-[460px] text-base leading-normal text-[#4a4d57]";
const row = "grid items-center gap-9 py-8 md:grid-cols-2 [&+&]:border-t [&+&]:border-[#14161c]/[0.08]";

const CHECKS = [
  "Store, date and total picked up automatically",
  "Categories you choose, not ours",
  "Edit any line before saving",
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
    <section className="mx-auto max-w-6xl px-4 pb-6 sm:px-6 md:px-11">
      <div className={row}>
        <div>
          <h2 className={h2}>
            Check it before <Serif>it counts.</Serif>
          </h2>
          <p className={lead}>
            See every translated line next to its price. Rename it, change the category or fix the amount, then
            add the whole receipt at once.
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
        <Image
          src="/landing/scan.png"
          alt="Reviewing a scanned receipt before saving"
          width={780}
          height={1370}
          sizes="190px"
          className="h-auto w-[170px] justify-self-center rounded-3xl border-[6px] border-[#111] shadow-[0_18px_40px_rgba(0,0,0,0.12)] lg:w-[190px]"
        />
      </div>

      <div className={row}>
        <ul
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
        <div className="order-1 md:order-2">
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
        <div>
          <h2 className={h2}>
            Works on the <Serif>metro,</Serif> too.
          </h2>
          <p className={lead}>
            No local SIM yet? Lifestyle OS keeps working offline and syncs when you&apos;re back online. Add it to
            your home screen and it opens like an app.
          </p>
        </div>
        <Image
          src="/landing/desktop.png"
          alt="Lifestyle OS on a laptop, with the split view"
          width={2560}
          height={1600}
          sizes="(min-width: 1152px) 520px, (min-width: 768px) 45vw, 100vw"
          className="h-auto w-full rounded-[18px] shadow-[0_18px_40px_rgba(0,0,0,0.12)]"
        />
      </div>
    </section>
  );
}
