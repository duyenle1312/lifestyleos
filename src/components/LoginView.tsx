"use client";

// Port of Views/Auth/LoginView.swift + SignUpView.swift: magic-link sign-in by default, which also
// signs up new emails (no password needed). Password sign-in and sign-up stay as the backup for when
// the email quota is used up: a rate-limited magic link switches the screen to the password form.
import { useState } from "react";
import { AppLogo } from "./AppLogo";
import { useAuth } from "./AuthProvider";
import { Sheet, Spinner } from "./ui";

const fieldClass = "w-full rounded-[10px] bg-gray6 p-4 text-[17px] outline-none";
const primaryButton =
  "flex w-full items-center justify-center rounded-[10px] bg-ios-blue p-4 text-[17px] font-semibold text-white disabled:opacity-50";
const linkButton = "text-[17px] text-ios-blue";

/** "link": default, ask for a magic link · "password": password sign-in · "sent": link emailed. */
type Mode = "password" | "link" | "sent";

export function LoginView() {
  const { sendMagicLink, signInWithPassword, isLoading, errorMessage, clearError } = useAuth();
  const [mode, setMode] = useState<Mode>("link");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showSignUp, setShowSignUp] = useState(false);

  const switchTo = (next: Mode) => {
    clearError();
    setMode(next);
  };

  const submit = async () => {
    if (mode === "password") {
      await signInWithPassword(email.trim(), password);
      return;
    }
    const result = await sendMagicLink(email.trim());
    if (result === "sent") setMode("sent");
    // Keep the rate-limit message visible: it explains why the password field appeared.
    if (result === "rate_limited") setMode("password");
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-primary-bg p-4">
      <form
        className="flex w-full max-w-md flex-col items-center gap-5 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <AppLogo className="size-16" />
        <h1 className="text-[34px] font-bold leading-tight">{mode === "sent" ? "Check your email" : "Lifestyle OS"}</h1>

        {mode === "sent" ? (
          <div className="flex w-full flex-col gap-[15px] p-4 text-center">
            <p className="text-[17px] text-label-2">
              We sent a link to <span className="font-semibold text-label">{email.trim()}</span>. Open it on
              this device to sign in.
            </p>
            {errorMessage && <p className="text-xs text-ios-red">{errorMessage}</p>}
            <button className={primaryButton} disabled={isLoading}>
              {isLoading ? <Spinner className="text-white" /> : "Resend Link"}
            </button>
            <button type="button" className={linkButton} onClick={() => switchTo("link")}>
              Use a different email
            </button>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-[15px] p-4">
            <input
              className={fieldClass}
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {mode === "password" && (
              <input
                className={fieldClass}
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
            {/* {mode === "link" && (
              <p className="text-center text-[15px] text-label-2">
                We&apos;ll email you a link to sign in.
              </p>
            )} */}
            {errorMessage && !showSignUp && <p className="text-center text-xs text-ios-red">{errorMessage}</p>}
            {mode === "link" ? (
              <>
                <button className={primaryButton} disabled={isLoading || !email.trim()}>
                  {isLoading ? <Spinner className="text-white" /> : "Sign in with Email"}
                </button>
                <button type="button" className="text-[15px] text-label-2" onClick={() => switchTo("password")}>
                  Sign in with password instead
                </button>
              </>
            ) : (
              <>
                <button className={primaryButton} disabled={isLoading || !email.trim() || !password}>
                  {isLoading ? <Spinner className="text-white" /> : "Sign In"}
                </button>
                <button
                  type="button"
                  className={linkButton}
                  onClick={() => {
                    clearError();
                    setShowSignUp(true);
                  }}
                >
                  Don&apos;t have an account? Sign Up
                </button>
                <button type="button" className="text-[15px] text-label-2" onClick={() => switchTo("link")}>
                  Sign in with an email link instead
                </button>
              </>
            )}
          </div>
        )}
      </form>

      {showSignUp && (
        <SignUpSheet
          onClose={() => {
            clearError();
            setShowSignUp(false);
          }}
        />
      )}
    </div>
  );
}

function SignUpSheet({ onClose }: { onClose: () => void }) {
  const { signUp, isLoading, errorMessage } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = confirm.length > 0 && password !== confirm;

  return (
    <Sheet onClose={onClose} right={{ label: "Cancel", onPress: onClose, bold: false }} background="primary">
      <form
        className="flex flex-col items-center gap-5 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await signUp(email, password)) onClose();
        }}
      >
        <AppLogo className="size-14" />
        <h2 className="pb-5 text-[28px] font-bold">Create Account</h2>
        <div className="flex w-full flex-col gap-[15px] p-4">
          <input
            className={fieldClass}
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className={fieldClass}
            type="password"
            autoComplete="new-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            className={fieldClass}
            type="password"
            autoComplete="new-password"
            placeholder="Confirm Password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {mismatch && <p className="text-center text-xs text-ios-red">Passwords do not match</p>}
          {errorMessage && <p className="text-center text-xs text-ios-red">{errorMessage}</p>}
          <button className={primaryButton} disabled={isLoading || !email || !password || password !== confirm}>
            {isLoading ? <Spinner className="text-white" /> : "Sign Up"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
