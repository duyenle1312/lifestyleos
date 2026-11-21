"use client";

// Port of Views/Auth/LoginView.swift + SignUpView.swift: email + password sign-in by default,
// with an optional magic-link sign-in. If Supabase's email quota is used up, the magic-link
// option falls back to the password form.
import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { Sheet, Spinner } from "./ui";

const fieldClass = "w-full rounded-[10px] bg-gray6 p-4 text-[17px] outline-none";
const primaryButton =
  "flex w-full items-center justify-center rounded-[10px] bg-ios-blue p-4 text-[17px] font-semibold text-white disabled:opacity-50";
const linkButton = "text-[17px] text-ios-blue";

/** "password": default sign-in · "link": ask for a magic link · "sent": link emailed. */
type Mode = "password" | "link" | "sent";

export function LoginView() {
  const { sendMagicLink, signInWithPassword, isLoading, errorMessage, clearError } = useAuth();
  const [mode, setMode] = useState<Mode>("password");
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
        <h1 className="text-[34px] font-bold leading-tight">{mode === "sent" ? "Check your email" : "Lifestyle OS"}</h1>

        {mode === "sent" ? (
          <div className="flex w-full flex-col gap-[15px] p-4 text-center">
            <p className="text-[17px] text-label-2">
              We sent a sign-in link to <span className="font-semibold text-label">{email.trim()}</span>. Open it on
              this device to sign in.
            </p>
            {errorMessage && <p className="text-xs text-ios-red">{errorMessage}</p>}
            <button className={primaryButton} disabled={isLoading}>
              {isLoading ? <Spinner className="text-white" /> : "Resend Link"}
            </button>
            <button type="button" className={linkButton} onClick={() => switchTo("password")}>
              Back to sign in
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
            {errorMessage && !showSignUp && <p className="text-center text-xs text-ios-red">{errorMessage}</p>}
            {mode === "password" ? (
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
                  Email me a sign-in link instead
                </button>
              </>
            ) : (
              <>
                <button className={primaryButton} disabled={isLoading || !email.trim()}>
                  {isLoading ? <Spinner className="text-white" /> : "Email Me a Sign-In Link"}
                </button>
                <button type="button" className={linkButton} onClick={() => switchTo("password")}>
                  Use password instead
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
