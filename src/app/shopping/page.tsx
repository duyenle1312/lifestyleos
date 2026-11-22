"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, Circle, CircleCheck, Clock, List, MapPin, Plus, ShoppingCart, Star } from "lucide-react";
import { useUser } from "@/components/AuthProvider";
import { FilterGlyph, PencilCircleGlyph } from "@/components/glyphs";
import { ShoppingForm } from "@/components/shopping/ShoppingForm";
import { EmptyState, ErrorBanner, IconButton, Menu, SearchBar, Section, Spinner, SwipeRow, Toolbar } from "@/components/ui";
import {
  addDays,
  errorMessage,
  formatMonthDay,
  formatMonthDayYear,
  isToday,
  isTomorrow,
} from "@/lib/helpers";
import * as api from "@/lib/services";
import type { ShoppingItem } from "@/lib/types";

type Grouping = "none" | "location" | "schedule" | "priority";

const GROUPINGS: { value: Grouping; label: string; short: string; icon: typeof List }[] = [
  { value: "none", label: "All", short: "", icon: List },
  { value: "location", label: "By Location", short: "Location", icon: MapPin },
  { value: "schedule", label: "By Schedule", short: "Schedule", icon: Calendar },
  { value: "priority", label: "By Priority", short: "Priority", icon: Star },
];

const SCHEDULE_ORDER = ["Overdue", "Today", "Tomorrow", "This Week", "Later", "Not Scheduled"];
const PRIORITY_LABELS: Record<number, string> = {
  5: "⭐⭐⭐⭐⭐ Critical",
  4: "⭐⭐⭐⭐ Urgent",
  3: "⭐⭐⭐ High",
  2: "⭐⭐ Medium",
  1: "⭐ Low",
};
const PRIORITY_NAMES: Record<number, string> = { 5: "Critical", 4: "Urgent", 3: "High", 2: "Medium", 1: "Low" };
const PRIORITY_ORDER = [...[5, 4, 3, 2, 1].map((p) => PRIORITY_LABELS[p]), "No Priority"];

function scheduleGroup(date: Date) {
  const now = new Date();
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  if (date < now) return "Overdue";
  if (date < addDays(now, 7)) return "This Week";
  return "Later";
}

function groupBy(items: ShoppingItem[], key: (i: ShoppingItem) => string) {
  const map = new Map<string, ShoppingItem[]>();
  for (const i of items) map.set(key(i), [...(map.get(key(i)) ?? []), i]);
  return [...map.entries()];
}

const orderBy = (order: string[]) => (a: [string, unknown], b: [string, unknown]) =>
  (order.indexOf(a[0]) + 1 || order.length + 1) - (order.indexOf(b[0]) + 1 || order.length + 1);

export default function ShoppingPage() {
  const user = useUser();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [grouping, setGrouping] = useState<Grouping>("none");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .fetchShoppingItems(user.id)
      .then((rows) => !cancelled && setItems(rows))
      .catch((e) => !cancelled && setError(errorMessage(e)))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => [i.item, i.description, i.location].some((f) => f?.toLowerCase().includes(q)));
  }, [items, search]);

  const groups = useMemo((): [string, ShoppingItem[]][] => {
    switch (grouping) {
      case "none":
        return [["All Items", filtered]];
      case "location":
        return groupBy(filtered, (i) => i.location ?? "No Location").sort((a, b) => a[0].localeCompare(b[0]));
      case "schedule":
        return groupBy(filtered, (i) =>
          i.scheduled_date ? scheduleGroup(new Date(i.scheduled_date)) : "Not Scheduled",
        ).sort(orderBy(SCHEDULE_ORDER));
      case "priority":
        return groupBy(filtered, (i) => PRIORITY_LABELS[i.priority ?? 0] ?? "No Priority").sort(
          orderBy(PRIORITY_ORDER),
        );
    }
  }, [filtered, grouping]);

  const editing = items.find((i) => i.id === editingId);
  const currentGrouping = GROUPINGS.find((g) => g.value === grouping)!;

  // MARK: - Mutations

  const add = async (input: api.ShoppingInput) => {
    try {
      const created = await api.createShoppingItem(user.id, input);
      setItems((list) => [created, ...list].sort((a, b) => b.created_at.localeCompare(a.created_at)));
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    }
  };

  const update = async (id: string, input: Partial<api.ShoppingInput>) => {
    try {
      const updated = await api.updateShoppingItem(id, input);
      setItems((list) => list.map((i) => (i.id === id ? updated : i)));
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    }
  };

  const remove = async (id: string) => {
    try {
      await api.deleteShoppingItem(id);
      setItems((list) => list.filter((i) => i.id !== id));
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <>
      <Toolbar
        left={
          <Menu
            label="Group by"
            trigger={
              <>
                <FilterGlyph active={grouping !== "none"} />
                {grouping !== "none" && <span className="text-xs">{currentGrouping.short}</span>}
              </>
            }
            entries={GROUPINGS.map((g) => ({
              label: g.label,
              icon: g.icon,
              selected: g.value === grouping,
              onSelect: () => setGrouping(g.value),
            }))}
          />
        }
        right={<IconButton icon={Plus} label="Add item" onClick={() => setShowAdd(true)} />}
      >
        <SearchBar value={search} onChange={setSearch} placeholder="Search items..." />
      </Toolbar>

      {isLoading ? (
        <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 text-label-2">
          <Spinner />
          Loading shopping lists...
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title={search ? "No items found" : "No items in your shopping list"}
          subtitle={search ? "Try a different search term" : "Tap + to add your first item"}
        />
      ) : (
        <div className="pb-6">
          {groups.map(([name, groupItems]) => (
            <Section
              key={name}
              inset={56}
              className="first:pt-2"
              header={
                <span className="flex items-center justify-between">
                  <span className="font-semibold text-label">{name}</span>
                  <span className="normal-case">{groupItems.length}</span>
                </span>
              }
            >
              {groupItems.map((i) => (
                <SwipeRow key={i.id} onDelete={() => remove(i.id)} hoverDelete={false}>
                  <ShoppingRow
                    item={i}
                    showPriority={grouping !== "priority"}
                    onEdit={() => setEditingId(i.id)}
                    onTogglePurchased={() => update(i.id, { purchased: !i.purchased })}
                  />
                </SwipeRow>
              ))}
            </Section>
          ))}
        </div>
      )}

      {showAdd && <ShoppingForm onSave={add} onClose={() => setShowAdd(false)} />}
      {editing && (
        <ShoppingForm
          key={editing.id}
          item={editing}
          onSave={(input) => update(editing.id, input)}
          onDelete={() => remove(editing.id)}
          onClose={() => setEditingId(null)}
        />
      )}
      <ErrorBanner message={error} onDismiss={() => setError(null)} />
    </>
  );
}

