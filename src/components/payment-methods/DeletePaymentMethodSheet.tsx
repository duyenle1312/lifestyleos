"use client";

// Delete a payment method, optionally moving its expenses to another method first.
import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { iosColor } from "@/lib/constants";
import { errorMessage } from "@/lib/helpers";
import { countPaymentMethodExpenses } from "@/lib/services";
import type { PaymentMethod } from "@/lib/types";
import { IconBubble } from "../glyphs";
import { usePaymentMethods } from "../PaymentMethodsProvider";
import { ButtonRow, Row, Section, SelectRow, Sheet, Spinner } from "../ui";

export function DeletePaymentMethodSheet({
  method,
  onDeleted,
  onClose,
}: {
  method: PaymentMethod;
  onDeleted?: () => void;
  onClose: () => void;
}) {
  const { methods, deleteMethod } = usePaymentMethods();
  const [count, setCount] = useState<number | null>(null);
  const [moveTo, setMoveTo] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    countPaymentMethodExpenses(method.id)
      .then(setCount)
      .catch((e) => setError(errorMessage(e)));
  }, [method.id]);

  const remove = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteMethod(method.id, moveTo || null);
      onClose();
      onDeleted?.();
    } catch (e) {
      setError(errorMessage(e));
      setDeleting(false);
    }
  };

  const options = [
    { value: "", label: "No payment method" },
    ...methods.filter((m) => m.id !== method.id).map((m) => ({ value: m.id, label: m.name })),
  ];

  return (
    <Sheet title="Delete Payment Method" left={{ label: "Cancel", onPress: onClose }} onClose={onClose}>
      <Section
        className="pt-4"
        footer={
          count == null ? undefined : count === 0 ? (
            "No expenses use this payment method."
          ) : (
            `${count} expense${count === 1 ? "" : "s"} use this payment method. Choose what they should use instead.`
          )
        }
      >
        <Row>
          <IconBubble icon={CreditCard} color={iosColor("green")} />
          <span className="flex-1 truncate font-semibold">{method.name}</span>
          {count == null && !error && <Spinner size={18} />}
        </Row>
        {count != null && count > 0 && (
          <SelectRow label="Move expenses to" value={moveTo} onChange={setMoveTo} options={options} />
        )}
      </Section>

      {error && <p className="px-8 pt-3 text-[13px] text-ios-red">{error}</p>}

      <Section>
        <ButtonRow destructive center onPress={() => !deleting && count != null && remove()}>
          {deleting ? <Spinner size={18} className="text-ios-red" /> : "Delete Payment Method"}
        </ButtonRow>
      </Section>
    </Sheet>
  );
}
