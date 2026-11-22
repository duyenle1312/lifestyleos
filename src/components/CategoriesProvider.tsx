"use client";

// The signed-in user's expense categories, shared by Expenses, Scan Receipt and Settings.
import { useLiveQuery } from "dexie-react-hooks";
import { createContext, useCallback, useContext, useMemo } from "react";
import { errorMessage } from "@/lib/helpers";
import * as api from "@/lib/services";
import type { Category } from "@/lib/types";
import { useUser } from "./AuthProvider";
import { useLocalDb, useSync, useSyncStatus } from "./OfflineProvider";

export const MAX_CATEGORY_NAME = 50;

export interface CategoryDraft {
  name: string;
  icon: string;
  color: string;
}

interface CategoriesState {
  categories: Category[];
  names: string[];
  byId: Map<string, Category>;
  /** Case-insensitive, trimmed lookup; null when unknown. */
  idByName: (name: string | null) => string | null;
  isLoading: boolean;
  loadError: string | null;
  /** Returns an error message, or null when the name is usable. */
  validateName: (name: string, exceptId?: string) => string | null;
  addCategory: (draft: CategoryDraft) => Promise<Category>;
  updateCategory: (id: string, draft: CategoryDraft) => Promise<Category>;
  /** Moves the category's expenses to `moveTo` (or uncategorized) and deletes it. */
  deleteCategory: (id: string, moveTo: string | null) => Promise<number>;
}

const CategoriesContext = createContext<CategoriesState | null>(null);

/** Postgres unique violation → friendly message. */
function friendly(e: unknown): Error {
  const code = (e as { code?: string })?.code;
  return new Error(code === "23505" ? "A category with this name already exists." : errorMessage(e));
}

export function CategoriesProvider({ children }: { children: React.ReactNode }) {
  const user = useUser();
  const db = useLocalDb();
  const { syncNow } = useSync();
  const { syncing } = useSyncStatus();
  const rows = useLiveQuery(() => db.categories.toArray(), [db]);
  const categories = useMemo(
    () => [...(rows ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)),
    [rows],
  );
  // Empty while a sync is running means "not pulled yet", not "no categories".
  const isLoading = rows === undefined || (rows.length === 0 && syncing);
  const loadError: string | null = null;

  const validateName = useCallback(
    (raw: string, exceptId?: string) => {
      const name = raw.trim();
      if (!name) return "Enter a name.";
      if (name.length > MAX_CATEGORY_NAME) return `Use at most ${MAX_CATEGORY_NAME} characters.`;
      const taken = categories.some((c) => c.id !== exceptId && c.name.toLowerCase() === name.toLowerCase());
      return taken ? "A category with this name already exists." : null;
    },
    [categories],
  );

  const idByName = useCallback(
    (name: string | null) => {
      const key = name?.trim().toLowerCase();
      return (key && categories.find((x) => x.name.toLowerCase() === key)?.id) || null;
    },
    [categories],
  );

  const addCategory = useCallback(
    async ({ name, icon, color }: CategoryDraft) => {
      const nextOrder = categories.reduce((max, c) => Math.max(max, c.sort_order), 0) + 1;
      try {
        const created = await api.createCategory(user.id, name.trim(), nextOrder, { icon, color });
        await db.categories.put(created);
        void syncNow();
        return created;
      } catch (e) {
        throw friendly(e);
      }
    },
    [categories, user.id, db, syncNow],
  );

  const updateCategory = useCallback(
    async (id: string, { name, icon, color }: CategoryDraft) => {
      const current = categories.find((c) => c.id === id);
      try {
        let updated = current!;
        if (current && current.name !== name.trim()) updated = await api.renameCategory(id, name.trim());
        if (current && (current.icon !== icon || current.color !== color)) {
          updated = await api.updateCategoryStyle(id, { icon, color });
        }
        await db.categories.put(updated);
        void syncNow();
        return updated;
      } catch (e) {
        throw friendly(e);
      }
    },
    [categories, db, syncNow],
  );

  const deleteCategory = useCallback(async (id: string, moveTo: string | null) => {
    try {
      const moved = await api.deleteCategory(id, moveTo);
      await db.transaction("rw", [db.categories, db.expenses], async () => {
        await db.categories.delete(id);
        await db.expenses.filter((x) => x.category_id === id).modify({ category_id: moveTo });
      });
      void syncNow();
      return moved;
    } catch (e) {
      throw friendly(e);
    }
  }, [db, syncNow]);

  const value = useMemo<CategoriesState>(
    () => ({
      categories,
      names: categories.map((c) => c.name),
      byId: new Map(categories.map((c) => [c.id, c])),
      idByName,
      isLoading,
      loadError,
      validateName,
      addCategory,
      updateCategory,
      deleteCategory,
    }),
    [categories, idByName, isLoading, loadError, validateName, addCategory, updateCategory, deleteCategory],
  );

  return <CategoriesContext.Provider value={value}>{children}</CategoriesContext.Provider>;
}

export function useCategories() {
  const ctx = useContext(CategoriesContext);
  if (!ctx) throw new Error("useCategories must be used inside <CategoriesProvider>");
  return ctx;
}
