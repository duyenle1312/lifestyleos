import {
  Coins,
  Dumbbell,
  House,
  Landmark,
  Leaf,
  type LucideIcon,
  Monitor,
  PawPrint,
  ShoppingCart,
  Smartphone,
  Tag,
  TramFront,
  UtensilsCrossed,
} from "lucide-react";

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

// ExpenseRow.categoryIcon / categoryColor
export function categoryIcon(category: string | null): LucideIcon {
  switch (category) {
    case "Food & Drink":
    case "Eating Out":
      return UtensilsCrossed;
    case "Home":
      return ShoppingCart;
    case "Transport":
      return TramFront;
    case "Telecom":
      return Smartphone;
    case "Fun":
      return Dumbbell;
    case "Rent & Utilities":
    case "Utilities":
      return House;
    case "Work":
      return Monitor;
    case "Crochet":
      return PawPrint;
    case "Gold/Silver":
      return Coins;
    case "ETFs":
      return Landmark;
    case "Garden":
      return Leaf;
    default:
      return Tag;
  }
}

export function categoryColor(category: string | null): IOSColor {
  switch (category) {
    case "Food & Drink":
      return "blue";
    case "Transport":
    case "Crochet":
      return "orange";
    case "Home":
      return "indigo";
    case "Eating Out":
      return "pink";
    case "Fun":
      return "purple";
    case "Rent & Utilities":
    case "Utilities":
      return "cyan";
    case "Telecom":
      return "mint";
    case "Gold/Silver":
      return "yellow";
    case "ETFs":
    case "Garden":
      return "green";
    case "Other":
    case null:
    case "":
      return "gray";
    default:
      return hashedColor(category);
  }
}

/** Custom categories get a stable color derived from their name. */
const CUSTOM_PALETTE: IOSColor[] = ["blue", "green", "orange", "pink", "purple", "indigo", "cyan", "mint", "red"];

function hashedColor(name: string): IOSColor {
  let h = 0;
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CUSTOM_PALETTE[h % CUSTOM_PALETTE.length];
}