function formatScheduled(date: Date) {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return date.getFullYear() === new Date().getFullYear() ? formatMonthDay(date) : formatMonthDayYear(date);
}

function ShoppingRow({
  item,
  showPriority,
  onEdit,
  onTogglePurchased,
}: {
  item: ShoppingItem;
  /** Off when grouped by priority: the section header already says it. */
  showPriority: boolean;
  onEdit: () => void;
  onTogglePurchased: () => void;
}) {
  const now = new Date();
  const scheduled = item.scheduled_date ? new Date(item.scheduled_date) : null;
  const start = item.available_date_start ? new Date(item.available_date_start) : null;
  const end = item.available_date_end ? new Date(item.available_date_end) : null;
  const total = item.unit_price != null && item.quantity != null ? item.unit_price * item.quantity : null;
  const priority = showPriority && item.priority ? item.priority : 0;

  return (
    <div className="flex items-center gap-3 px-4 py-[10px]">
      <button
        type="button"
        aria-label={item.purchased ? "Mark as not purchased" : "Mark as purchased"}
        onClick={(e) => {
          e.stopPropagation();
          onTogglePurchased();
        }}
        className="shrink-0"
      >
        {item.purchased ? (
          <CircleCheck size={26} className="fill-ios-green text-cell" />
        ) : (
          <Circle size={26} className="text-ios-gray" strokeWidth={1.6} />
        )}
      </button>

      <div className="min-w-0 flex-1 space-y-1">
        <p className={`text-[16px] font-semibold ${item.purchased ? "text-label-2 line-through" : ""}`}>{item.item}</p>
        {item.description && <p className="truncate text-[13px] text-label-2">{item.description}</p>}
        {(item.location || item.quantity != null) && (
          <p className="text-[13px] text-label-2">
            {[item.location, item.quantity != null ? `Qty: ${item.quantity}` : null].filter(Boolean).join(" • ")}
            {total != null && (
              <>
                {" • "}
                <span className="text-ios-blue">€{total.toFixed(2)}</span>
              </>
            )}
          </p>
        )}
        {priority > 0 && (
          <p className="flex items-center gap-1 pt-0.5 text-[12px] text-label-2">
            <span className="flex text-ios-orange/60">
              {Array.from({ length: priority }, (_, n) => (
                <Star key={n} size={11} className="fill-current" strokeWidth={0} />
              ))}
            </span>
            {PRIORITY_NAMES[priority]}
          </p>
        )}
        {scheduled && (
          <p
            className={`flex items-center gap-1 pt-0.5 text-[12px] ${
              scheduled < now && !item.purchased ? "text-ios-red" : "text-ios-blue"
            }`}
          >
            <Calendar size={11} /> Scheduled: {formatScheduled(scheduled)}
          </p>
        )}
        {start && end && (
          <p
            className={`flex items-center gap-1 pt-0.5 text-[12px] ${
              now >= start && now <= end ? "text-ios-green" : "text-ios-orange"
            }`}
          >
            <Clock size={11} /> Available: {formatMonthDay(start)} - {formatMonthDay(end)}
          </p>
        )}
      </div>

      <button
        type="button"
        aria-label="Edit item"
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        className="shrink-0"
      >
        <PencilCircleGlyph />
      </button>
    </div>
  );
}
