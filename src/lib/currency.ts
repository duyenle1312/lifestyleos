import { CURRENCIES } from "./constants";

/** Currency choices for the form. An unknown current value (e.g. from an imported row) is kept, first. */
export function currencyOptions(current: string): string[] {
  return CURRENCIES.includes(current) ? CURRENCIES : [current, ...CURRENCIES];
}
