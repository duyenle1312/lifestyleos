import { Serif } from "./Serif";

// Usage figures, exact as of 2026-11-27 (€ total rounded to the euro). Fixed by hand, so they go
// stale as usage grows. To update, run read-only in Supabase and edit the numbers:
//   select (select count(*) from expenses where deleted_at is null),
//          (select sum(amount) from expenses where deleted_at is null and upper(currency) = 'EUR'),
//          (select count(*) from inventory_items), (select count(*) from shopping_lists);
const STATS = [
  { value: "1,172", label: "expenses logged" },
  { value: "€10,777", label: "tracked" },
  { value: "163", label: "pantry items" },
  { value: "164", label: "shopping-list items" },
];

// A dark band with gold figures, between the language strip and the dark "Made for people who just
// moved" band; a hairline at the bottom keeps the two dark bands apart.
export function StatsBand() {
  return (
    <section aria-labelledby="stats-heading" className="border-b border-white/10 bg-[#14161c] text-[#f3efe6]">
      <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 md:px-11 md:py-20">
        <h2 id="stats-heading" className="mb-12 text-[30px] leading-[1.08] font-semibold tracking-[-0.02em] md:mb-14 md:text-[38px]">
          Our <Serif gold>achievements</Serif>
        </h2>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-12 lg:grid-cols-4 xl:gap-x-12">
          {STATS.map((s) => (
            <div key={s.label} className="flex flex-col-reverse items-center gap-3">
              <dt className="text-sm text-[#a9abb3] md:text-base">{s.label}</dt>
              <dd className="text-[40px] leading-none font-semibold tracking-[-0.03em] text-[#e8c37a] md:text-[52px] lg:text-[48px] xl:text-[60px]">{s.value}+</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
