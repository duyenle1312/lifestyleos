import { describe, expect, it } from "vitest";
import type { OutboxEntry } from "./db";
import { badgeLabel, describeEntry } from "./syncLabels";

const entry = (over: Partial<OutboxEntry>): OutboxEntry => ({
  table: "expenses", op: "upsert", rowId: "r", payload: {}, createdAt: 0, attempts: 1, status: "failed", error: "x", ...over,
});
const base = { online: true, syncing: false, pending: 0, failed: 0, awaitingFirstPull: false };

describe("badgeLabel", () => {
  it("offline with nothing queued says just Offline", () => {
    expect(badgeLabel({ ...base, online: false }).label).toBe("Offline");
    expect(badgeLabel({ ...base, online: false, pending: 2 }).label).toBe("Offline · 2 changes waiting");
  });

  it("shows Syncing… only with pending changes or during the very first pull", () => {
    expect(badgeLabel({ ...base, syncing: true })).toEqual({ state: null, label: null });
    expect(badgeLabel({ ...base, syncing: true, pending: 1 }).label).toBe("Syncing…");
    expect(badgeLabel({ ...base, syncing: true, awaitingFirstPull: true }).label).toBe("Syncing…");
    expect(badgeLabel({ ...base, pending: 1 }).label).toBe("1 change waiting");
  });

  it("failed entries take precedence", () => {
    expect(badgeLabel({ ...base, online: false, failed: 2 })).toEqual({ state: "failed", label: "2 changes couldn't sync" });
  });
});

describe("describeEntry", () => {
  it("names entries by their item", () => {
    expect(describeEntry(entry({ payload: { item: "Milk" } }))).toBe("Milk");
    expect(describeEntry(entry({ table: "shopping_lists", payload: { item: "Bread" } }))).toBe("Bread");
    expect(describeEntry(entry({ op: "upsertMany", rowId: null, payload: [{ id: "a" }, { id: "b" }, { id: "c" }] }))).toBe("Receipt (3 items)");
  });

  it("falls back to the kind of row", () => {
    expect(describeEntry(entry({ payload: { item: "  " } }))).toBe("Expense save");
    expect(describeEntry(entry({ table: "shopping_lists", op: "delete", payload: {} }))).toBe("Shopping item delete");
  });
});
