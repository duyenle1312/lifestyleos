import { Coins, House, Mail, WifiOff } from "lucide-react";

const LANGUAGES = [
  { name: "Български", lang: "bg" },
  { name: "Deutsch", lang: "de" },
  { name: "ไทย", lang: "th" },
  { name: "Tiếng Việt", lang: "vi" },
  { name: "日本語", lang: "ja" },
  { name: "Español", lang: "es" },
  { name: "Polski", lang: "pl" },
  { name: "Türkçe", lang: "tr" },
  { name: "Português", lang: "pt" },
  { name: "한국어", lang: "ko" },
];

// Usage figures, rounded down so they stay true as usage grows. Fixed by hand, as of 2026-11-27
// (actual: 1,172 expenses, €10,777, 163 pantry items, 164 shopping-list items). To update, run
// read-only in Supabase and edit the numbers:
//   select (select count(*) from expenses where deleted_at is null),
//          (select sum(amount) from expenses where deleted_at is null and upper(currency) = 'EUR'),
//          (select count(*) from inventory_items), (select count(*) from shopping_lists);
const STATS = [
  { value: "1,100+", label: "expenses logged" },
  { value: "€10,000+", label: "tracked" },
  { value: "160+", label: "pantry items" },
  { value: "160+", label: "shopping-list items" },
];

const FACTS = [
  { icon: WifiOff, label: "Works offline" },
  { icon: House, label: "Installs to your home screen" },
  { icon: Mail, label: "No password needed" },
  { icon: Coins, label: "20+ currencies" },
];

export function ProofStrip() {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-5 pb-12 text-center sm:px-6 md:px-11">
      <p className="mb-3.5 text-sm text-[#6b6e78]">Reads receipts in</p>
      <ul className="flex flex-wrap justify-center gap-2 text-sm">
        {LANGUAGES.map((l) => (
          <li key={l.lang} lang={l.lang} className="rounded-full bg-[#efe9dd] px-3 py-1.5">
            {l.name}
          </li>
        ))}
        <li className="rounded-full bg-[#efe9dd] px-3 py-1.5">+ any language</li>
      </ul>
      <dl className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="flex flex-col-reverse items-center gap-1">
            <dt className="text-sm text-[#6b6e78]">{s.label}</dt>
            <dd className="text-[28px] leading-none font-semibold tracking-[-0.02em] text-[#14161c] md:text-[32px]">
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
      <ul className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-[#4a4d57]">
        {FACTS.map(({ icon: Icon, label }) => (
          <li key={label} className="inline-flex items-center gap-1.5">
            <Icon aria-hidden="true" size={15} strokeWidth={2} />
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}
