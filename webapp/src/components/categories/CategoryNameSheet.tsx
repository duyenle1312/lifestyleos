"use client";

// Sheet with a single name field, used to create or rename a category.
import { useState } from "react";
import { errorMessage } from "@/lib/helpers";
import { MAX_CATEGORY_NAME, useCategories } from "../CategoriesProvider";
import { Row, Section, Sheet } from "../ui";

export function CategoryNameSheet({
  title,
  actionLabel,
  initialName = "",
  exceptId,
  footer,
  onSubmit,
  onClose,
}: {
  title: string;
  actionLabel: string;
  initialName?: string;
  /** When renaming, the category's own id (so its current name isn't a "duplicate"). */
  exceptId?: string;
  footer?: string;
  onSubmit: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const { validateName } = useCategories();
  const [name, setName] = useState(initialName);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const unchanged = name.trim() === initialName.trim();
  const validation = validateName(name, exceptId);
  const shownError = serverError ?? (touched && !unchanged ? validation : null);

  const submit = async () => {
    setTouched(true);
    if (validation || unchanged || saving) return;
    setSaving(true);
    setServerError(null);
    try {
      await onSubmit(name.trim());
      onClose();
    } catch (e) {
      setServerError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      title={title}
      left={{ label: "Cancel", onPress: onClose }}
      right={{ label: actionLabel, onPress: submit, disabled: !!validation || unchanged || saving }}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Section
          footer={
            shownError ? <span className="text-ios-red">{shownError}</span> : footer
          }
        >
          <Row>
            <input
              autoFocus
              className="min-w-0 flex-1 bg-transparent outline-none"
              placeholder="Category name"
              maxLength={MAX_CATEGORY_NAME}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setTouched(true);
                setServerError(null);
              }}
            />
          </Row>
        </Section>
      </form>
    </Sheet>
  );
}
