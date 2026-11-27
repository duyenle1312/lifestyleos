// Option lists shared by the expense form and list.
export const CURRENCIES = ["EUR", "USD", "GBP", "JPY", "BGN", "CNY", "INR", "THB", "MXN", "VND", "IDR", "TRY", "CAD", "AUD", "CHF", "PLN", "CZK", "HUF", "KRW", "BRL", "SGD", "MYR", "PHP", "AED", "ZAR", "SEK", "NOK", "DKK", "RON"];

// Expense categories are per user now: see the `categories` table and CategoriesProvider.

// Payment methods are per user too: see the `payment_methods` table and PaymentMethodsProvider.

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
