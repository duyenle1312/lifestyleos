"use client";

import type { Session, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/helpers";
import { isRetryable } from "@/lib/offline/remote";
import { cleanupOtherUserDbs, forgetRememberedUser, needsLocalSignOut, rememberUser, rememberedUserId, resolveInitialUser } from "@/lib/offline/session";

interface AuthState {
  user: User | null;
  session: Session | null;
  /**
   * True when there is no live session but the remembered user is shown (offline with an expired login).
   * They keep working with their local data until the connection returns and the login is refreshed.
   */
  isOfflineSession: boolean;
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
  /**
   * Signs in with the 6-digit code from the same email as the magic link. Resolves true on success
   * (the SIGNED_IN listener then sets up the session), false with an error message otherwise.
   */
  verifyEmailCode: (email: string, code: string) => Promise<boolean>;
  /** Backup to magic links: works even when the email quota is used up. */
  signInWithPassword: (email: string, password: string) => Promise<boolean>;
  /**
   * Backup sign-up with a password. Sends no email (so it works when the quota is used up)
   * only if "Confirm email" is off in Supabase → Auth → Sign In / Providers → Email.
   */
  signUp: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  /**
   * Set when the signed-in user's account or account link could not be created/checked.
   * Without it RLS rejects every read and write, so the app shows it instead of failing silently.
   */
  accountSetupError: string | null;
  retryAccountSetup: () => void;
  dismissAccountSetupError: () => void;
}

export type MagicLinkResult = "sent" | "rate_limited" | "error";

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [offlineUser, setOfflineUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountSetupError, setAccountSetupError] = useState<string | null>(null);

  const setUpAccount = useCallback(async (userId: string) => {
    try {
      await ensureDefaultAccount(userId);
      setAccountSetupError(null);
    } catch (e) {
      console.error("Error creating account:", e);
      setAccountSetupError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    // getSession returns no session (plus an error) when the token is expired and cannot be refreshed offline.
    supabase.auth
      .getSession()
      .then(({ data, error }) => ({ session: data.session, error }))
      .catch((error: unknown) => ({ session: null, error }))
      .then(({ session: found, error }) => {
        setSession(found);
        if (found) rememberUser(found.user);
        else setOfflineUser(resolveInitialUser(null, error, navigator.onLine));
        setInitializing(false);
      });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      const previousUserId = rememberedUserId();
      if (next) {
        setOfflineUser(null);
        rememberUser(next.user);
      }
      if (event === "SIGNED_OUT") setOfflineUser(null);
      // Covers password sign-ins, email-confirmation links and magic links alike.
      // Deferred: Supabase calls inside this callback can deadlock the auth client.
      if (event === "SIGNED_IN" && next) {
        setTimeout(() => {
          void setUpAccount(next.user.id);
          // Only when a different account signed in than the one remembered (not on every launch).
          if (previousUserId !== next.user.id) void cleanupOtherUserDbs(next.user.id);
        }, 0);
      }
      if (event === "SIGNED_OUT") setAccountSetupError(null);
    });
    return () => data.subscription.unsubscribe();
  }, [setUpAccount]);

  const isOfflineSession = !session && !!offlineUser;

  // An offline-session user who gets a connection back: refresh the login. A rejected login signs out locally and
  // forgets the remembered user (so later offline launches don't open their data without a valid session); their
  // database and queued changes are kept for their next sign-in. A network failure keeps the offline session.
  // refreshSession often returns a cached failure (Supabase's ~60s refresh-failure cooldown), so retry once later.
  useEffect(() => {
    if (!isOfflineSession) return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const tryRefresh = async (isRetry = false) => {
      if (!navigator.onLine) return;
      let failure: unknown = null;
      try {
        const { error } = await supabase.auth.refreshSession();
        failure = error;
      } catch (e) {
        failure = e;
      }
      if (cancelled || !failure) return;
      if (isRetryable(failure)) {
        if (!isRetry) {
          clearTimeout(retryTimer); // repeated "online" events must not stack retries
          retryTimer = setTimeout(() => void tryRefresh(true), 65_000);
        }
        return;
      }
      forgetRememberedUser();
      await supabase.auth.signOut({ scope: "local" });
      if (!cancelled) setOfflineUser(null);
    };
    const onOnline = () => void tryRefresh();
    onOnline();
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      window.removeEventListener("online", onOnline);
    };
  }, [isOfflineSession]);

  /**
   * Verifies the emailed 6-digit code. Unlike a magic link, this works inside the home-screen app
   * on iOS, because nothing leaves the app (the link opens Safari, which has separate storage).
   */
  const verifyEmailCode = useCallback(async (email: string, code: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
      if (error) {
        setError("That code is wrong or has expired. Check the latest email or resend.");
        return false;
      }
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setIsLoading(false);
    }
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
    // Forgetting first is self-healing: if sign-out fails online, the live session is still found on next load and re-remembered.
    forgetRememberedUser();
    setOfflineUser(null);
    const { error } = await supabase.auth.signOut();
    // A global sign-out that fails (offline) leaves the stored session and refresh token, which would silently sign
    // the user back in once online. Always sign this device out locally; the server-side revoke is simply skipped.
    if (needsLocalSignOut(error, isOfflineSession)) {
      const { error: localError } = await supabase.auth.signOut({ scope: "local" });
      // A network-type error here (offline) is not a real failure: the local sign-out still removed the session.
      if (localError && !isRetryable(localError)) setError(localError.message);
    }
  }, [isOfflineSession]);

  const value = useMemo<AuthState>(
    () => ({
      user: session?.user ?? offlineUser,
      session,
      isOfflineSession,
      initializing,
      isLoading,
      errorMessage: error,
      clearError: () => setError(null),
      sendMagicLink,
      verifyEmailCode,
      signInWithPassword,
      signUp,
      signOut,
      accountSetupError,
      retryAccountSetup: () => {
        if (session) setUpAccount(session.user.id);
      },
      dismissAccountSetupError: () => setAccountSetupError(null),
    }),
    [session, offlineUser, isOfflineSession, initializing, isLoading, error, sendMagicLink, verifyEmailCode, signInWithPassword, signUp, signOut, accountSetupError, setUpAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Creates a "Personal" account owned by the new user.
 * The database already does this on sign-up (trigger on_auth_user_created_account, see
 * supabase/migrations/20261122170000_create_account_on_signup.sql); this is a fallback repair.
 * Throws on failure; AuthProvider turns that into accountSetupError, which AppShell shows.
 * With magic links there is no session until the link is opened,
 * so here it runs on every sign-in and is a no-op once the account exists.
 *
 * The app writes every row with account_id = the user's id (see services.ts), so the account
 * must have that same id, and the user must be linked to it, or RLS rejects the inserts.
 * The check is for that specific account, so users whose account got a random id are repaired.
 */
async function ensureDefaultAccount(userId: string) {
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
