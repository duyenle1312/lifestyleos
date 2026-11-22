// The real Remote, backed by supabase-js. RLS scopes every query to the signed-in user.
import { supabase } from "@/lib/supabase";
import { type PullTable, type ReferenceTable, type Remote, type RemoteTable } from "./remote";
import { afterFilter, pageAll } from "./paging";
import { normalizeThrown, unwrap } from "./remoteErrors";

const PAGE = 1000;

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw normalizeThrown(e);
  }
}

async function fetchPages(table: string, build: (q: ReturnType<typeof baseQuery>) => ReturnType<typeof baseQuery>): Promise<object[]> {
  const out: object[] = [];
  for (let from = 0; ; from += PAGE) {
    const res = await build(baseQuery(table)).range(from, from + PAGE - 1);
    unwrap(res);
    const rows = (res.data ?? []) as object[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

const baseQuery = (table: string) => supabase.from(table).select("*");

export const supabaseRemote: Remote = {
  upsert: (table: RemoteTable, rows: object[]) =>
    guard(async () => {
      const res = await supabase.from(table).upsert(rows, { onConflict: "id" }).select();
      unwrap(res);
      return (res.data ?? []) as object[];
    }),

  softDelete: (table: RemoteTable, id: string) =>
    guard(async () => {
      unwrap(await supabase.from(table).update({ deleted_at: new Date().toISOString() }).eq("id", id));
    }),

  fetchRow: (table: RemoteTable, id: string) =>
    guard(async () => {
      const res = await supabase.from(table).select().eq("id", id).maybeSingle();
      unwrap(res);
      return (res.data as object | null) ?? null;
    }),

  fetchChangedSince: (table: PullTable, cursor: string | null) =>
    guard(() =>
      pageAll(async (after) => {
        let q = baseQuery(table);
        if (after) q = q.or(afterFilter(after));
        else if (cursor) q = q.gte("updated_at", cursor);
        const res = await q.order("updated_at", { ascending: true }).order("id", { ascending: true }).limit(PAGE);
        unwrap(res);
        return (res.data ?? []) as Record<string, unknown>[];
      }, PAGE),
    ),

  fetchAll: (table: ReferenceTable, accountId: string) =>
    guard(() => fetchPages(table, (q) => q.eq("account_id", accountId).order("id", { ascending: true }))),
};
