// Keyset pagination over (updated_at, id): rows updated mid-pagination can't shift later pages and get skipped.
type Row = Record<string, unknown>;
export type After = { updated_at: string; id: string };

/** PostgREST `or` filter selecting rows strictly after the given key in (updated_at, id) order. */
export const afterFilter = (last: After) =>
  `updated_at.gt.${last.updated_at},and(updated_at.eq.${last.updated_at},id.gt.${last.id})`;

/** Calls fetchPage until a short page; `after` is null for the first page. */
export async function pageAll(fetchPage: (after: After | null) => Promise<Row[]>, size: number): Promise<Row[]> {
  const out: Row[] = [];
  let after: After | null = null;
  for (;;) {
    const rows = await fetchPage(after);
    out.push(...rows);
    if (rows.length < size) return out;
    const last = rows[rows.length - 1];
    after = { updated_at: last.updated_at as string, id: last.id as string };
  }
}
