"use client";

// Inventory item detail (pushed from the list, edits in place).
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import {
  DateRow,
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
import * as api from "@/lib/services";
import type { InventoryItem } from "@/lib/types";

export default function InventoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editName, setEditName] = useState("");
  const [editQuantity, setEditQuantity] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [hasExpiration, setHasExpiration] = useState(false);
  const [editExpiration, setEditExpiration] = useState(todayInput());

  useEffect(() => {
    api
      .fetchInventoryItem(id)
      .then(setItem)
      .catch((e) => setError(errorMessage(e)));
  }, [id]);

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
      setItem(updated);
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
            Inventory
          </Link>
        }
        right={
          item && (
            <button
              type="button"
              disabled={saving}
              className={`text-[17px] text-ios-blue disabled:opacity-40 ${isEditing ? "font-semibold" : ""}`}
              onClick={() => (isEditing ? save(item) : startEditing(item))}
            >
              {isEditing ? "Save" : "Edit"}
            </button>
          )
        }
      />

      {!item ? (
        <div className="flex min-h-[60dvh] items-center justify-center">{!error && <Spinner />}</div>
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
