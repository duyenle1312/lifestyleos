import { Serif } from "./Serif";

const STEPS = [
  { num: "01", title: "Snap", body: "Photograph any receipt from any shop, in any country." },
  {
    num: "02",
    title: "Translated",
    body: "Every item comes back in plain English with a category. Fix anything before you save.",
  },
  { num: "03", title: "Budgeted", body: "One tap adds it all to your expenses, in the shop's own currency." },
];

export function HowItWorks() {
  return (
    <section id="scan" className="scroll-mt-4 bg-[#14161c] text-[#f3efe6]">
      <div className="mx-auto max-w-7xl px-4 py-18 sm:px-6 md:px-11 md:py-20">
        <h2 className="mb-2.5 text-[30px] leading-[1.08] font-semibold tracking-[-0.02em] md:text-[38px]">
          Settling in is hard. <Serif gold>Budgeting shouldn&apos;t be.</Serif>
        </h2>
        <ol className="mt-10 grid gap-3.5 md:grid-cols-3 md:mt-12">
          {STEPS.map((s) => (
            <li key={s.num} className="rounded-[18px] bg-[#1f222b] p-5">
              <span className="text-xs font-bold text-[#8d8f98]">{s.num}</span>
              <h3 className="mt-2.5 mb-1 text-lg font-semibold">{s.title}</h3>
              <p className="text-sm leading-[1.45] text-[#a9abb3]">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
