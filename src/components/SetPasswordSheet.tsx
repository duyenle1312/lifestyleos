"use client";

// Settings → Password. Magic-link users have no password; this gives them one, so they can still
// sign in when sign-in emails can't be sent. Also changes an existing password.
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/helpers";
import { Section, Sheet, useAutoFocus } from "./ui";

/** Supabase's default minimum (Auth → Providers → Email → Minimum password length). */
const MIN_LENGTH = 6;

export function SetPasswordSheet({
  email,
  onDone,
  onClose,
}: {
  email: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstRef = useAutoFocus<HTMLInputElement>();

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSave = password.length >= MIN_LENGTH && password === confirm && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const field = "min-w-0 flex-1 bg-transparent px-4 py-[11px] text-[17px] outline-none";

  return (
    <Sheet
      title="Password"
      left={{ label: "Cancel", onPress: onClose }}
      right={{ label: "Save", onPress: save, disabled: !canSave }}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {/* Lets password managers offer to save the new password for this account. */}
        <input type="email" autoComplete="username" className="hidden" readOnly value={email} />
        <Section
          className="pt-4"
          footer={
            error ??
            (tooShort
              ? `Use at least ${MIN_LENGTH} characters.`
              : mismatch
                ? "Passwords do not match."
                : "Sign in with your email and this password when a sign-in link isn't an option.")
          }
        >
          <input
            ref={firstRef}
            className={field}
            type="password"
            autoComplete="new-password"
            placeholder="New Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            className={field}
            type="password"
            autoComplete="new-password"
            placeholder="Confirm Password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Section>
        {/* Enter submits the form. */}
        <button type="submit" className="hidden" />
      </form>
    </Sheet>
  );
}
