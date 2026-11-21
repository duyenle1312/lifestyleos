// Lists copied from AddExpenseView / EditExpenseView / ExpenseListView.
export const CURRENCIES = ["EUR", "USD", "GBP", "JPY", "BGN", "CNY", "INR"];

// Expense categories are per user now: see the `categories` table and CategoriesProvider.

export const PAYMENT_METHODS = ["Food Voucher", "T212", "Revolut", "UBB", "Curve", "Paypal", "VCB", "Cash", "Other"];

export const PRIORITY_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "None" },
  { value: 1, label: "⭐ Low" },
  { value: 2, label: "⭐⭐ Medium" },
  { value: 3, label: "⭐⭐⭐ High" },
  { value: 4, label: "⭐⭐⭐⭐ Urgent" },
  { value: 5, label: "⭐⭐⭐⭐⭐ Critical" },
];

/** iOS system color names → CSS variables defined in globals.css. */
export type IOSColor =
  | "blue"
  | "green"
  | "red"
  | "orange"
  | "yellow"
  | "pink"
  | "purple"
  | "indigo"
  | "cyan"
  | "mint"
  | "gray";

export const iosColor = (c: IOSColor) => `var(--ios-${c})`;
export const iosTint = (c: IOSColor, pct = 20) => `color-mix(in srgb, var(--ios-${c}) ${pct}%, transparent)`;
