"use client";

// Port of Views/Inventory/InventoryListView.swift + AddInventoryItemView.swift
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Box,
  Calendar,
  ChevronRight,
  CircleCheck,
  CirclePlus,
  Clock,
  Hash,
  Infinity as InfinityIcon,
  type LucideIcon,
  Plus,
  TriangleAlert,
  Type,
} from "lucide-react";
import { useUser } from "@/components/AuthProvider";
import { FilterGlyph, IconBubble } from "@/components/glyphs";
import {
  DateRow,
  EmptyState,
  ErrorBanner,
  IconButton,
  Menu,
  SearchBar,
  Section,
  Sheet,
  Spinner,
  SwipeRow,
  TextAreaRow,
  TextFieldRow,
  Toolbar,
} from "@/components/ui";
import { type IOSColor, iosColor, iosTint } from "@/lib/constants";
import { errorMessage, formatQuantity, noonISO, parseDecimal, todayInput } from "@/lib/helpers";
import { expirationText, expiryStatus, isExpired, isExpiringSoon, STATUS_COLOR } from "@/lib/inventory";
import * as api from "@/lib/services";
import type { InventoryItem } from "@/lib/types";

type SortOption = "name" | "expiration" | "quantity";
type Filter = "all" | "expiringSoon" | "expired";

const SORTS: { value: SortOption; label: string; icon: LucideIcon }[] = [
  { value: "name", label: "Name", icon: Type },
  { value: "expiration", label: "Expiration", icon: Calendar },
  { value: "quantity", label: "Quantity", icon: Hash },
];

function compare(a: InventoryItem, b: InventoryItem, sort: SortOption): number {
  switch (sort) {
    case "name":
      return a.name.localeCompare(b.name);
    case "quantity":
      return a.quantity - b.quantity;
    case "expiration":
      if (!a.expiration_date && !b.expiration_date) return 0;
      if (!a.expiration_date) return 1; // no date sorts last
      if (!b.expiration_date) return -1;
      return a.expiration_date.localeCompare(b.expiration_date);
  }
}

export default function InventoryPage() {
  const user = useUser();
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("name");
  const [ascending, setAscending] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .fetchInventoryItems(user.id)
      .then((rows) => !cancelled && setItems(rows))
      .catch((e) => !cancelled && setError(errorMessage(e)))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((i) => (filter === "expired" ? isExpired(i) : filter === "expiringSoon" ? isExpiringSoon(i) : true))
      .filter((i) => !q || i.name.toLowerCase().includes(q))
      .sort((a, b) => (ascending ? 1 : -1) * compare(a, b, sort));
  }, [items, filter, search, sort, ascending]);

  const groups = useMemo(() => {
    const expired = visible.filter(isExpired);
    const soon = visible.filter(isExpiringSoon);
    const fresh = visible.filter((i) => ["fresh", "none"].includes(expiryStatus(i)));
    return (
      [
        ["⚠️ Expired", expired],
        ["⏰ Expiring Soon", soon],
        ["✓ Fresh", fresh],
      ] as const
    ).filter(([, list]) => list.length > 0);
  }, [visible]);

  const add = async (input: api.InventoryInput) => {
    try {
      const created = await api.createInventoryItem(user.id, input);
      setItems((list) => [...list, created].sort((a, b) => a.name.localeCompare(b.name)));
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    }
  };

  const remove = async (id: string) => {
    try {
      await api.deleteInventoryItem(id);
      setItems((list) => list.filter((i) => i.id !== id));
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const pickFilter = (f: Filter) => {
    setFilter(f);
    setSearch("");
  };

  const renderRows = (list: readonly InventoryItem[]) =>
    list.map((i) => (
      <SwipeRow key={i.id} onDelete={() => remove(i.id)} onPress={() => router.push(`/inventory/${i.id}`)}>
        <InventoryRow item={i} />
      </SwipeRow>
    ));

  return (
    <>
      <Toolbar
        left={
          <Menu
            label="Sort"
            trigger={
              <>
                <FilterGlyph active={sort !== "name"} />
                {sort !== "name" && <span className="text-xs">{SORTS.find((s) => s.value === sort)!.label}</span>}
              </>
            }
            entries={[
              ...SORTS.map((s) => ({
                label: s.label,
                icon: s.icon,
                selected: s.value === sort,
                onSelect: () => setSort(s.value),
              })),
              "divider" as const,
              {
                label: ascending ? "Ascending" : "Descending",
                icon: ascending ? ArrowUp : ArrowDown,
                onSelect: () => setAscending(!ascending),
              },
            ]}
          />
        }
        right={<IconButton icon={Plus} label="Add item" onClick={() => setShowAdd(true)} />}
      >
        <SearchBar value={search} onChange={setSearch} placeholder="Search items..." />
      </Toolbar>

      {isLoading ? (
        <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 text-label-2">
          <Spinner />
          Loading inventory...
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Box} title="No inventory items yet" subtitle="Track your food and supplies">
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-full bg-ios-blue px-5 py-2.5 text-[17px] font-semibold text-white"
          >
            <CirclePlus size={20} /> Add Your First Item
          </button>
        </EmptyState>
      ) : (
        <div className="pb-6">
          <div className="grid grid-cols-3 gap-3 p-4">
            <StatCard
              title="Total"
              value={items.length}
              icon={Box}
              color="blue"
              selected={filter === "all"}
              onPress={() => pickFilter("all")}
            />
            <StatCard
              title="Expiring"
              value={items.filter(isExpiringSoon).length}
              icon={Clock}
              color="orange"
              selected={filter === "expiringSoon"}
              onPress={() => pickFilter("expiringSoon")}
            />
            <StatCard
              title="Expired"
              value={items.filter(isExpired).length}
              icon={TriangleAlert}
              color="red"
              selected={filter === "expired"}
              onPress={() => pickFilter("expired")}
            />
          </div>

          {sort === "expiration" ? (
            groups.map(([name, list]) => (
              <Section
                key={name}
                header={<span className="font-semibold text-label normal-case">{name}</span>}
                inset={72}
                className="first:pt-0"
              >
                {renderRows(list)}
              </Section>
            ))
          ) : visible.length > 0 ? (
            <Section inset={72} className="pt-0">
              {renderRows(visible)}
            </Section>
          ) : null}
        </div>
      )}

      {showAdd && <AddInventorySheet onSave={add} onClose={() => setShowAdd(false)} />}
      <ErrorBanner message={error} onDismiss={() => setError(null)} />
    </>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  selected,
  onPress,
}: {
  title: string;
  value: number;
  icon: LucideIcon;
  color: IOSColor;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="flex flex-col items-center gap-1.5 rounded-[10px] border-2 px-2 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
      style={{
        backgroundColor: selected ? iosTint(color, 15) : "var(--bg-cell)",
        borderColor: selected ? iosColor(color) : "transparent",
      }}
    >
      <span className="flex items-center gap-1.5">
        <Icon size={22} style={{ color: iosColor(color) }} />
        <span className="text-[22px] font-bold">{value}</span>
      </span>
      <span className="text-xs text-label-2">{title}</span>
    </button>
  );
}

