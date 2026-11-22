"use client";

// Expense form (one form, two modes: add and edit).
import { useState } from "react";
import { Copy } from "lucide-react";
import { CURRENCIES } from "@/lib/constants";
import { useCategories } from "../CategoriesProvider";
import { CategoryEditorSheet } from "../categories/CategoryEditorSheet";
import { PaymentMethodEditorSheet } from "../payment-methods/PaymentMethodEditorSheet";
import { usePaymentMethods } from "../PaymentMethodsProvider";
import { addMonths, noonISO, parseDecimal, toDateInput, todayInput } from "@/lib/helpers";
import type { ExpenseInput } from "@/lib/services";
import type { Expense } from "@/lib/types";
import {
  Alert,
  ButtonRow,
  DateRow,
  Row,
  Section,
  SelectRow,
  Sheet,
  TextAreaRow,
  TextFieldRow,
  ToggleRow,
} from "../ui";

const opts = (values: string[], placeholder?: string) => [
  ...(placeholder ? [{ value: "", label: placeholder }] : []),
  ...values.map((v) => ({ value: v, label: v })),
];

/** Sentinel option in the category picker that opens the "New Category" sheet. */
const NEW_CATEGORY = "__new_category__";
/** Sentinel option in the payment picker that opens the "New Payment Method" sheet. */
const NEW_PAYMENT_METHOD = "__new_payment_method__";

/** Strip binary float noise (3 × 1.1 = 3.3000000000000003) without rounding real decimals. */
const clean = (n: number) => Math.round(n * 1e6) / 1e6;

