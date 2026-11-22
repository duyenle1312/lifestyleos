"use client";

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
   * Default sign-in, and also sign-up: an unknown email gets an account on its first link.
   * "sent" once the email is on its way; "rate_limited" when the email quota is used up
   * (the login screen falls back to password); "error" otherwise.
   */
  sendMagicLink: (email: string) => Promise<MagicLinkResult>;
  /** Backup to magic links: works even when the email quota is used up. */
  signInWithPassword: (email: string, password: string) => Promise<boolean>;
  /**
   * Backup sign-up with a password. Sends no email (so it works when the quota is used up)
   * only if "Confirm email" is off in Supabase → Auth → Sign In / Providers → Email.
   */
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

  /** Emails a one-time sign-in link. A new email gets an account (no password) on its first link. */
  const sendMagicLink = useCallback(async (email: string): Promise<MagicLinkResult> => {
    setIsLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // First link for an unknown email creates the user; Supabase sends the "Confirm signup"
          // template instead of "Magic Link". Needs "Allow new users to sign up" on in Supabase.
          shouldCreateUser: true,
          // The email links to /auth/confirm on the site the user asked from, where a button
          // finishes sign-in (so email scanners can't use the link up). Must be in Supabase →
          // Auth → URL Configuration → Redirect URLs, otherwise Site URL is used.
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      });
      if (error) {
        // Supabase can't tell the browser how much quota is left; this error code is the signal.
        if (error.code === "over_email_send_rate_limit" || error.status === 429) {
          setError("Too many sign-in emails were sent recently. Try again in a minute, or sign in with your password.");
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
        // Same /auth/confirm landing page as magic links (see sendMagicLink).
        options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
      });
      if (error) {
        if (error.code === "over_email_send_rate_limit" || error.status === 429) {
          throw new Error(
            "Can't send the confirmation email right now. Try again later, or turn off \"Confirm email\" in Supabase so password sign-ups skip the email.",
          );
        }
        throw error;
      }
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
 * Creates a "Personal" account owned by the new user.
 * The database already does this on sign-up (trigger on_auth_user_created_account, see
 * supabase/migrations/20261122170000_create_account_on_signup.sql); this is a fallback repair.
 * With magic links there is no session until the link is opened,
 * so here it runs on every sign-in and is a no-op once the account exists. The account's
 * `signed_up_at` column defaults to now(), so it records the user's first sign-in.
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
