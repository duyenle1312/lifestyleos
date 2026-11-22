"use client";

// Inspector placeholder when no expense is selected: month total + category breakdown.
import { TrendingDown, TrendingUp } from "lucide-react";
import { IconBubble } from "@/components/glyphs";
import { categoryVisual } from "@/lib/categoryStyle";
import { addMonths, formatMonthDay, isSameMonth } from "@/lib/helpers";
import type { Category, Expense } from "@/lib/types";
import { Section } from "../ui";

const sum = (rows: Expense[]) => rows.reduce((total, e) => total + e.amount, 0);

/**
 * Month-over-month change. For the current (partial) month it compares against the same days of the
 * previous month – otherwise every month would look like a big drop until its last day.
 */
function comparison(month: Date, total: number, previous: Expense[] | null) {
  if (!previous) return null;
  const prevMonth = addMonths(month, -1);
  const today = new Date();
  const partial = isSameMonth(month, today);
  const cutoff = today.getDate();
  const base = sum(partial ? previous.filter((e) => new Date(e.expense_date).getDate() <= cutoff) : previous);
  if (base === 0) return null;
  const lastDay = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0).getDate();
  const label = partial
    ? `vs ${formatMonthDay(prevMonth)}–${Math.min(cutoff, lastDay)}`
    : `vs ${prevMonth.toLocaleDateString("en-US", { month: "long" })}`;
  return { change: (total - base) / base, label };
}

/** Bare stat (no card): sits on the grouped background so it informs without competing with the breakdown. */
function Stat({ title, value, unit, footer }: { title: string; value: string; unit?: string; footer: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[13px] text-label-2">{title}</p>
      <p className="mt-0.5 truncate text-[18px] font-semibold tabular-nums @md:text-[22px]">
        {value}
        {unit && <span className="ml-1 text-[13px] font-medium text-label-2 @md:text-[15px]">{unit}</span>}
      </p>
      <div className="mt-0.5 text-[12px] text-label-2 @md:text-[13px]">{footer}</div>
    </div>
  );
}

export function MonthSummary({
  month,
  expenses,
  previous,
  byId,
  onSelectCategory,
}: {
  month: Date;
  /** This month's expenses, already category/search filtered. */
  expenses: Expense[];
  /** Previous month with the same filters; null while loading or unavailable. */
  previous: Expense[] | null;
  byId: Map<string, Category>;
  /** Clicking a breakdown row filters the list by that category. */
  onSelectCategory: (categoryId: string) => void;
}) {
  const total = sum(expenses);
  const isCurrentMonth = isSameMonth(month, new Date());
  const days = isCurrentMonth
    ? new Date().getDate()
    : new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const delta = comparison(month, total, previous);
  // Spending less is good news: down = green, up = orange.
  const DeltaIcon = delta && delta.change > 0 ? TrendingUp : TrendingDown;

  // Group by category id; expenses without a (known) category share one "Uncategorized" group.
  const groups = new Map<string, { id?: string; name: string; category?: Category; amount: number; count: number }>();
  for (const e of expenses) {
    const category = e.category_id ? byId.get(e.category_id) : undefined;
    const key = e.category_id ?? "none";
    const g = groups.get(key) ?? { id: category?.id, name: category?.name ?? "Uncategorized", category, amount: 0, count: 0 };
    g.amount += e.amount;
    g.count += 1;
    groups.set(key, g);
  }
  const rows = [...groups.values()].sort((a, b) => b.amount - a.amount);
  const max = rows[0]?.amount ?? 0;

  return (
    <div className="animate-fade-in pb-8">
      <div className="@container px-8 pt-7">
        <div className="grid grid-cols-3 gap-4">
          <Stat
            title={`Total (${month.toLocaleDateString("en-US", { month: "short" })})`}
            value={total.toFixed(2)}
            unit="EUR"
            footer={
              delta ? (
                <span title="Same filters, compared with the previous month">
                  <span className={delta.change > 0 ? "text-ios-orange" : "text-ios-green"}>
                    <DeltaIcon size={13} className="mr-0.5 inline align-[-2px]" />
                    {Math.abs(delta.change * 100).toFixed(1)}%
                  </span>{" "}
                  <span className="whitespace-nowrap">{delta.label}</span>
                </span>
              ) : (
                "No data for last month"
              )
            }
          />
          <Stat
            title="Daily Average"
            value={(total / days).toFixed(2)}
            unit="EUR"
            footer={isCurrentMonth ? `${days} ${days === 1 ? "day" : "days"} elapsed` : `${days} days`}
          />
          <Stat
            title="Transactions"
            value={String(expenses.length)}
            footer={
              expenses.length ? (
                <>
                  avg {(total / expenses.length).toFixed(2)}
                  <span className="hidden @md:inline"> EUR each</span>
                </>
              ) : (
                "None yet"
              )
            }
          />
        </div>
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
