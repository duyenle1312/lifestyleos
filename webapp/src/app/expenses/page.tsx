"use client";

// Port of Views/Expenses/ExpenseListView.swift + ExpenseViewModel.swift
import { useEffect, useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Inbox, Plus } from "lucide-react";
import { useUser } from "@/components/AuthProvider";
import { ExpenseDetail } from "@/components/expenses/ExpenseDetail";
import { ExpenseForm } from "@/components/expenses/ExpenseForm";
import { MonthPicker } from "@/components/expenses/MonthPicker";
import { FilterGlyph, IconBubble } from "@/components/glyphs";
import { EmptyState, ErrorBanner, IconButton, Menu, SearchBar, Section, Spinner, SwipeRow, Toolbar } from "@/components/ui";
import { useCategories } from "@/components/CategoriesProvider";
import { categoryColor, categoryIcon, iosColor } from "@/lib/constants";
import {
  addMonths,
  errorMessage,
  formatMonthYear,
  formatSectionDate,
  isSameMonth,
  startOfDay,
  startOfMonth,
} from "@/lib/helpers";
import * as api from "@/lib/services";
import type { Expense } from "@/lib/types";

const byDateDesc = (a: Expense, b: Expense) => b.expense_date.localeCompare(a.expense_date);

export default function ExpensesPage() {
  const user = useUser();
  const { names: categoryNames } = useCategories();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [expenses, setExpenses] = useState<Expense[]>([]);
  /** Month (timestamp) the current `expenses` were loaded for; loading = it differs from the selected month. */
  const [loadedMonth, setLoadedMonth] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // loadExpenses(accountId:month:) – refetch whenever the month changes, ignoring stale responses.
  useEffect(() => {
    let cancelled = false;
    api
      .fetchExpensesByDateRange(user.id, month, addMonths(month, 1))
      .then((rows) => !cancelled && setExpenses(rows))
      .catch((e) => !cancelled && setError(errorMessage(e)))
      .finally(() => !cancelled && setLoadedMonth(month.getTime()));
    return () => {
      cancelled = true;
    };
  }, [user.id, month]);

  const isLoading = loadedMonth !== month.getTime();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => {
      if (!isSameMonth(new Date(e.expense_date), month)) return false;
      if (category !== "All" && e.category !== category) return false;
      if (!q) return true;
      return [e.item, e.description, e.location].some((f) => f?.toLowerCase().includes(q));
    });
  }, [expenses, month, category, search]);

  const groups = useMemo(() => {
    const map = new Map<number, Expense[]>();
    for (const e of filtered) {
      const key = startOfDay(new Date(e.expense_date)).getTime();
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [filtered]);

  const total = filtered.reduce((sum, e) => sum + e.amount, 0).toFixed(2);
  const isCurrentMonth = isSameMonth(month, new Date());
  const selected = expenses.find((e) => e.id === selectedId) ?? null;

  // MARK: - Mutations (ExpenseViewModel)

  const add = async (input: api.ExpenseInput) => {
    try {
      const created = await api.createExpense(user.id, input);
      setExpenses((list) => [...list, created].sort(byDateDesc));
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    }
  };

  const update = async (id: string, input: api.ExpenseInput) => {
    try {
      const updated = await api.updateExpense(id, input);
      setExpenses((list) => list.map((e) => (e.id === id ? updated : e)));
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    }
  };

  const remove = async (id: string) => {
    try {
      await api.deleteExpense(id);
      setExpenses((list) => list.filter((e) => e.id !== id));
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <>
      <Toolbar
        left={
          <Menu
            label="Filter by category"
            trigger={
              <>
                <FilterGlyph active={category !== "All"} />
                {category !== "All" && <span className="text-xs">{category}</span>}
              </>
            }
            entries={["All", ...categoryNames].map((c) => ({
              label: c,
              selected: c === category,
              onSelect: () => setCategory(c),
            }))}
          />
        }
        right={<IconButton icon={Plus} label="Add expense" onClick={() => setShowAdd(true)} />}
      >
        <SearchBar value={search} onChange={setSearch} placeholder="Search expenses" />
      </Toolbar>

      {/* Summary card */}
      <p className="py-0.5 text-center text-[22px] font-semibold">{total} EUR</p>

      {/* Month selector */}
      <div className="flex items-center justify-between px-4 py-2">
        <button
          type="button"
          aria-label="Previous month"
          className="flex size-9 items-center justify-center text-ios-blue"
          onClick={() => setMonth(addMonths(month, -1))}
        >
          <ChevronLeft size={20} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          className="flex items-center gap-2 text-[18px] font-semibold"
          onClick={() => setShowMonthPicker(true)}
        >
          {formatMonthYear(month)}
          <Calendar size={17} />
        </button>
        <button
          type="button"
          aria-label="Next month"
          disabled={isCurrentMonth}
          className="flex size-9 items-center justify-center text-ios-blue disabled:opacity-30"
          onClick={() => setMonth(addMonths(month, 1))}
        >
          <ChevronRight size={20} strokeWidth={2.5} />
        </button>
      </div>

      {isLoading ? (
        <div className="flex min-h-[50dvh] items-center justify-center">
          <Spinner />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={search ? "No matching expenses" : "No expenses yet"}
          subtitle={search ? undefined : "Tap + to add your first expense"}
        />
      ) : (
        <div className="pb-6">
          {groups.map(([day, items]) => (
            <Section key={day} header={formatSectionDate(new Date(day))} inset={74} className="first:pt-2">
              {items.map((e) => (
                <SwipeRow key={e.id} onDelete={() => remove(e.id)} onPress={() => setSelectedId(e.id)}>
                  <ExpenseRow expense={e} />
                </SwipeRow>
              ))}
            </Section>
          ))}
        </div>
      )}

      {showAdd && <ExpenseForm onSave={add} onClose={() => setShowAdd(false)} />}
      {selected && (
        <ExpenseDetail expense={selected} onClose={() => setSelectedId(null)} onUpdate={update} onDuplicate={add} />
      )}
      {showMonthPicker && (
        <MonthPicker selected={month} onSelect={setMonth} onClose={() => setShowMonthPicker(false)} />
      )}
      <ErrorBanner message={error} onDismiss={() => setError(null)} />
    </>
  );
}

function ExpenseRow({ expense }: { expense: Expense }) {
  const meta = [expense.location, expense.payment_method].filter(Boolean).join(" • ");
  return (
    <div className="flex items-center gap-3 px-[18px] py-3">
      <IconBubble icon={categoryIcon(expense.category)} color={iosColor(categoryColor(expense.category))} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] font-semibold">{expense.item ?? expense.category ?? "Expense"}</p>
        {meta && <p className="mt-1 truncate text-[13px] text-label-2">{meta}</p>}
      </div>
      <div className="text-right">
        <p className="text-[16px] font-bold">{expense.amount.toFixed(2)}</p>
        <p className="mt-1 text-[12px] text-label-2">{expense.currency}</p>
      </div>
    </div>
  );
}
