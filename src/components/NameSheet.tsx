"use client";

// Settings → Name. Stored in Supabase Auth user metadata (user_metadata.full_name), so there is no
// table to keep in sync; the USER_UPDATED auth event refreshes the session with the new value.
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/helpers";
import { Section, Sheet, useAutoFocus } from "./ui";

const MAX_LENGTH = 50;

export function NameSheet({ initialName, onClose }: { initialName: string; onClose: () => void }) {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useAutoFocus<HTMLInputElement>();

  const trimmed = name.trim();
  const canSave = trimmed !== initialName.trim() && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      // An empty name removes it.
      const { error } = await supabase.auth.updateUser({ data: { full_name: trimmed || null } });
      if (error) throw error;
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      title="Name"
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
        <Section className="pt-4" footer={error ?? "Leave empty to remove your name."}>
          <input
            ref={ref}
            className="min-w-0 flex-1 bg-transparent px-4 py-[11px] text-[17px] outline-none"
            type="text"
            autoComplete="name"
            autoCapitalize="words"
            placeholder="Your Name"
            maxLength={MAX_LENGTH}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Section>
        {/* Enter submits the form. */}
        <button type="submit" className="hidden" />
      </form>
    </Sheet>
  );
}
