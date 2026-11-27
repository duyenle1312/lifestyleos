import { describe, expect, it } from "vitest";
import { formatMoney, formatTotals, mainCurrency, totalsByCurrency } from "./money";

const r = (amount: number, currency: string) => ({ amount, currency });

describe("money", () => {
  it("groups and sorts", () => {
    expect(totalsByCurrency([r(1.29, "EUR"), r(89, "THB"), r(2, "EUR")])).toEqual([
      { currency: "THB", amount: 89, count: 1 },
      { currency: "EUR", amount: 3.29, count: 2 },
    ]);
  });
  it("treats a missing currency as EUR and rounds float sums", () => {
    expect(totalsByCurrency([r(0.1, ""), r(0.2, "EUR")])).toEqual([{ currency: "EUR", amount: 0.3, count: 2 }]);
  });
  it("main currency is by entry count, EUR wins ties, all-THB is THB", () => {
    expect(mainCurrency([r(1, "EUR"), r(500, "THB"), r(2, "EUR")])).toBe("EUR");
    expect(mainCurrency([r(1, "EUR"), r(500, "THB")])).toBe("EUR");
    expect(mainCurrency([r(5, "THB"), r(6, "THB")])).toBe("THB");
    expect(mainCurrency([r(5, "USD"), r(6, "THB")])).toBe("THB");
    expect(mainCurrency([])).toBe("EUR");
  });
  it("formats", () => {
    expect(formatTotals([{ currency: "EUR", amount: 312.4, count: 1 }, { currency: "THB", amount: 1250, count: 1 }])).toBe(
      `${formatMoney(312.4, "EUR")} · ${formatMoney(1250, "THB")}`,
    );
    expect(formatMoney(312.4, "EUR")).toBe("€312.40");
    expect(formatMoney(1250, "THB").replace(/\s/g, " ")).toBe("THB 1,250.00");
    expect(formatMoney(3, "XYZ1")).toBe("3.00 XYZ1");
    expect(formatTotals([])).toBe("€0.00");
  });
});
