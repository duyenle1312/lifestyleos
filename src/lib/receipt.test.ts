import { describe, expect, it } from "vitest";
import { receiptToExpenseInputs } from "./receipt";
import type { ScannedReceipt } from "./types";

const resolve = {
  categoryId: (n: string | null) => (n ? `cat-${n}` : null),
  paymentMethodId: (n: string | null) => (n ? `pm-${n}` : null),
};
const base = { storeName: "Lidl", date: "2026-03-05", currency: "EUR", total: 0, paymentMethod: "Card" } as unknown as ScannedReceipt;
const item = (o: object) => ({ id: "1", name: "Milk", amount: 3, quantity: 1, category: "Food", ...o }) as never;

describe("receiptToExpenseInputs", () => {
  it("maps fields and resolves ids", () => {
    const [r] = receiptToExpenseInputs(base, [item({})], resolve);
    expect(r).toMatchObject({ amount: 3, currency: "EUR", category_id: "cat-Food", payment_method_id: "pm-Card", location: "Lidl", unit: 1, unit_price: 3, description: null, expire_date: null });
  });
  it("rounds unit_price to 4 decimals and defaults bad quantity to 1", () => {
    const rows = receiptToExpenseInputs(base, [item({ amount: 10, quantity: 3 }), item({ amount: 2, quantity: 0 }), item({ amount: 2, quantity: null })], resolve);
    expect(rows.map((r) => r.unit_price)).toEqual([3.3333, 2, 2]);
    expect(rows.map((r) => r.unit)).toEqual([3, 1, 1]);
  });
  it("uses noon local on the receipt date, now when invalid", () => {
    const [a] = receiptToExpenseInputs(base, [item({})], resolve);
    const d = new Date(a.expense_date);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 2, 5, 12]);
    const before = Date.now();
    const [b] = receiptToExpenseInputs({ ...base, date: "garbage" }, [item({})], resolve);
    expect(new Date(b.expense_date).getTime()).toBeGreaterThanOrEqual(before - 1000);
  });
  it("returns nothing for no items", () => {
    expect(receiptToExpenseInputs(base, [], resolve)).toEqual([]);
  });
});
