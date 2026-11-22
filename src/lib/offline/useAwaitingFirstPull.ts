"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useLocalDb, useSyncStatus } from "@/components/OfflineProvider";
import { cursorKey } from "./pull";
import type { PullTable } from "./remote";

/**
 * True on a first launch while the first sync is still running and nothing has been pulled for `table`,
 * so an empty local table means "not loaded yet" rather than "no data".
 */
export function useAwaitingFirstPull(table: PullTable): boolean {
  const db = useLocalDb();
  const { syncing } = useSyncStatus();
  const cursor = useLiveQuery(async () => (await db.meta.get(cursorKey(table)))?.value ?? null, [db, table]);
  return syncing && cursor === null;
}
