"use client";

// Port of AddShoppingListView.swift + EditShoppingListView.swift
import { useState } from "react";
import { CircleCheck } from "lucide-react";
import { PRIORITY_OPTIONS } from "@/lib/constants";
import { addDays, formatDateTime, noonISO, parseDecimal, parseIntStrict, toDateInput, todayInput } from "@/lib/helpers";
import type { ShoppingInput } from "@/lib/services";
import type { ShoppingItem } from "@/lib/types";
import {
  Alert,
  ButtonRow,
  DateRow,
  LabeledFieldRow,
  Row,
  Section,
  SelectRow,
  Sheet,
  TextFieldRow,
  ToggleRow,
  ValueRow,
} from "../ui";

const dateOr = (iso: string | null | undefined, fallback: string) => (iso ? toDateInput(new Date(iso)) : fallback);

export function ShoppingForm({
  item,
  onSave,
  onDelete,
  onClose,
}: {
  /** Present → edit mode. */
  item?: ShoppingItem;
  onSave: (input: ShoppingInput) => Promise<boolean>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}) {
  const isEdit = !!item;
  const weekLater = toDateInput(addDays(new Date(), 7));
  const hasAvailability = !!(item?.available_date_start && item?.available_date_end);

  const [name, setName] = useState(item?.item ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [location, setLocation] = useState(item?.location ?? "");
  const [quantity, setQuantity] = useState(item?.quantity != null ? String(item.quantity) : "");
  const [unitPrice, setUnitPrice] = useState(item?.unit_price != null ? String(item.unit_price) : "");
  const [priority, setPriority] = useState(item ? (item.priority ?? 0) : 3);
  const [purchased, setPurchased] = useState(item?.purchased ?? false);
  const [hasScheduledDate, setHasScheduledDate] = useState(!!item?.scheduled_date);
  const [scheduledDate, setScheduledDate] = useState(dateOr(item?.scheduled_date, todayInput()));
  const [hasAvailabilityDates, setHasAvailabilityDates] = useState(hasAvailability);
  const [availableStart, setAvailableStart] = useState(
    hasAvailability ? dateOr(item?.available_date_start, todayInput()) : todayInput(),
  );
  const [availableEnd, setAvailableEnd] = useState(
    hasAvailability ? dateOr(item?.available_date_end, weekLater) : weekLater,
  );
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);

  const isFormValid = name.trim() !== "";
  const qty = parseIntStrict(quantity);
  const price = parseDecimal(unitPrice);
  const showTotal = qty != null && qty > 0 && price != null && price > 0;

  const save = async () => {
    if (!isFormValid) return;
    setSubmitting(true);
    const ok = await onSave({
      item: name.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      unit_price: price,
      quantity: qty,
      purchased,
      priority: priority > 0 ? priority : null,
      scheduled_date: hasScheduledDate ? noonISO(scheduledDate) : null,
      available_date_start: hasAvailabilityDates ? noonISO(availableStart) : null,
      available_date_end: hasAvailabilityDates ? noonISO(availableEnd) : null,
    });
    setSubmitting(false);
    if (ok) onClose();
  };

  return (
    <Sheet
      title={isEdit ? "Edit Item" : "Add Item"}
      left={{ label: "Cancel", onPress: onClose }}
      right={{ label: isEdit ? "Save" : "Add", onPress: save, disabled: !isFormValid || submitting }}
      onClose={onClose}
    >
      {isEdit && (
        <Section>
          <ToggleRow label="Purchased" checked={purchased} onChange={setPurchased} />
          {purchased && (
            <Row className="text-label-2">
              <CircleCheck size={20} className="fill-ios-green text-cell" />
              Item marked as purchased
            </Row>
          )}
        </Section>
      )}

      <Section header="Item Details">
        <TextFieldRow placeholder="Item name" value={name} onChange={setName} autoFocus={!isEdit} />
        <div className="px-4 py-[11px]">
          <textarea
            rows={2}
            className="block max-h-28 w-full resize-none bg-transparent text-[17px] outline-none [field-sizing:content]"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <TextFieldRow placeholder="Location/Store (optional)" value={location} onChange={setLocation} />
      </Section>

      <Section header="Quantity & Price">
        <LabeledFieldRow label="Quantity" placeholder="0" inputMode="numeric" value={quantity} onChange={setQuantity} />
        <LabeledFieldRow
          label="Unit Price"
          placeholder="0.00"
          inputMode="decimal"
          value={unitPrice}
          onChange={setUnitPrice}
        />
        {showTotal && (
          <Row className="text-[16px] font-semibold">
            <span className="flex-1">Total</span>
            <span className="text-ios-blue">€{(qty * price).toFixed(2)}</span>
          </Row>
        )}
      </Section>

      <Section header="Priority">
        <SelectRow label="Priority Level" value={priority} onChange={setPriority} options={PRIORITY_OPTIONS} />
      </Section>

      <Section header="Schedule" footer="Set a date when you plan to purchase this item">
        <ToggleRow label="Set scheduled date" checked={hasScheduledDate} onChange={setHasScheduledDate} />
        {hasScheduledDate && <DateRow label="Scheduled for" value={scheduledDate} onChange={setScheduledDate} />}
      </Section>

      <Section header="Availability" footer="Useful for seasonal items or limited-time offers">
        <ToggleRow label="Set availability period" checked={hasAvailabilityDates} onChange={setHasAvailabilityDates} />
        {hasAvailabilityDates && (
          <DateRow
            label="Available from"
            value={availableStart}
            onChange={(v) => {
              setAvailableStart(v);
              if (availableEnd < v) setAvailableEnd(v);
            }}
          />
        )}
        {hasAvailabilityDates && (
          <DateRow label="Available until" value={availableEnd} min={availableStart} onChange={setAvailableEnd} />
        )}
      </Section>

      {item && (
        <Section header="Information">
          <ValueRow label="Created" value={formatDateTime(new Date(item.created_at))} />
          <ValueRow label="Last Updated" value={formatDateTime(new Date(item.updated_at))} />
        </Section>
      )}

      {isEdit && onDelete && (
        <Section>
          <ButtonRow destructive center onPress={() => setShowDeleteAlert(true)}>
            Delete Item
          </ButtonRow>
        </Section>
      )}

      {showDeleteAlert && onDelete && (
        <Alert
          title="Delete Item"
          message="Are you sure you want to delete this item? This action cannot be undone."
          buttons={[
            { label: "Cancel", role: "cancel" },
            {
              label: "Delete",
              role: "destructive",
              onPress: async () => {
                await onDelete();
                onClose();
              },
            },
          ]}
          onDismiss={() => setShowDeleteAlert(false)}
        />
      )}
    </Sheet>
  );
}
