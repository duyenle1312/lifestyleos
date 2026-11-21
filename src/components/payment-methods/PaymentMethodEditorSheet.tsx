"use client";

// Create or rename a payment method (renaming also updates the expenses that use it).
import { useState } from "react";
import { errorMessage } from "@/lib/helpers";
import type { PaymentMethod } from "@/lib/types";
import { MAX_PAYMENT_METHOD_NAME, usePaymentMethods } from "../PaymentMethodsProvider";
import { ButtonRow, Row, Section, Sheet, useAutoFocus } from "../ui";
import { DeletePaymentMethodSheet } from "./DeletePaymentMethodSheet";

export function PaymentMethodEditorSheet({
  method,
  onSaved,
  onClose,
}: {
  /** Present → edit mode (with Delete). */
  method?: PaymentMethod;
  onSaved?: (method: PaymentMethod) => void;
  onClose: () => void;
}) {
  const { validateName, addMethod, renameMethod } = usePaymentMethods();
  const isEdit = !!method;
  const [name, setName] = useState(method?.name ?? "");
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const nameRef = useAutoFocus<HTMLInputElement>(true);

  const validation = validateName(name, method?.id);
  const unchanged = isEdit && name.trim() === method.name;
  const shownError = serverError ?? (touched ? validation : null);
  const canSave = !validation && !unchanged && !saving;

  const save = async () => {
    setTouched(true);
    if (!canSave) return;
    setSaving(true);
    setServerError(null);
    try {
      const saved = method ? await renameMethod(method.id, name) : await addMethod(name);
      onSaved?.(saved);
      onClose();
    } catch (e) {
      setServerError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Sheet
        title={isEdit ? "Edit Payment Method" : "New Payment Method"}
        left={{ label: "Cancel", onPress: onClose }}
        right={{ label: isEdit ? "Save" : "Add", onPress: save, disabled: !canSave }}
        onClose={onClose}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Section
            className="pt-4"
            footer={
              shownError ? (
                <span className="text-ios-red">{shownError}</span>
              ) : isEdit ? (
                "Expenses using this method will show the new name."
              ) : undefined
            }
          >
            <Row>
              <input
                ref={nameRef}
                aria-label="Payment method name"
                className="min-w-0 flex-1 bg-transparent outline-none"
                placeholder="Name, e.g. Revolut"
                maxLength={MAX_PAYMENT_METHOD_NAME}
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

        {method && (
          <Section>
            <ButtonRow destructive center onPress={() => setShowDelete(true)}>
              Delete Payment Method
            </ButtonRow>
          </Section>
        )}
      </Sheet>

      {method && showDelete && (
        <DeletePaymentMethodSheet method={method} onDeleted={onClose} onClose={() => setShowDelete(false)} />
      )}
    </>
  );
}
