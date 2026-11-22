import Dexie from "dexie";
import type { Session, User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it } from "vitest";
import { openUserDb } from "./db";
import { cleanupOtherUserDbs, forgetRememberedUser, rememberUser, resolveInitialUser } from "./session";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

const user = { id: "u1", email: "a@b.c", user_metadata: { full_name: "A" }, extra: "x" } as unknown as User;
const networkError = Object.assign(new Error("Failed to fetch"), {});

describe("remembered user", () => {
  it("stores only the minimal subset and forgets it", () => {
    rememberUser(user);
    expect(JSON.parse(store.get("lifestyleos:lastUser")!)).toEqual({ id: "u1", email: "a@b.c", user_metadata: { full_name: "A" } });
    forgetRememberedUser();
    expect(store.size).toBe(0);
  });
});

describe("resolveInitialUser", () => {
  it("returns the session user when there is a session", () => {
    expect(resolveInitialUser({ user } as Session, null, true)).toBe(user);
  });
  it("returns the remembered user when offline with no session", () => {
    rememberUser(user);
    expect(resolveInitialUser(null, null, false)?.id).toBe("u1");
  });
  it("returns the remembered user when online but the error is retryable", () => {
    rememberUser(user);
    expect(resolveInitialUser(null, networkError, true)?.id).toBe("u1");
  });
  it("returns null when online and the error is non-retryable", () => {
    rememberUser(user);
    expect(resolveInitialUser(null, { status: 400, code: "refresh_token_not_found" }, true)).toBeNull();
  });
  it("returns null when nothing is remembered", () => {
    expect(resolveInitialUser(null, null, false)).toBeNull();
  });
});

describe("cleanupOtherUserDbs", () => {
  it("deletes clean other dbs, keeps ones with queued changes and the current one", async () => {
    const mk = async (id: string, pending: boolean) => {
      const db = openUserDb(id);
      if (pending)
        await db.outbox.add({ table: "expenses", op: "delete", rowId: "r", payload: {}, createdAt: 1, attempts: 0, status: "pending", error: null });
      else await db.meta.put({ key: "k", value: 1 });
      db.close();
    };
    await mk("cur", false);
    await mk("clean", false);
    await mk("dirty", true);
    await cleanupOtherUserDbs("cur");
    const names = await Dexie.getDatabaseNames();
    expect(names).toContain("lifestyleos-cur");
    expect(names).toContain("lifestyleos-dirty");
    expect(names).not.toContain("lifestyleos-clean");
  });
});
