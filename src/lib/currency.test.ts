import { expect, it } from "vitest";
import { CURRENCIES } from "./constants";
import { currencyOptions } from "./currency";
it("has the nomad currencies", () => {
  for (const c of ["THB","MXN","VND","IDR","TRY","CAD","AUD","CHF","PLN","CZK","HUF","KRW","BRL","SGD","MYR","PHP","AED","ZAR","SEK","NOK","DKK","RON"]) expect(CURRENCIES).toContain(c);
  expect(new Set(CURRENCIES).size).toBe(CURRENCIES.length);
});
it("includes an unknown current value first, once", () => {
  expect(currencyOptions("ARS")[0]).toBe("ARS");
  expect(currencyOptions("EUR").filter((c) => c === "EUR")).toHaveLength(1);
  expect(currencyOptions("EUR")).toEqual(CURRENCIES);
});
