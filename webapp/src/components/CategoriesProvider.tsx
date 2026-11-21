"use client";

// The signed-in user's expense categories, shared by Expenses, Scan Receipt and Settings.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { errorMessage } from "@/lib/helpers";
import * as api from "@/lib/services";
import type { Category } from "@/lib/types";
import { useUser } from "./AuthProvider";

export const MAX_CATEGORY_NAME = 50;

interface CategoriesState {
  categories: Category[];
  names: string[];
  isLoading: boolean;
  loadError: string | null;
  /** Returns an error message, or null when the name is usable. */
  validateName: (name: string, exceptId?: string) => string | null;
  addCategory: (name: string) => Promise<Category>;
  renameCategory: (id: string, name: string) => Promise<Category>;
}

const CategoriesContext = createContext<CategoriesState | null>(null);

/** Postgres unique violation → friendly message. */
function friendly(e: unknown): Error {
  const code = (e as { code?: string })?.code;
  return new Error(code === "23505" ? "A category with this name already exists." : errorMessage(e));
}

export function CategoriesProvider({ children }: { children: React.ReactNode }) {
  const user = useUser();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .fetchCategories(user.id)
      .then((rows) => !cancelled && setCategories(rows))
      .catch((e) => !cancelled && setLoadError(errorMessage(e)))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user.id]);

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

  const addCategory = useCallback(
    async (raw: string) => {
      const nextOrder = categories.reduce((max, c) => Math.max(max, c.sort_order), 0) + 1;
      try {
        const created = await api.createCategory(user.id, raw.trim(), nextOrder);
        setCategories((list) => [...list, created]);
        return created;
      } catch (e) {
        throw friendly(e);
      }
    },
    [categories, user.id],
  );

  const renameCategory = useCallback(async (id: string, raw: string) => {
    try {
      const updated = await api.renameCategory(id, raw.trim());
      setCategories((list) => list.map((c) => (c.id === id ? updated : c)));
      return updated;
    } catch (e) {
      throw friendly(e);
    }
  }, []);

  const value = useMemo<CategoriesState>(
    () => ({
      categories,
      names: categories.map((c) => c.name),
      isLoading,
      loadError,
      validateName,
      addCategory,
      renameCategory,
    }),
    [categories, isLoading, loadError, validateName, addCategory, renameCategory],
  );

  return <CategoriesContext.Provider value={value}>{children}</CategoriesContext.Provider>;
}

export function useCategories() {
  const ctx = useContext(CategoriesContext);
  if (!ctx) throw new Error("useCategories must be used inside <CategoriesProvider>");
  return ctx;
}
