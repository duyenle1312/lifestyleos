import { Serif } from "./Serif";

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

// Its own gold band between the language strip and the dark "Made for people who just moved" band.
export function StatsBand() {
  return (
    <section aria-labelledby="stats-heading" className="bg-[#e8c37a] text-[#14161c]">
      <div className="mx-auto max-w-7xl px-4 py-12 text-center sm:px-6 md:px-11 md:py-14">
        <h2 id="stats-heading" className="mb-8 text-[22px] font-semibold tracking-[-0.01em] md:text-[24px]">
          Our <Serif>achievements</Serif>
        </h2>
        <dl className="mx-auto grid max-w-4xl grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="flex flex-col-reverse items-center gap-1.5">
              <dt className="text-sm text-[#14161c]/70">{s.label}</dt>
              <dd className="text-[32px] leading-none font-semibold tracking-[-0.02em] md:text-[40px]">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
