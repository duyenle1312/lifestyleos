"use client";

// Port of ExpenseDetailView (ExpenseListView.swift). Reads the live expense from the list so edits show up.
// Narrow screens present it as a sheet; the split view (lg+) shows the same body inline as an inspector pane.
import { Pencil, Trash2 } from "lucide-react";
import { IconBubble } from "@/components/glyphs";
import { categoryVisual } from "@/lib/categoryStyle";
import { formatMedium } from "@/lib/helpers";
import type { Category, Expense } from "@/lib/types";
import { Row, Section, Sheet, ValueRow } from "../ui";

function ExpenseDetailSections({ expense }: { expense: Expense }) {
  return (
    <>
      <Section header="Amount">
        <Row>
          <span className="flex-1">Total</span>
          <span className="font-semibold">
            {expense.amount.toFixed(2)} {expense.currency}
          </span>
        </Row>
        {expense.unit != null && expense.unit_price != null && (
          <ValueRow label="Unit Price" value={`${expense.unit_price.toFixed(2)} × ${expense.unit.toFixed(2)}`} />
        )}
      </Section>

      <Section header="Details">
        {expense.item && <ValueRow label="Item" value={expense.item} />}
        {expense.category && <ValueRow label="Category" value={expense.category} />}
        <ValueRow label="Date" value={formatMedium(new Date(expense.expense_date))} />
        {expense.location && <ValueRow label="Location" value={expense.location} />}
        {expense.payment_method && <ValueRow label="Payment" value={expense.payment_method} />}
        {expense.expire_date && <ValueRow label="Expires" value={formatMedium(new Date(expense.expire_date))} />}
      </Section>

      {expense.description && (
        <Section header="Description">
          <Row className="whitespace-pre-wrap">{expense.description}</Row>
        </Section>
      )}
    </>
  );
}

/** Modal presentation (phones / narrow windows). */
export function ExpenseDetail({
  expense,
  onClose,
  onEdit,
}: {
  expense: Expense;
  onClose: () => void;
  onEdit: () => void;
}) {
  return (
    <Sheet
      title="Expense Details"
      left={{ label: "Done", onPress: onClose }}
      right={{ label: "Edit", onPress: onEdit, bold: false }}
      onClose={onClose}
    >
      <ExpenseDetailSections expense={expense} />
    </Sheet>
  );
}

/** Inline presentation for the split view's right-hand pane. */
export function ExpenseInspector({
  expense,
  category,
  onEdit,
  onDelete,
}: {
  expense: Expense;
  category?: Category;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { Icon, color } = categoryVisual(category);
  return (
    <div className="animate-fade-in pb-8">
      <div className="flex flex-col items-center gap-2 px-6 pt-8 pb-2 text-center">
        <IconBubble icon={Icon} color={color} />
        <p className="text-[15px] text-label-2">{expense.item ?? category?.name ?? expense.category ?? "Expense"}</p>
        <p className="text-[34px] font-bold leading-tight tabular-nums">
          {expense.amount.toFixed(2)} <span className="text-[20px] font-semibold text-label-2">{expense.currency}</span>
        </p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1.5 rounded-full bg-ios-blue px-4 py-1.5 text-[15px] font-medium text-white hover:opacity-90"
          >
            <Pencil size={14} /> Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-1.5 rounded-full bg-fill px-4 py-1.5 text-[15px] font-medium text-ios-red hover:bg-gray5"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>
      <ExpenseDetailSections expense={expense} />
    </div>
  );
}
