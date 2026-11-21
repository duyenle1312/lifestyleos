"use client";

// Port of ViewModels/AuthViewModel.swift
import type { Session, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/helpers";

interface AuthState {
  user: User | null;
  session: Session | null;
  /** True until the stored session has been checked on first load. */
  initializing: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  clearError: () => void;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitializing(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setIsLoading(false);
    if (error) {
      setError(error.message);
      return false;
    }
    return true;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (!data.session || !data.user) {
        setError("Check your email to confirm your account, then sign in.");
        return false;
      }
      await createDefaultAccount(data.user.id);
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) setError(error.message);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user: session?.user ?? null,
      session,
      initializing,
      isLoading,
      errorMessage: error,
      clearError: () => setError(null),
      signIn,
      signUp,
      signOut,
    }),
    [session, initializing, isLoading, error, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Same as AuthViewModel.createDefaultAccount: a "My Kitchen" account owned by the new user. */
async function createDefaultAccount(userId: string) {
  try {
    const { data: account, error } = await supabase.from("accounts").insert({ name: "My Kitchen" }).select().single();
    if (error) throw error;
    const { error: linkError } = await supabase
      .from("account_users")
      .insert({ account_id: account.id, user_id: userId, role: "owner" });
    if (linkError) throw linkError;
  } catch (e) {
    console.error("Error creating account:", e);
  }
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** For pages rendered inside the authenticated shell. */
export function useUser() {
  const { user } = useAuth();
  if (!user) throw new Error("useUser called while signed out");
  return user;
}
