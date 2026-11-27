import { Serif } from "./Serif";

// Usage figures, exact as of 2026-11-27 (€ total rounded to the euro). Fixed by hand, so they go
// stale as usage grows. To update, run read-only in Supabase and edit the numbers:
//   select (select count(*) from expenses where deleted_at is null),
//          (select sum(amount) from expenses where deleted_at is null and upper(currency) = 'EUR'),
//          (select count(*) from inventory_items), (select count(*) from shopping_lists);
const STATS = [
  { value: "1,172", label: "Expenses Logged" },
  { value: "€10,777", label: "Tracked" },
  { value: "163", label: "Pantry Items" },
  { value: "164", label: "Shopping List Items" },
];

// Gold figures on the page's cream background (like the hero), between the language strip and the dark
// "Made for people who just moved" band.
export function StatsBand() {
  return (
    <section aria-labelledby="stats-heading" className="text-[#14161c]">
      <div className="mx-auto max-w-7xl px-4 pt-4 pb-16 text-center sm:px-6 md:px-11 md:pt-6 md:pb-20">
        <h2 id="stats-heading" className="mb-12 text-[30px] leading-[1.08] font-semibold tracking-[-0.02em] md:mb-14 md:text-[38px]">
          Our <Serif><span className="bg-linear-to-b from-[#f2bf4a] via-[#e2a52c] to-[#cf9019] bg-clip-text pr-1 text-transparent">Achievements</span></Serif>
        </h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-8 sm:gap-y-12 lg:grid-cols-4 xl:gap-x-12">
          {STATS.map((s) => (
            <div key={s.label} className="flex flex-col-reverse items-center gap-3">
              <dt className="text-[13px] font-semibold text-[#7a7d86] md:text-sm">{s.label}</dt>
              <dd className="text-[clamp(26px,8.5vw,40px)] bg-linear-to-b from-[#f2bf4a] via-[#e2a52c] to-[#cf9019] bg-clip-text pb-1 leading-none font-bold tracking-[-0.03em] text-transparent md:text-[52px] lg:text-[48px] xl:text-[60px]">{s.value}+</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