export function ExpenseForm({
  expense,
  onSave,
  onDuplicate,
  onClose,
}: {
  /** Present → edit mode. */
  expense?: Expense;
  onSave: (input: ExpenseInput) => Promise<boolean>;
  onDuplicate?: (input: ExpenseInput) => Promise<boolean>;
  onClose: () => void;
}) {
  const isEdit = !!expense;
  const { categories, byId, idByName } = useCategories();
  const { methods } = usePaymentMethods();
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [showNewPaymentMethod, setShowNewPaymentMethod] = useState(false);
  const [item, setItem] = useState(expense?.item ?? "");
  const [unit, setUnit] = useState(expense ? (expense.unit != null ? String(expense.unit) : "") : "1");
  const [unitPrice, setUnitPrice] = useState(expense?.unit_price != null ? expense.unit_price.toFixed(2) : "");
  const [hasExpireDate, setHasExpireDate] = useState(!!expense?.expire_date);
  const [expireDate, setExpireDate] = useState(
    expense?.expire_date ? toDateInput(new Date(expense.expire_date)) : todayInput(),
  );
  const [currency, setCurrency] = useState(expense?.currency ?? "EUR");
  const [expenseDate, setExpenseDate] = useState(
    expense ? toDateInput(new Date(expense.expense_date)) : todayInput(),
  );
  /** Selected category id, "" for none. */
  const [categoryId, setCategoryId] = useState(() => {
    if (expense) return expense.category_id && byId.has(expense.category_id) ? expense.category_id : "";
    return idByName("Food & Drink") ?? categories[0]?.id ?? "";
  });
  const [location, setLocation] = useState(expense?.location ?? "");
  const [paymentMethodId, setPaymentMethodId] = useState(expense?.payment_method_id ?? "");
  const [description, setDescription] = useState(expense?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [showDuplicateAlert, setShowDuplicateAlert] = useState(false);

  const categoryOptions = [
    { value: "", label: "Select Category" },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
    { value: NEW_CATEGORY, label: "New Category…" },
  ];

  const unitNum = parseDecimal(unit);
  const priceNum = parseDecimal(unitPrice);
  const calculatedAmount = unitNum && unitNum > 0 && priceNum && priceNum > 0 ? (unitNum * priceNum).toFixed(2) : "0.00";
  const canSave = unit.trim() !== "" && unitPrice.trim() !== "" && !saving;

  const buildInput = (monthOffset = 0): ExpenseInput | null => {
    if (unitNum == null || priceNum == null) return null;
    const shift = (input: string) =>
      monthOffset ? toDateInput(addMonths(new Date(noonISO(input)), monthOffset)) : input;
    return {
      amount: clean(unitNum * priceNum),
      currency,
      expense_date: noonISO(shift(expenseDate)),
      category_id: categoryId || null,
      description: description || null,
      location: location || null,
      unit: unitNum,
      unit_price: priceNum,
      expire_date: hasExpireDate ? noonISO(shift(expireDate)) : null,
      payment_method_id: paymentMethodId || null,
      item: item || null,
    };
  };

  const submit = async (action: (input: ExpenseInput) => Promise<boolean>, monthOffset = 0) => {
    const input = buildInput(monthOffset);
    if (!input) return;
    setSaving(true);
    const ok = await action(input);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Sheet
      title={isEdit ? "Edit Expense" : "Add Expense"}
      left={{ label: "Cancel", onPress: onClose }}
      right={{ label: "Save", onPress: () => submit(onSave), disabled: !canSave }}
      onClose={onClose}
    >
      <Section header="Item Details">
        <TextFieldRow placeholder="Item Name" value={item} onChange={setItem} />
        <Row>
          <input
            className="min-w-0 flex-1 bg-transparent outline-none"
            placeholder="Quantity"
            inputMode="decimal"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          />
          <span className="text-label-2">×</span>
          <input
            className="min-w-0 flex-1 bg-transparent outline-none"
            placeholder="Unit Price"
            inputMode="decimal"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
          />
        </Row>
        <ToggleRow label="Has Expiration Date" checked={hasExpireDate} onChange={setHasExpireDate} />
        {hasExpireDate && <DateRow label="Expiration Date" value={expireDate} onChange={setExpireDate} />}
      </Section>

      <Section header="Basic Information">
        <Row>
          <span className="flex-1">Total Amount</span>
          <span className="text-[16px] font-semibold text-label-2">{calculatedAmount}</span>
        </Row>
        <SelectRow label="Currency" value={currency} onChange={setCurrency} options={opts(CURRENCIES)} />
        <DateRow label="Date" value={expenseDate} onChange={setExpenseDate} />
        <SelectRow
          label="Category"
          value={categoryId}
          onChange={(v) => (v === NEW_CATEGORY ? setShowNewCategory(true) : setCategoryId(v))}
          options={categoryOptions}
        />
      </Section>

      <Section header="Additional Information">
        <TextFieldRow placeholder="Location" value={location} onChange={setLocation} />
        <SelectRow
          label="Payment Method"
          value={paymentMethodId}
          onChange={(v) => (v === NEW_PAYMENT_METHOD ? setShowNewPaymentMethod(true) : setPaymentMethodId(v))}
          options={[
            { value: "", label: "Select Method" },
            ...methods.map((m) => ({ value: m.id, label: m.name })),
            { value: NEW_PAYMENT_METHOD, label: "New Payment Method…" },
          ]}
        />
      </Section>

      <Section header="Description">
        <TextAreaRow value={description} onChange={setDescription} />
      </Section>

      {isEdit && onDuplicate && (
        <Section>
          <ButtonRow onPress={() => setShowDuplicateAlert(true)}>
            <Copy size={18} /> Duplicate to Next Month
          </ButtonRow>
        </Section>
      )}

      {showNewCategory && (
        <CategoryEditorSheet onSaved={(created) => setCategoryId(created.id)} onClose={() => setShowNewCategory(false)} />
      )}

      {showNewPaymentMethod && (
        <PaymentMethodEditorSheet
          onSaved={(created) => setPaymentMethodId(created.id)}
          onClose={() => setShowNewPaymentMethod(false)}
        />
      )}

      {showDuplicateAlert && onDuplicate && (
        <Alert
          title="Duplicate Expense"
          message="This will create a copy of this expense with the date set to next month."
          buttons={[
            { label: "Cancel", role: "cancel" },
            { label: "Duplicate", onPress: () => submit(onDuplicate, 1) },
          ]}
          onDismiss={() => setShowDuplicateAlert(false)}
        />
      )}
    </Sheet>
  );
}
