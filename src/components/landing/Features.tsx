import { Coins, CreditCard, Euro, ListChecks, MonitorSmartphone, Timer } from "lucide-react";
import { Serif } from "./Serif";

const FEATURES = [
  { icon: Euro, title: "Expenses", body: "By category and payment method, month by month." },
  {
    icon: Coins,
    title: "Any currency",
    body: "Euros, baht, dong, pesos. Log each expense in the currency you paid in.",
  },
  { icon: ListChecks, id: "shopping", title: "Shopping list", body: "Tick things off in the shop, even with no signal." },
  { icon: Timer, title: "Pantry", body: "Track what's at home and when it expires." },
  {
    icon: CreditCard,
    title: "Cards & cash",
    body: "Your home bank card, the new local one, and cash, kept apart.",
  },
  { icon: MonitorSmartphone, title: "Phone or laptop", body: "Same data everywhere. A split view on bigger screens." },
];

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-4 px-4 py-14 sm:px-6 md:px-11 md:py-16">
      <h2 className="mb-2.5 text-[30px] leading-[1.08] font-semibold tracking-[-0.02em] md:text-[38px]">
        Your whole new life, <Serif>in one place.</Serif>
      </h2>
      <p className="max-w-[460px] text-base leading-normal text-[#4a4d57]">
        Receipts are where it starts. Everything else you need for a new home is here too.
      </p>
      <ul className="mt-6 grid gap-3.5 sm:grid-cols-2 md:grid-cols-3">
        {FEATURES.map(({ icon: Icon, id, title, body }) => (
          <li key={title} id={id} className="scroll-mt-4 rounded-[18px] border border-[#14161c]/[0.06] bg-white p-5">
            <div className="flex size-[34px] items-center justify-center rounded-[10px] bg-[#efe9dd]">
              <Icon aria-hidden="true" size={17} strokeWidth={2} />
            </div>
            <h3 className="mt-2.5 mb-1 text-lg font-semibold">{title}</h3>
            <p className="text-sm leading-[1.45] text-[#6b6e78]">{body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
