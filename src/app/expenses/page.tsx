"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpDown,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Copy,
  CreditCard,
  Inbox,
  List,
  ListFilter,
  PanelRight,
  Pencil,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import { useUser } from "@/components/AuthProvider";
import { ExpenseDetail, ExpenseInspector } from "@/components/expenses/ExpenseDetail";
import { MonthSummary } from "@/components/expenses/MonthSummary";
import { ExpenseForm } from "@/components/expenses/ExpenseForm";
import { MonthPicker } from "@/components/expenses/MonthPicker";
import { FilterGlyph, IconBubble } from "@/components/glyphs";
import { ThemeMenu } from "@/components/ThemeMenu";
import {
  Alert,
  ContextMenu,
  type ContextMenuState,
  EmptyState,
  ErrorBanner,
  IconButton,
  Menu,
  type MenuEntry,
  SearchBar,
  Section,
  Spinner,
  SwipeRow,
  Toolbar,
} from "@/components/ui";
import { useCategories } from "@/components/CategoriesProvider";
import { usePaymentMethods } from "@/components/PaymentMethodsProvider";
import { categoryVisual } from "@/lib/categoryStyle";
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
import { FINE_POINTER_QUERY, SPLIT_VIEW_QUERY, useMediaQuery } from "@/lib/useMediaQuery";
import type { Category, Expense } from "@/lib/types";

const byDateDesc = (a: Expense, b: Expense) => b.expense_date.localeCompare(a.expense_date);

type SortOption = "date" | "payment";

const SORTS = [
  { value: "date", label: "Date", icon: Calendar },
  { value: "payment", label: "Payment Method", icon: CreditCard },
] as const;

const NO_PAYMENT_METHOD = "No Payment Method";

