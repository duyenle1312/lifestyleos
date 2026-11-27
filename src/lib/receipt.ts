// Receipt prompt + parser. Gemini reads the image directly (no separate OCR step).
import { noonISO } from "./helpers";
import type { ExpenseInput } from "./services";
import { type ReceiptItem, receiptItemDisplayName, type ScannedReceipt } from "./types";

const FALLBACK_CATEGORIES = ["Food & Drink", "Home", "Other"];

/** Category names are user-provided: keep them short and strip characters that could break the format. */
export function sanitizeCategories(input: unknown): string[] {
  if (!Array.isArray(input)) return FALLBACK_CATEGORIES;
  const clean = input
    .filter((c): c is string => typeof c === "string")
    .map((c) => c.replace(/["|\r\n]/g, " ").trim().slice(0, 50))
    .filter(Boolean)
    .slice(0, 100);
  return clean.length ? clean : FALLBACK_CATEGORIES;
}

export const buildReceiptPrompt = (categories: string[]) => `Extract information from this receipt image and translate item names to English, keeping each original name too.

Prices must be the FINAL amount actually paid. The price of an item is the total of that line after any discount, promotion or coupon applied to it (for example, a line of 4.99 followed by a discount line of -1.00 means the item price is 3.99). Do not list discount lines as separate items. If a discount applies to the whole receipt rather than one line, spread it across the items in proportion to their prices, so that the item prices add up to TOTAL. TOTAL is the final amount paid for the whole receipt.

For each item, pick one corresponding category from this list: ${categories.map((c) => `"${c}"`).join(", ")}

Return the data in this EXACT plain text format (one field per line):

STORE: [store name]
DATE: [YYYY-MM-DD]
CURRENCY: [currency code, e.g., EUR, BGN, USD]
TOTAL: [total amount as decimal number]
ITEMS_START
[Item name exactly as printed]|[Item name in English]|[price as decimal]|[quantity as integer or decimal for fresh produce in kg]|[category]
[Item name exactly as printed]|[Item name in English]|[price as decimal]|[quantity as integer or decimal for fresh produce in kg]|[category]
ITEMS_END

CURRENCY is the ISO 4217 code of TOTAL. If the receipt prints two currencies, use the one the total was paid in.

Example output:
STORE: Lidl
DATE: 2025-01-10
CURRENCY: EUR
TOTAL: 15.50
ITEMS_START
Тоалетна хартия|Toilet Paper|12.0|1|Home
Прясно мляко 1л|Fresh Milk 1L|2.30|2|Food & Drink
Домати|Tomatoes|3.50|1.7|Food & Drink
ITEMS_END`;

const num = (s: string, fallback: number) => {
  const n = Number(s.trim());
  return Number.isFinite(n) && s.trim() !== "" ? n : fallback;
};

/** Trimmed, upper-cased ISO 4217-shaped code, or "EUR" when missing/invalid. */
export function normalizeCurrency(raw: string | null | undefined): string {
  const code = (raw ?? "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : "EUR";
}

export function parseReceiptResponse(text: string): ScannedReceipt {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let storeName: string | null = null;
  let date: string | null = null;
  let total = 0;
  let currency = "EUR";
  const items: ScannedReceipt["items"] = [];
  let inItems = false;

  for (const line of lines) {
    if (line.startsWith("STORE:")) storeName = line.slice(6).trim() || null;
    else if (line.startsWith("DATE:")) date = line.slice(5).trim() || null;
    else if (line.startsWith("CURRENCY:")) currency = normalizeCurrency(line.slice(9));
    else if (line.startsWith("TOTAL:")) total = num(line.slice(6), 0);
    else if (line === "ITEMS_START") inItems = true;
    else if (line === "ITEMS_END") inItems = false;
    else if (inItems) {
      const parts = line.split("|");
      if (parts.length === 4 || parts.length === 5) {
        // 5 fields: original|English|price|qty|category. 4 fields (older format): English only.
        const [name, translatedName, ...rest] = parts.length === 5 ? parts : [parts[0], parts[0], ...parts.slice(1)];
        items.push({
          id: crypto.randomUUID(),
          name: name.trim(),
          translatedName: translatedName.trim(),
          amount: num(rest[0], 0),
          quantity: num(rest[1], 1),
          category: rest[2].trim(),
        });
      }
    }
  }

  return { storeName, date, items, total, currency };
}

/**
 * One expense input per receipt line item, dated with the receipt's date (noon, local) or now if it is
 * missing/invalid. unit_price = line price / quantity (rounded to 4 decimals) so unit x unit_price = amount.
 */
export function receiptToExpenseInputs(
  receipt: ScannedReceipt,
  items: ReceiptItem[],
  resolve: {
    categoryId: (name: string | null) => string | null;
    paymentMethodId: (name: string | null) => string | null;
  },
): ExpenseInput[] {
  const expenseDate =
    receipt.date && /^\d{4}-\d{2}-\d{2}$/.test(receipt.date) ? noonISO(receipt.date) : new Date().toISOString();
  return items.map((item) => {
    const quantity = item.quantity && item.quantity > 0 ? item.quantity : 1;
    return {
      amount: item.amount,
      currency: receipt.currency,
      expense_date: expenseDate,
      category_id: resolve.categoryId(item.category),
      description: null,
      location: receipt.storeName,
      unit: quantity,
      unit_price: Math.round((item.amount / quantity) * 10_000) / 10_000,
      expire_date: null,
      payment_method_id: resolve.paymentMethodId(receipt.paymentMethod ?? null),
      item: receiptItemDisplayName(item),
    };
  });
}
