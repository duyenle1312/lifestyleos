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
  /**
   * Optional passwordless sign-in. "sent" once the email is on its way; "rate_limited" when
   * Supabase's email quota is used up (the login screen falls back to password); "error" otherwise.
   */
  sendMagicLink: (email: string) => Promise<MagicLinkResult>;
  signInWithPassword: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

export type MagicLinkResult = "sent" | "rate_limited" | "error";

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
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      // Covers password sign-ins, email-confirmation links and magic links alike.
      // Deferred: Supabase calls inside this callback can deadlock the auth client.
      if (event === "SIGNED_IN" && next) setTimeout(() => ensureDefaultAccount(next.user.id), 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  /** Emails a one-time sign-in link (also creates the user if the email is new). */
  const sendMagicLink = useCallback(async (email: string): Promise<MagicLinkResult> => {
    setIsLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          // The link brings the user back to the site they asked from (must be in
          // Supabase → Auth → URL Configuration → Redirect URLs, otherwise Site URL is used).
          // The SIGNED_IN listener above then picks up the session and creates the default account.
          emailRedirectTo: `${window.location.origin}/expenses`,
        },
      });
      if (error) {
        // Supabase can't tell the browser how much quota is left; this error code is the signal.
        if (error.code === "over_email_send_rate_limit" || error.status === 429) {
          setError("Too many sign-in emails were sent recently. Sign in with your password instead.");
          return "rate_limited";
        }
        throw error;
      }
      return "sent";
    } catch (e) {
      setError(errorMessage(e));
      return "error";
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
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
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        // Send the confirmation link back to the site the user signed up on (must be in
        // Supabase → Auth → URL Configuration → Redirect URLs, otherwise Site URL is used).
        options: { emailRedirectTo: `${window.location.origin}/expenses` },
      });
      if (error) throw error;
      // Supabase hides whether an email is registered: for an existing account it returns a
      // user with no identities and sends no email.
      if (data.user && data.user.identities?.length === 0) {
        setError("An account with this email already exists. Please sign in instead.");
        return false;
      }
      if (!data.session || !data.user) {
        setError("Check your email to confirm your account, then sign in.");
        return false;
      }
      // The default account is created by the SIGNED_IN listener (ensureDefaultAccount).
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
      sendMagicLink,
      signInWithPassword,
      signUp,
      signOut,
    }),
    [session, initializing, isLoading, error, sendMagicLink, signInWithPassword, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Same as AuthViewModel.createDefaultAccount: a "Personal" account owned by the new user.
 * iOS runs it right after signUp; with email confirmation (and magic links) there may be no session
 * then, so here it runs on every sign-in and is a no-op once the account exists.
 *
 * The app writes every row with account_id = the user's id (see services.ts), so the account
 * must have that same id, and the user must be linked to it, or RLS rejects the inserts.
 * The check is for that specific account, so users whose account got a random id are repaired.
 */
async function ensureDefaultAccount(userId: string) {
  try {
    const { data: existing, error: lookupError } = await supabase
      .from("account_users")
      .select("account_id")
      .eq("user_id", userId)
      .eq("account_id", userId)
      .limit(1);
    if (lookupError) throw lookupError;
    if (existing.length > 0) return;

    const { error } = await supabase.from("accounts").upsert({ id: userId, name: "Personal" }, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw error;
    const { error: linkError } = await supabase
      .from("account_users")
      .insert({ account_id: userId, user_id: userId, role: "owner" });
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