export default function ExpensesPage() {
  const user = useUser();
  const router = useRouter();
  const { categories, byId } = useCategories();
  const { byId: paymentById } = usePaymentMethods();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [expenses, setExpenses] = useState<Expense[]>([]);
  /** Month (timestamp) the current `expenses` were loaded for; loading = it differs from the selected month. */
  const [loadedMonth, setLoadedMonth] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  /** "all" or a category id. */
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sort, setSort] = useState<SortOption>("date");
  const [showAdd, setShowAdd] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  /** lg+: list and inspector side by side instead of a detail sheet. */
  const isSplit = useMediaQuery(SPLIT_VIEW_QUERY);
  const hasFinePointer = useMediaQuery(FINE_POINTER_QUERY);
  // Collapsing split → stacked (window resize, iPad rotation) must not pop the inspector's selection
  // open as a modal sheet. Adjusted during render, React's recommended alternative to a state-syncing effect.
  const [wasSplit, setWasSplit] = useState(isSplit);
  if (wasSplit !== isSplit) {
    setWasSplit(isSplit);
    if (!isSplit) setSelectedId(null);
  }

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

  // Previous month, for the overview's "vs last month" comparison (split view only).
  // Best-effort: on failure the comparison is simply omitted rather than raising an error alert.
  const [previous, setPrevious] = useState<{ month: number; rows: Expense[] } | null>(null);
  useEffect(() => {
    if (!isSplit) return;
    let cancelled = false;
    const prevMonth = addMonths(month, -1);
    api
      .fetchExpensesByDateRange(user.id, prevMonth, month)
      .then((rows) => !cancelled && setPrevious({ month: prevMonth.getTime(), rows }))
      .catch((e) => console.warn("Previous month comparison unavailable:", e));
    return () => {
      cancelled = true;
    };
  }, [user.id, month, isSplit]);

  const isLoading = loadedMonth !== month.getTime();

  /** Category + search filter, shared by the list and the previous-month comparison. */
  const matchesFilters = useCallback(
    (e: Expense) => {
      if (categoryFilter !== "all" && e.category_id !== categoryFilter) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return [e.item, e.description, e.location].some((f) => f?.toLowerCase().includes(q));
    },
    [categoryFilter, search],
  );

  const filtered = useMemo(
    () => expenses.filter((e) => isSameMonth(new Date(e.expense_date), month) && matchesFilters(e)),
    [expenses, month, matchesFilters],
  );

  const previousFiltered = useMemo(() => {
    const prevMonth = addMonths(month, -1);
    if (previous?.month !== prevMonth.getTime()) return null;
    return previous.rows.filter((e) => isSameMonth(new Date(e.expense_date), prevMonth) && matchesFilters(e));
  }, [previous, month, matchesFilters]);

  /** Sections of [key, header, expenses]: by day (newest first) or by payment method (A–Z, none last). */
  const groups = useMemo(() => {
    const map = new Map<string | number, Expense[]>();
    for (const e of [...filtered].sort(byDateDesc)) {
      const key = sort === "date" ? startOfDay(new Date(e.expense_date)).getTime() : (e.payment_method_id && paymentById.has(e.payment_method_id) ? e.payment_method_id : "");
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    const entries = [...map.entries()];
    if (sort === "date") {
      return entries
        .sort((a, b) => (b[0] as number) - (a[0] as number))
        .map(([day, items]) => ({ key: String(day), header: formatSectionDate(new Date(day)), items }));
    }
    const nameOf = (id: string | number) => paymentById.get(String(id))?.name ?? "";
    return entries
      .sort(([a], [b]) => {
        const [na, nb] = [nameOf(a), nameOf(b)];
        return na === "" ? 1 : nb === "" ? -1 : na.localeCompare(nb);
      })
      .map(([method, items]) => ({
        key: `pm:${method}`,
        header: (
          <span className="flex justify-between">
            <span>{nameOf(method) || NO_PAYMENT_METHOD}</span>
            <span>{items.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}</span>
          </span>
        ),
        items,
      }));
  }, [filtered, sort, paymentById]);

  const total = filtered.reduce((sum, e) => sum + e.amount, 0).toFixed(2);
  const isCurrentMonth = isSameMonth(month, new Date());
  const selected = filtered.find((e) => e.id === selectedId) ?? null;
  const editing = expenses.find((e) => e.id === editingId) ?? null;
  const confirmDelete = expenses.find((e) => e.id === confirmDeleteId) ?? null;
  /** Rows in on-screen order, for keyboard navigation. */
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  // MARK: - Mutations

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
    // Keep keyboard flow going in the split view: select the next row (or previous, if it was last).
    if (id === selectedId) {
      const i = flat.findIndex((e) => e.id === id);
      setSelectedId(isSplit ? (flat[i + 1] ?? flat[i - 1])?.id ?? null : null);
    }
    try {
      await api.deleteExpense(id);
      setExpenses((list) => list.filter((e) => e.id !== id));
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  // MARK: - Desktop: keyboard shortcuts

  const focusSearch = useCallback(() => {
    searchRef.current?.focus();
    searchRef.current?.select();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      const target = e.target as HTMLElement;
      const overlayOpen = document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]');
      const typing = target.closest("input, textarea, select, [contenteditable='true']");

      // ⌘K / Ctrl+K works even while typing elsewhere.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        if (overlayOpen) return;
        e.preventDefault();
        focusSearch();
        return;
      }
      if (typing) {
        if (e.key === "Escape" && target === searchRef.current) searchRef.current.blur();
        // ↓ from the search field jumps into the results.
        if (e.key === "ArrowDown" && target === searchRef.current && isSplit && flat.length) {
          e.preventDefault();
          searchRef.current.blur();
          setSelectedId(flat[0].id);
        }
        return;
      }
      if (overlayOpen || e.metaKey || e.ctrlKey || e.altKey) return;

      const move = (delta: number) => {
        if (!flat.length) return;
        const i = flat.findIndex((x) => x.id === selectedId);
        const next = i < 0 ? (delta > 0 ? 0 : flat.length - 1) : Math.min(flat.length - 1, Math.max(0, i + delta));
        setSelectedId(flat[next].id);
      };

      switch (e.key) {
        case "/":
          e.preventDefault();
          focusSearch();
          break;
        case "n":
        case "N":
          e.preventDefault();
          setShowAdd(true);
          break;
        case "ArrowDown":
        case "j":
          if (!isSplit) return;
          e.preventDefault();
          move(1);
          break;
        case "ArrowUp":
        case "k":
          if (!isSplit) return;
          e.preventDefault();
          move(-1);
          break;
        case "Enter":
        case "e":
          if (!isSplit || !selectedId) return;
          e.preventDefault();
          setEditingId(selectedId);
          break;
        case "Escape":
          if (isSplit) setSelectedId(null);
          break;
        case "Backspace":
        case "Delete":
          if (!isSplit || !selectedId) return;
          e.preventDefault();
          setConfirmDeleteId(selectedId);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flat, selectedId, isSplit, focusSearch]);

  // Keep the keyboard-selected row visible in the list column.
  useEffect(() => {
    if (isSplit && selectedId) {
      document.querySelector(`[data-expense-id="${selectedId}"]`)?.scrollIntoView({ block: "nearest" });
    }
  }, [isSplit, selectedId]);

  // MARK: - Desktop: right-click context menu

  const openContextMenu = (e: React.MouseEvent, expense: Expense) => {
    e.preventDefault();
    if (isSplit) setSelectedId(expense.id);
    const category = expense.category_id ? byId.get(expense.category_id) : undefined;
    const entries: MenuEntry[] = [
      ...(isSplit ? [] : [{ label: "Show Details", icon: PanelRight, onSelect: () => setSelectedId(expense.id) }]),
      { label: "Edit…", icon: Pencil, onSelect: () => setEditingId(expense.id) },
      ...(category
        ? [{ label: `Show Only “${category.name}”`, icon: ListFilter, onSelect: () => setCategoryFilter(category.id) }]
        : []),
      {
        label: "Copy Amount",
        icon: Copy,
        onSelect: () => void navigator.clipboard?.writeText(expense.amount.toFixed(2)),
      },
      "divider",
      { label: "Delete…", icon: Trash2, destructive: true, onSelect: () => setConfirmDeleteId(expense.id) },
    ];
    setContextMenu({ x: e.clientX, y: e.clientY, entries });
  };
  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const filterMenu = (
    <Menu
      label="Filter by category"
      align={isSplit ? "right" : "left"}
      trigger={
        <>
          <FilterGlyph active={categoryFilter !== "all"} />
          {byId.has(categoryFilter) && <span className="text-xs">{byId.get(categoryFilter)!.name}</span>}
        </>
      }
      entries={[
        { label: "All", icon: List, selected: categoryFilter === "all", onSelect: () => setCategoryFilter("all") },
        ...categories.map((c) => ({
          label: c.name,
          icon: categoryVisual(c).Icon,
          selected: c.id === categoryFilter,
          onSelect: () => setCategoryFilter(c.id),
        })),
        "divider" as const,
        {
          label: "Manage Categories…",
          icon: Settings2,
          onSelect: () => router.push("/settings/categories?from=expenses"),
        },
      ]}
    />
  );

  const sortMenu = (
    <Menu
      label="Sort expenses"
      align={isSplit ? "right" : "left"}
      trigger={
        <span className="ml-2 flex items-center gap-1">
          <ArrowUpDown size={20} />
          {sort !== "date" && <span className="text-xs">{SORTS.find((s) => s.value === sort)!.label}</span>}
        </span>
      }
      entries={SORTS.map((s) => ({
        label: s.label,
        icon: s.icon,
        selected: s.value === sort,
        onSelect: () => setSort(s.value),
      }))}
    />
  );

  const monthSwitcher = (
    <div className={isSplit ? "flex items-center" : "flex items-center justify-between px-4 py-2"}>
      <button
        type="button"
        aria-label="Previous month"
        className="flex size-9 items-center justify-center rounded-md text-ios-blue hover:bg-fill"
        onClick={() => setMonth(addMonths(month, -1))}
      >
        <ChevronLeft size={20} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        className={`flex items-center gap-2 rounded-md font-semibold hover:bg-fill ${
          isSplit ? "min-w-40 justify-center px-2 py-1 text-[15px]" : "text-[18px]"
        }`}
        onClick={() => setShowMonthPicker(true)}
      >
        {formatMonthYear(month)}
        <Calendar size={isSplit ? 15 : 17} />
      </button>
      <button
        type="button"
        aria-label="Next month"
        disabled={isCurrentMonth}
        className="flex size-9 items-center justify-center rounded-md text-ios-blue hover:bg-fill disabled:opacity-30 disabled:hover:bg-transparent"
        onClick={() => setMonth(addMonths(month, 1))}
      >
        <ChevronRight size={20} strokeWidth={2.5} />
      </button>
    </div>
  );

  const list = isLoading ? (
    <div className="flex min-h-[50dvh] items-center justify-center">
      <Spinner />
    </div>
  ) : filtered.length === 0 ? (
    <EmptyState
      icon={Inbox}
      title={search ? "No matching expenses" : "No expenses yet"}
      subtitle={search ? undefined : isSplit ? "Press N or click Add Expense" : "Tap + to add your first expense"}
    />
  ) : (
    <div className="pb-6">
      {groups.map(({ key, header, items }) => (
        <Section key={key} header={header} inset={74} className="first:pt-2">
          {items.map((e) => (
            <div
              key={e.id}
              data-expense-id={e.id}
              onContextMenu={hasFinePointer ? (ev) => openContextMenu(ev, e) : undefined}
            >
              <SwipeRow
                onDelete={() => remove(e.id)}
                onPress={() => setSelectedId(isSplit && selectedId === e.id ? null : e.id)}
                selected={isSplit && e.id === selectedId}
              >
                <ExpenseRow expense={e} category={e.category_id ? byId.get(e.category_id) : undefined} />
              </SwipeRow>
            </div>
          ))}
        </Section>
      ))}
    </div>
  );

  const overlays = (
    <>
      {showAdd && <ExpenseForm onSave={add} onClose={() => setShowAdd(false)} />}
      {!isSplit && selected && (
        <ExpenseDetail expense={selected} onClose={() => setSelectedId(null)} onEdit={() => setEditingId(selected.id)} />
      )}
      {editing && (
        <ExpenseForm
          expense={editing}
          onSave={(input) => update(editing.id, input)}
          onDuplicate={add}
          onClose={() => setEditingId(null)}
        />
      )}
      {confirmDelete && (
        <Alert
          title="Delete Expense?"
          message={`“${confirmDelete.item ?? (confirmDelete.category_id ? byId.get(confirmDelete.category_id)?.name : undefined) ?? "Expense"}” – ${confirmDelete.amount.toFixed(2)} ${confirmDelete.currency}`}
          buttons={[
            { label: "Cancel", role: "cancel" },
            { label: "Delete", role: "destructive", onPress: () => remove(confirmDelete.id) },
          ]}
          onDismiss={() => setConfirmDeleteId(null)}
        />
      )}
      {contextMenu && <ContextMenu menu={contextMenu} onClose={closeContextMenu} />}
      {showMonthPicker && (
        <MonthPicker selected={month} onSelect={setMonth} onClose={() => setShowMonthPicker(false)} />
      )}
      <ErrorBanner message={error} onDismiss={() => setError(null)} />
    </>
  );

  // MARK: - Split view (lg+): unified toolbar, list column, inspector pane

  if (isSplit) {
    return (
      <div className="flex h-dvh flex-col">
        <header className="flex h-13 shrink-0 items-center gap-4 border-b border-separator bg-bar px-5 backdrop-blur-xl">
          <h1 className="shrink-0 text-[20px] font-bold">Expenses</h1>
          {monthSwitcher}
          <div className="flex-1" />
          <SearchBar
            inputRef={searchRef}
            value={search}
            onChange={setSearch}
            placeholder="Search expenses"
            className="w-44 xl:w-72"
            shortcut="/"
          />
          <div className="flex items-center">
            {filterMenu}
            {sortMenu}
          </div>
          <ThemeMenu />
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            title="Add Expense (N)"
            aria-label="Add Expense"
            className="flex shrink-0 items-center gap-1 rounded-lg bg-ios-blue p-1.5 text-[15px] font-medium whitespace-nowrap text-white hover:opacity-90 xl:pr-3 xl:pl-2"
          >
            {/* Icon-only below xl so the toolbar fits a 1024px window. */}
            <Plus size={18} strokeWidth={2.4} /> <span className="hidden xl:inline">Add Expense</span>
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          <div className="w-100 shrink-0 overflow-y-auto overscroll-contain border-r border-separator xl:w-110">
            {!isLoading && filtered.length > 0 && (
              <div className="flex items-baseline justify-between px-8 pt-4 text-[13px] text-label-2">
                <span>
                  {filtered.length} {filtered.length === 1 ? "expense" : "expenses"}
                </span>
                <span className="text-[15px] font-semibold text-label tabular-nums">{total} EUR</span>
              </div>
            )}
            {list}
          </div>
          <div className="min-w-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="mx-auto max-w-2xl">
              {selected ? (
                <ExpenseInspector
                  key={selected.id}
                  expense={selected}
                  category={selected.category_id ? byId.get(selected.category_id) : undefined}
                  onEdit={() => setEditingId(selected.id)}
                  onDelete={() => setConfirmDeleteId(selected.id)}
                />
              ) : (
                !isLoading && (
                  <MonthSummary
                    month={month}
                    expenses={filtered}
                    previous={previousFiltered}
                    byId={byId}
                    onSelectCategory={setCategoryFilter}
                  />
                )
              )}
            </div>
          </div>
        </div>
        {overlays}
      </div>
    );
  }

  // MARK: - Stacked (phones / narrow windows) – single-column layout

  return (
    <>
      <Toolbar
        left={
          <>
            {filterMenu}
            {sortMenu}
          </>
        }
        right={
          <div className="flex items-center gap-3">
            <ThemeMenu />
            <IconButton icon={Plus} label="Add expense" onClick={() => setShowAdd(true)} />
          </div>
        }
      >
        <SearchBar inputRef={searchRef} value={search} onChange={setSearch} placeholder="Search expenses" />
      </Toolbar>

      {/* Summary card */}
      <p className="py-0.5 text-center text-[22px] font-semibold">{total} EUR</p>

      {monthSwitcher}
      {list}
      {overlays}
    </>
  );
}

function ExpenseRow({ expense, category }: { expense: Expense; category?: Category }) {
  const { byId: paymentById } = usePaymentMethods();
  const paymentName = expense.payment_method_id ? paymentById.get(expense.payment_method_id)?.name : undefined;
  const meta = [expense.location, paymentName].filter(Boolean).join(" • ");
  const { Icon, color } = categoryVisual(category);
  return (
    <div className="flex items-center gap-3 px-[18px] py-3">
      <IconBubble icon={Icon} color={color} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] font-semibold">{expense.item ?? category?.name ?? "Expense"}</p>
        {meta && <p className="mt-1 truncate text-[13px] text-label-2">{meta}</p>}
      </div>
      <div className="text-right">
        <p className="text-[16px] font-bold">{expense.amount.toFixed(2)}</p>
        <p className="mt-1 text-[12px] text-label-2">{expense.currency}</p>
      </div>
    </div>
  );
}
