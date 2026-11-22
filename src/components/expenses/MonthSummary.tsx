"use client";

// Inspector placeholder when no expense is selected: month total + category breakdown.
import { IconBubble } from "@/components/glyphs";
import { categoryVisual } from "@/lib/categoryStyle";
import type { Category, Expense } from "@/lib/types";
import { Section } from "../ui";

export function MonthSummary({
  monthLabel,
  expenses,
  byId,
  onSelectCategory,
}: {
  monthLabel: string;
  expenses: Expense[];
  byId: Map<string, Category>;
  /** Clicking a breakdown row filters the list by that category. */
  onSelectCategory: (categoryId: string) => void;
}) {
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Group by category id; legacy rows without an id are grouped by their free-text name.
  const groups = new Map<string, { id?: string; name: string; category?: Category; amount: number; count: number }>();
  for (const e of expenses) {
    const category = e.category_id ? byId.get(e.category_id) : undefined;
    const key = category?.id ?? `legacy:${e.category ?? ""}`;
    const g = groups.get(key) ?? { id: category?.id, name: category?.name ?? e.category ?? "Uncategorized", category, amount: 0, count: 0 };
    g.amount += e.amount;
    g.count += 1;
    groups.set(key, g);
  }
  const rows = [...groups.values()].sort((a, b) => b.amount - a.amount);
  const max = rows[0]?.amount ?? 0;

  return (
    <div className="animate-fade-in pb-8">
      <div className="px-8 pt-8 pb-2">
        <p className="text-[13px] uppercase text-label-2">{monthLabel}</p>
        <p className="text-[34px] font-bold leading-tight tabular-nums">
          {total.toFixed(2)} <span className="text-[20px] font-semibold text-label-2">EUR</span>
        </p>
        <p className="text-[15px] text-label-2">
          {expenses.length} {expenses.length === 1 ? "expense" : "expenses"}
        </p>
      </div>

      {rows.length > 0 && (
        <Section header="By Category" inset={68}>
          {rows.map((r) => {
            const { Icon, color } = categoryVisual(r.category);
            const content = (
              <>
                <IconBubble icon={Icon} color={color} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[16px] font-medium">{r.name}</span>
                    <span className="text-[15px] font-semibold tabular-nums">{r.amount.toFixed(2)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fill">
                      <div className="h-full rounded-full" style={{ width: `${(r.amount / max) * 100}%`, backgroundColor: color }} />
                    </div>
                    <span className="w-10 text-right text-[12px] text-label-2 tabular-nums">
                      {total > 0 ? Math.round((r.amount / total) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </>
            );
            return r.id ? (
              <button
                key={r.id}
                type="button"
                onClick={() => onSelectCategory(r.id!)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-[color-mix(in_srgb,var(--bg-cell),var(--label)_4%)]"
              >
                {content}
              </button>
            ) : (
              <div key={r.name} className="flex items-center gap-3 px-3 py-2.5">
                {content}
              </div>
            );
          })}
        </Section>
      )}

      <p className="px-8 pt-6 text-[13px] text-label-3">
        Select an expense to see its details. <kbd className="font-sans">↑</kbd> <kbd className="font-sans">↓</kbd> to
        move, <kbd className="font-sans">N</kbd> to add, <kbd className="font-sans">/</kbd> to search.
      </p>
    </div>
  );
}
