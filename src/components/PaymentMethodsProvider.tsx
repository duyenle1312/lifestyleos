"use client";

// The signed-in user's payment methods, shared by Expenses, Scan Receipt and Settings.
import { useLiveQuery } from "dexie-react-hooks";
import { createContext, useCallback, useContext, useMemo } from "react";
import { errorMessage } from "@/lib/helpers";
import * as api from "@/lib/services";
import type { PaymentMethod } from "@/lib/types";
import { useUser } from "./AuthProvider";
import { rewriteRefInOutbox } from "@/lib/offline/rewriteRef";
import { useAwaitingFirstPull } from "@/lib/offline/useAwaitingFirstPull";
import { useLocalDb, useSync } from "./OfflineProvider";

export const MAX_PAYMENT_METHOD_NAME = 50;

interface PaymentMethodsState {
  methods: PaymentMethod[];
  names: string[];
  byId: Map<string, PaymentMethod>;
  /** Case-insensitive, trimmed lookup; null when unknown. */
  idByName: (name: string | null) => string | null;
  isLoading: boolean;
  /** Returns an error message, or null when the name is usable. */
  validateName: (name: string, exceptId?: string) => string | null;
  addMethod: (name: string) => Promise<PaymentMethod>;
  renameMethod: (id: string, name: string) => Promise<PaymentMethod>;
  /** Moves the method's expenses to `moveTo` (or none) and deletes it. */
  deleteMethod: (id: string, moveTo: string | null) => Promise<number>;
}

const PaymentMethodsContext = createContext<PaymentMethodsState | null>(null);

/** Postgres unique violation → friendly message. */
function friendly(e: unknown): Error {
  const code = (e as { code?: string })?.code;
  return new Error(code === "23505" ? "A payment method with this name already exists." : errorMessage(e));
}

export function PaymentMethodsProvider({ children }: { children: React.ReactNode }) {
  const user = useUser();
  const db = useLocalDb();
  const { syncNow } = useSync();
  const awaitingFirstPull = useAwaitingFirstPull("refs");
  const rows = useLiveQuery(() => db.paymentMethods.toArray(), [db]);
  const methods = useMemo(
    () => [...(rows ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)),
    [rows],
  );
  // Empty before the first pull of reference data has finished means "not pulled yet", not "no payment methods".
  const isLoading = rows === undefined || (rows.length === 0 && awaitingFirstPull);

  const validateName = useCallback(
    (raw: string, exceptId?: string) => {
      const name = raw.trim();
      if (!name) return "Enter a name.";
      if (name.length > MAX_PAYMENT_METHOD_NAME) return `Use at most ${MAX_PAYMENT_METHOD_NAME} characters.`;
      const taken = methods.some((m) => m.id !== exceptId && m.name.toLowerCase() === name.toLowerCase());
      return taken ? "A payment method with this name already exists." : null;
    },
    [methods],
  );

  const idByName = useCallback(
    (name: string | null) => {
      const key = name?.trim().toLowerCase();
      return (key && methods.find((x) => x.name.toLowerCase() === key)?.id) || null;
    },
    [methods],
  );

  const addMethod = useCallback(
    async (name: string) => {
      const nextOrder = methods.reduce((max, m) => Math.max(max, m.sort_order), 0) + 1;
      try {
        const created = await api.createPaymentMethod(user.id, name.trim(), nextOrder);
        await db.paymentMethods.put(created);
        void syncNow();
        return created;
      } catch (e) {
        throw friendly(e);
      }
    },
    [methods, user.id, db, syncNow],
  );

  const renameMethod = useCallback(async (id: string, name: string) => {
    try {
      const updated = await api.renamePaymentMethod(id, name.trim());
      await db.paymentMethods.put(updated);
      void syncNow();
      return updated;
    } catch (e) {
      throw friendly(e);
    }
  }, [db, syncNow]);

  const deleteMethod = useCallback(async (id: string, moveTo: string | null) => {
    try {
      const moved = await api.deletePaymentMethod(id, moveTo);
      await db.transaction("rw", [db.paymentMethods, db.expenses, db.outbox], async () => {
        await db.paymentMethods.delete(id);
        await db.expenses.filter((x) => x.payment_method_id === id).modify({ payment_method_id: moveTo });
        await rewriteRefInOutbox(db, "payment_method_id", id, moveTo);
      });
      void syncNow();
      return moved;
    } catch (e) {
      throw friendly(e);
    }
  }, [db, syncNow]);

  const value = useMemo<PaymentMethodsState>(
    () => ({
      methods,
      names: methods.map((m) => m.name),
      byId: new Map(methods.map((m) => [m.id, m])),
      idByName,
      isLoading,
      validateName,
      addMethod,
      renameMethod,
      deleteMethod,
    }),
    [methods, idByName, isLoading, validateName, addMethod, renameMethod, deleteMethod],
  );

  return <PaymentMethodsContext.Provider value={value}>{children}</PaymentMethodsContext.Provider>;
}

export function usePaymentMethods() {
  const ctx = useContext(PaymentMethodsContext);
  if (!ctx) throw new Error("usePaymentMethods must be used inside <PaymentMethodsProvider>");
  return ctx;
}
