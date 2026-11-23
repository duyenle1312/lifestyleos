import "server-only";
import postgres from "postgres";
import { mockStats } from "./mock";
import type { StatsResult, UsageStats } from "./types";

const CONNECT_CODES = new Set(["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "ECONNRESET", "CONNECT_TIMEOUT", "28P01"]);

export async function getStats(env: Record<string, string | undefined> = process.env): Promise<StatsResult> {
  const url = env.DASHBOARD_DATABASE_URL;
  if (!url) return { kind: "mock", stats: mockStats(new Date()) };

  let sql: ReturnType<typeof postgres> | null = null;
  try {
    sql = postgres(url, { prepare: false, ssl: "require", max: 1, connect_timeout: 5, idle_timeout: 5 });
    const t0 = performance.now();
    const rows = await sql<{ s: UsageStats }[]>`select dashboard.usage_stats() as s`;
    const dbMs = performance.now() - t0;
    return { kind: "db", stats: rows[0].s, dbMs };
  } catch (e) {
    const err = e as { code?: string; errno?: string; message?: string; errors?: Array<{ code?: string }> };
    const invalidUrl = err.code === "ERR_INVALID_URL" || err instanceof TypeError;
    const codes = [err.code, err.errno, ...(err.errors?.map((x) => x.code) ?? [])];
    const reason = invalidUrl || codes.some((c) => c && CONNECT_CODES.has(c)) ? "connect" : "query";
    // Never log the error object or its `input`: they can hold the connection URL.
    // An invalid URL logs a fixed string; otherwise only the code and message.
    if (invalidUrl) console.error(`dashboard getStats failed (${reason}): invalid DASHBOARD_DATABASE_URL`);
    else console.error(`dashboard getStats failed (${reason}):`, err.code ?? "", err.message ?? "");
    return { kind: "error", reason };
  } finally {
    await sql?.end({ timeout: 5 }).catch(() => {});
  }
}
