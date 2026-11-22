import { describe, expect, it } from "vitest";
import { afterFilter, pageAll } from "./paging";

describe("pageAll", () => {
  const rows = Array.from({ length: 5 }, (_, i) => ({ id: `r${i}`, updated_at: `2026-01-0${i + 1}T00:00:00Z` }));
  it("pages by key until a short page", async () => {
    const afters: unknown[] = [];
    const out = await pageAll(async (after) => {
      afters.push(after);
      const start = after ? rows.findIndex((r) => r.id === after.id) + 1 : 0;
      return rows.slice(start, start + 2);
    }, 2);
    expect(out).toHaveLength(5);
    expect(afters).toEqual([null, { id: "r1", updated_at: rows[1].updated_at }, { id: "r3", updated_at: rows[3].updated_at }]);
  });
  it("makes one extra call when the last page is exactly full", async () => {
    let calls = 0;
    await pageAll(async (after) => (calls++, after ? [] : rows.slice(0, 2)), 2);
    expect(calls).toBe(2);
  });
  it("builds the strictly-after filter", () => {
    expect(afterFilter({ updated_at: "T", id: "x" })).toBe("updated_at.gt.T,and(updated_at.eq.T,id.gt.x)");
  });
});
