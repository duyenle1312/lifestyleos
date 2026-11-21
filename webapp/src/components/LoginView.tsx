"use client";

// Port of Views/Auth/LoginView.swift + SignUpView.swift
import { useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { Sheet, Spinner } from "./ui";

const fieldClass = "w-full rounded-[10px] bg-gray6 p-4 text-[17px] outline-none";
const primaryButton =
  "flex w-full items-center justify-center rounded-[10px] bg-ios-blue p-4 text-[17px] font-semibold text-white disabled:opacity-50";

export function LoginView() {
  const { signIn, isLoading, errorMessage, clearError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showSignUp, setShowSignUp] = useState(false);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-primary-bg p-4">
      <form
        className="flex w-full max-w-md flex-col items-center gap-5 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          signIn(email, password);
        }}
      >
        <span className="mb-5 flex size-20 items-center justify-center rounded-full bg-ios-blue text-white">
          <UtensilsCrossed size={40} />
        </span>
        <h1 className="text-[34px] font-bold leading-tight">Kitchen Inventory</h1>

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
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {errorMessage && !showSignUp && <p className="text-center text-xs text-ios-red">{errorMessage}</p>}
          <button className={primaryButton} disabled={isLoading || !email || !password}>
            {isLoading ? <Spinner className="text-white" /> : "Sign In"}
          </button>
          <button
            type="button"
            className="text-[17px] text-ios-blue"
            onClick={() => {
              clearError();
              setShowSignUp(true);
            }}
          >
            Don&apos;t have an account? Sign Up
          </button>
        </div>
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