function InventoryRow({ item }: { item: InventoryItem }) {
  const status = expiryStatus(item);
  const StatusIcon = { none: Box, expired: TriangleAlert, expiring: Clock, fresh: CircleCheck }[status];
  const expiryColor = status === "fresh" ? "blue" : STATUS_COLOR[status];

  return (
    <div className="flex items-center gap-3 px-4 py-[10px]">
      <IconBubble icon={StatusIcon} color={iosColor(STATUS_COLOR[status])} />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-[16px] font-semibold">{item.name}</p>
        {item.expiration_date ? (
          <p className="flex items-center gap-1 text-[13px]" style={{ color: iosColor(expiryColor) }}>
            <Calendar size={11} /> {expirationText(new Date(item.expiration_date))}
          </p>
        ) : (
          <p className="flex items-center gap-1 text-[13px] text-label-2">
            <InfinityIcon size={11} /> No expiration
          </p>
        )}
        <p className="text-[13px] text-label-2">
          Qty: {formatQuantity(item.quantity)} {item.unit}
        </p>
      </div>
      <ChevronRight size={18} className="shrink-0 text-label-3" />
    </div>
  );
}

function AddInventorySheet({
  onSave,
  onClose,
}: {
  onSave: (input: api.InventoryInput) => Promise<boolean>;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [expirationDate, setExpirationDate] = useState(todayInput());
  const [unit, setUnit] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const qty = parseDecimal(quantity);
  const canSave = name.trim() !== "" && quantity.trim() !== "" && qty != null && !saving;

  const save = async () => {
    if (qty == null) return;
    setSaving(true);
    const ok = await onSave({
      name,
      quantity: qty,
      expiration_date: noonISO(expirationDate),
      unit: unit || null,
      description: description || null,
    });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Sheet
      title="Add Item"
      left={{ label: "Cancel", onPress: onClose }}
      right={{ label: "Save", onPress: save, disabled: !canSave }}
      onClose={onClose}
    >
      <Section header="Item Details">
        <TextFieldRow placeholder="Name" value={name} onChange={setName} autoFocus />
        <TextFieldRow placeholder="Quantity" inputMode="decimal" value={quantity} onChange={setQuantity} />
        <DateRow label="Expiration Date" value={expirationDate} onChange={setExpirationDate} />
        <TextFieldRow placeholder="Unit (e.g., kg, pcs)" value={unit} onChange={setUnit} />
      </Section>
      <Section header="Description">
        <TextAreaRow value={description} onChange={setDescription} />
      </Section>
    </Sheet>
  );
}
