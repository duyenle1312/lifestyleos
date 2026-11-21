"use client";

// Port of ExpenseDetailView (ExpenseListView.swift). Reads the live expense from the list so edits show up.
import { useState } from "react";
import { formatMedium } from "@/lib/helpers";
import type { ExpenseInput } from "@/lib/services";
import type { Expense } from "@/lib/types";
import { Row, Section, Sheet, ValueRow } from "../ui";
import { ExpenseForm } from "./ExpenseForm";

export function ExpenseDetail({
  expense,
  onClose,
  onUpdate,
  onDuplicate,
}: {
  expense: Expense;
  onClose: () => void;
  onUpdate: (id: string, input: ExpenseInput) => Promise<boolean>;
  onDuplicate: (input: ExpenseInput) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <>
      <Sheet
        title="Expense Details"
        left={{ label: "Done", onPress: onClose }}
        right={{ label: "Edit", onPress: () => setEditing(true), bold: false }}
        onClose={onClose}
      >
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
      </Sheet>

      {editing && (
        <ExpenseForm
          expense={expense}
          onSave={(input) => onUpdate(expense.id, input)}
          onDuplicate={onDuplicate}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}
