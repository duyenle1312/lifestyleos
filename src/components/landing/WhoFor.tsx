import { Serif } from "./Serif";

const PERSONAS = [
  {
    title: "Digital nomads",
    body: "New country every few months, new currency every time. One budget that keeps up.",
    who: "Lisbon → Chiang Mai → Mexico City",
  },
  {
    title: "International students",
    body: "A tight budget, a language you're still learning, and a weekly shop to get right.",
    who: "Sofia · Berlin · Seoul",
  },
  {
    title: "Expats & new arrivals",
    body: "Work out what a normal month costs here, from the very first receipt.",
    who: "Moved for work, love, or the weather",
  },
];

export function WhoFor() {
  return (
    <section className="bg-[#14161c] text-[#f3efe6]">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:px-11 md:py-16">
        <h2 className="mb-2.5 text-[30px] leading-[1.08] font-semibold tracking-[-0.02em] md:text-[38px]">
          Made for people <Serif gold>who just moved.</Serif>
        </h2>
        <ul className="mt-6 grid gap-3.5 md:grid-cols-3">
          {PERSONAS.map((p) => (
            <li key={p.title} className="rounded-[18px] bg-[#1f222b] p-5">
              <h3 className="mb-1 text-lg font-semibold">{p.title}</h3>
              <p className="text-sm leading-[1.45] text-[#a9abb3]">{p.body}</p>
              <p className="mt-2.5 text-[13px] font-semibold text-[#a9abb3]">{p.who}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
