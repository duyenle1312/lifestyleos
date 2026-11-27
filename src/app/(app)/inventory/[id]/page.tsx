"use client";

// Inventory item detail (pushed from the list, edits in place).
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Box, ChevronLeft } from "lucide-react";
import { useLocalDb, useSync } from "@/components/OfflineProvider";
import {
  DateRow,
  EmptyState,
  ErrorBanner,
  Row,
  Section,
  Spinner,
  TextAreaRow,
  TextFieldRow,
  ToggleRow,
  Toolbar,
  ValueRow,
} from "@/components/ui";
import {
  errorMessage,
  formatDateTime,
  formatDMY,
  formatQuantity,
  isPast,
  noonISO,
  parseDecimal,
  toDateInput,
  todayInput,
} from "@/lib/helpers";
import { useAwaitingFirstPull } from "@/lib/offline/useAwaitingFirstPull";
import * as api from "@/lib/services";
import type { InventoryItem } from "@/lib/types";
import { useCanEditOnline } from "@/lib/useOnline";

export default function InventoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const db = useLocalDb();
  const { syncNow } = useSync();
  const canEdit = useCanEditOnline();
  const awaitingFirstPull = useAwaitingFirstPull("inventory_items");
  // undefined while loading; null when the item is not in the local db.
  const found = useLiveQuery(async () => (await db.inventoryItems.get(id)) ?? null, [db, id]);
  const item = found ?? null;
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editName, setEditName] = useState("");
  const [editQuantity, setEditQuantity] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [hasExpiration, setHasExpiration] = useState(false);
  const [editExpiration, setEditExpiration] = useState(todayInput());

  const startEditing = (i: InventoryItem) => {
    setEditName(i.name);
    setEditQuantity(formatQuantity(i.quantity).replace(/,/g, ""));
    setEditUnit(i.unit ?? "");
    setEditDescription(i.description ?? "");
    setHasExpiration(!!i.expiration_date);
    setEditExpiration(i.expiration_date ? toDateInput(new Date(i.expiration_date)) : todayInput());
    setIsEditing(true);
  };

  const save = async (i: InventoryItem) => {
    setSaving(true);
    try {
      const updated = await api.updateInventoryItem(i.id, {
        name: editName,
        quantity: parseDecimal(editQuantity) ?? 0,
        unit: editUnit || null,
        description: editDescription || null,
        expiration_date: hasExpiration ? noonISO(editExpiration) : null,
      });
      await db.inventoryItems.put(updated);
      void syncNow();
      setIsEditing(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const expires = item?.expiration_date ? new Date(item.expiration_date) : null;

  return (
    <>
      <Toolbar
        title={item?.name}
        left={
          <Link href="/inventory" className="-ml-2 flex items-center text-[17px] text-ios-blue">
            <ChevronLeft size={28} strokeWidth={2.2} />
            Pantry
          </Link>
        }
        right={
          item && (
            <div className="flex items-center gap-4">
              {isEditing && (
                <button type="button" className="text-[17px] text-ios-blue" onClick={() => setIsEditing(false)}>
                  Cancel
                </button>
              )}
              <button
              type="button"
              disabled={saving || !canEdit}
              className={`text-[17px] text-ios-blue disabled:opacity-40 ${isEditing ? "font-semibold" : ""}`}
              onClick={() => (isEditing ? save(item) : startEditing(item))}
            >
              {isEditing ? "Save" : "Edit"}
            </button>
            </div>
          )
        }
      />

      {!canEdit && <p className="px-8 pt-3 text-[13px] text-label-2">Needs a connection</p>}

      {found === undefined || (!item && awaitingFirstPull) ? (
        <div className="flex min-h-[60dvh] items-center justify-center">
          <Spinner />
        </div>
      ) : !item ? (
        <EmptyState icon={Box} title="Item not found" subtitle="It may have been deleted." />
      ) : (
        <div className="pb-8">
          <Section header="Details" className="pt-2">
            {isEditing ? (
              <>
                <TextFieldRow placeholder="Name" value={editName} onChange={setEditName} />
                <Row>
                  <input
                    className="min-w-0 flex-1 bg-transparent outline-none"
                    placeholder="Quantity"
                    inputMode="decimal"
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(e.target.value)}
                  />
                  <input
                    className="min-w-0 flex-1 bg-transparent outline-none"
                    placeholder="Unit"
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                  />
                </Row>
                <ToggleRow label="Has Expiration Date" checked={hasExpiration} onChange={setHasExpiration} />
                {hasExpiration && (
                  <DateRow label="Expiration Date" value={editExpiration} onChange={setEditExpiration} />
                )}
              </>
            ) : (
              <>
                <ValueRow label="Name" value={item.name} />
                <ValueRow label="Quantity" value={`${formatQuantity(item.quantity)} ${item.unit ?? ""}`} />
                <ValueRow
                  label="Expires"
                  value={expires ? formatDMY(expires) : "No expiration"}
                  valueClassName={expires && isPast(expires) ? "text-ios-red" : "text-label-2"}
                />
              </>
            )}
          </Section>

          <Section header="Description">
            {isEditing ? (
              <TextAreaRow value={editDescription} onChange={setEditDescription} />
            ) : (
              <Row className={`whitespace-pre-wrap ${item.description ? "" : "text-ios-gray"}`}>
                {item.description ?? "No description"}
              </Row>
            )}
          </Section>

          <Section header="Metadata">
            <ValueRow label="Created" value={formatDateTime(new Date(item.created_at))} />
            <ValueRow label="Updated" value={formatDateTime(new Date(item.updated_at))} />
          </Section>
        </div>
      )}

      <ErrorBanner message={error} onDismiss={() => setError(null)} />
    </>
  );
}
