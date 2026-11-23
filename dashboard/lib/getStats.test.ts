import { describe, expect, it, vi } from "vitest";
import { getStats } from "./getStats";
import { mockStats } from "./mock";

describe("getStats", () => {
  it("returns mock data without a database url", async () => {
    const r = await getStats({});
    expect(r.kind).toBe("mock");
    if (r.kind === "mock") {
      expect(r.stats.daily.expAdded.length).toBe(730);
      expect(r.stats.activeBuckets.d30.length).toBe(30);
      expect(r.stats.activeBuckets.w12.length).toBe(12);
      expect(r.stats.activeBuckets.m12.length).toBe(12);
    }
  });

  it("reports a connect error without leaking the password", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await getStats({ DASHBOARD_DATABASE_URL: "postgres://u:secretpw@127.0.0.1:1/postgres" });
    expect(r).toEqual({ kind: "error", reason: "connect" });
    expect(JSON.stringify(r)).not.toContain("secretpw");
    expect(JSON.stringify(spy.mock.calls)).not.toContain("secretpw");
    spy.mockRestore();
  });

  it("handles an unparseable url as a connect error without leaking it", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await getStats({ DASHBOARD_DATABASE_URL: "postgres://u:ab/cd@h:1/p" });
    expect(r).toEqual({ kind: "error", reason: "connect" });
    expect(JSON.stringify(r)).not.toContain("ab/cd");
    expect(JSON.stringify(spy.mock.calls)).not.toContain("ab/cd");
    spy.mockRestore();
  });
});

describe("mockStats", () => {
  it("is deterministic and complete", () => {
    const now = new Date("2026-11-23T10:00:00Z");
    const a = mockStats(now);
    expect(a).toEqual(mockStats(now));
    for (const series of Object.values(a.daily)) expect(series.length).toBe(730);
    expect(a.today).toBe("2026-11-23");
  });
});
