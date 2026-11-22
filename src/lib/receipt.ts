// Receipt prompt + parser. Gemini reads the image directly (no separate OCR step).
import type { ScannedReceipt } from "./types";

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

export const buildReceiptPrompt = (categories: string[]) => `Extract information from this receipt image and translate item names to English.

Prices must be the FINAL amount actually paid. The price of an item is the total of that line after any discount, promotion or coupon applied to it (for example, a line of 4.99 followed by a discount line of -1.00 means the item price is 3.99). Do not list discount lines as separate items. If a discount applies to the whole receipt rather than one line, spread it across the items in proportion to their prices, so that the item prices add up to TOTAL. TOTAL is the final amount paid for the whole receipt.

For each item, pick one corresponding category from this list: ${categories.map((c) => `"${c}"`).join(", ")}

Return the data in this EXACT plain text format (one field per line):

STORE: [store name]
DATE: [YYYY-MM-DD]
CURRENCY: [currency code, e.g., EUR, BGN, USD]
TOTAL: [total amount as decimal number]
ITEMS_START
[Item name in English]|[price as decimal]|[quantity as integer or decimal for fresh produce in kg]|[category]
[Item name in English]|[price as decimal]|[quantity as integer or decimal for fresh produce in kg]|[category]
ITEMS_END

Example output:
STORE: Lidl
DATE: 2025-01-10
CURRENCY: EUR
TOTAL: 15.50
ITEMS_START
Toilet Paper|12.0|1|Home
Fresh Milk 1L|2.30|2|Food & Drink
Tomatoes|3.50|1.7|Food & Drink
ITEMS_END`;

const num = (s: string, fallback: number) => {
  const n = Number(s.trim());
  return Number.isFinite(n) && s.trim() !== "" ? n : fallback;
};

export function parseReceiptResponse(text: string): ScannedReceipt {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let storeName: string | null = null;
  let date: string | null = null;
  let total = 0;
  const items: ScannedReceipt["items"] = [];
  let inItems = false;

  for (const line of lines) {
    if (line.startsWith("STORE:")) storeName = line.slice(6).trim() || null;
    else if (line.startsWith("DATE:")) date = line.slice(5).trim() || null;
    else if (line.startsWith("CURRENCY:")) continue; // currency is forced to EUR
    else if (line.startsWith("TOTAL:")) total = num(line.slice(6), 0);
    else if (line === "ITEMS_START") inItems = true;
    else if (line === "ITEMS_END") inItems = false;
    else if (inItems) {
      const parts = line.split("|");
      if (parts.length === 4) {
        const name = parts[0].trim();
        items.push({
          id: crypto.randomUUID(),
          name,
          translatedName: name,
          amount: num(parts[1], 0),
          quantity: num(parts[2], 1),
          category: parts[3].trim(),
        });
      }
    }
  }

  return { storeName, date, items, total, currency: "EUR" };
}
