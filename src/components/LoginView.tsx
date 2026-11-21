"use client";

// Port of Views/Auth/LoginView.swift, but passwordless: one email field sends a magic link,
// which signs in existing users and creates the account for new ones (no separate sign-up).
import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { Spinner } from "./ui";

const fieldClass = "w-full rounded-[10px] bg-gray6 p-4 text-[17px] outline-none";
const primaryButton =
  "flex w-full items-center justify-center rounded-[10px] bg-ios-blue p-4 text-[17px] font-semibold text-white disabled:opacity-50";

export function LoginView() {
  const { sendMagicLink, isLoading, errorMessage, clearError } = useAuth();
  const [email, setEmail] = useState("");
  /** The address the link went to; set once sending succeeds. */
  const [sentTo, setSentTo] = useState<string | null>(null);

  const send = async () => {
    const address = email.trim();
    if (await sendMagicLink(address)) setSentTo(address);
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-primary-bg p-4">
      <form
        className="flex w-full max-w-md flex-col items-center gap-5 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <h1 className="text-[34px] font-bold leading-tight">{sentTo ? "Check your email" : "Lifestyle OS"}</h1>

        {sentTo ? (
          <div className="flex w-full flex-col gap-[15px] p-4 text-center">
            <p className="text-[17px] text-label-2">
              We sent a sign-in link to <span className="font-semibold text-label">{sentTo}</span>. Open it on this
              device to sign in.
            </p>
            {errorMessage && <p className="text-xs text-ios-red">{errorMessage}</p>}
            <button className={primaryButton} disabled={isLoading}>
              {isLoading ? <Spinner className="text-white" /> : "Resend Link"}
            </button>
            <button
              type="button"
              className="text-[17px] text-ios-blue"
              onClick={() => {
                clearError();
                setSentTo(null);
              }}
            >
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
              autoFocus
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {errorMessage && <p className="text-center text-xs text-ios-red">{errorMessage}</p>}
            <button className={primaryButton} disabled={isLoading || !email.trim()}>
              {isLoading ? <Spinner className="text-white" /> : "Email Me a Sign-In Link"}
            </button>
            <p className="text-center text-[13px] text-label-2">
              No password needed. Check your email.
            </p>
          </div>
        )}
      </form>
    </div>
  );
}
