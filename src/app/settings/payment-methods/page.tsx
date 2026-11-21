"use client";

// Manage payment methods: add, rename, swipe or tap → delete.
import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight, CirclePlus, CreditCard, Plus } from "lucide-react";
import { IconBubble } from "@/components/glyphs";
import { usePaymentMethods } from "@/components/PaymentMethodsProvider";
import { DeletePaymentMethodSheet } from "@/components/payment-methods/DeletePaymentMethodSheet";
import { PaymentMethodEditorSheet } from "@/components/payment-methods/PaymentMethodEditorSheet";
import { ButtonRow, EmptyState, IconButton, Section, Spinner, SwipeRow, Toolbar } from "@/components/ui";
import { iosColor } from "@/lib/constants";
import type { PaymentMethod } from "@/lib/types";

export default function PaymentMethodsPage() {
  const { methods, isLoading, loadError } = usePaymentMethods();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [deleting, setDeleting] = useState<PaymentMethod | null>(null);

  return (
    <>
      <Toolbar
        title="Payment Methods"
        left={
          <Link href="/settings" className="-ml-2 flex items-center text-[17px] text-ios-blue">
            <ChevronLeft size={28} strokeWidth={2.2} />
            Settings
          </Link>
        }
        right={<IconButton icon={Plus} label="New payment method" onClick={() => setShowAdd(true)} />}
      />

      {isLoading ? (
        <div className="flex min-h-[60dvh] items-center justify-center">
          <Spinner />
        </div>
      ) : loadError ? (
        <EmptyState icon={CreditCard} title="Couldn't load payment methods" subtitle={loadError} />
      ) : methods.length === 0 ? (
        <EmptyState icon={CreditCard} title="No payment methods yet" subtitle="Add the cards and accounts you pay with">
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-full bg-ios-blue px-5 py-2.5 text-[17px] font-semibold text-white"
          >
            <CirclePlus size={20} /> Add Payment Method
          </button>
        </EmptyState>
      ) : (
        <div className="pb-8">
          <Section className="pt-2" inset={72} footer="Tap a payment method to rename it. Swipe left to delete.">
            {methods.map((m) => (
              <SwipeRow key={m.id} onDelete={() => setDeleting(m)} onPress={() => setEditing(m)}>
                <div className="flex items-center gap-3 px-4 py-[10px]">
                  <IconBubble icon={CreditCard} color={iosColor("green")} />
                  <span className="min-w-0 flex-1 truncate text-[17px]">{m.name}</span>
                  <ChevronRight size={18} className="shrink-0 text-label-3" />
                </div>
              </SwipeRow>
            ))}
          </Section>
          <Section>
            <ButtonRow onPress={() => setShowAdd(true)}>
              <CirclePlus size={20} /> Add Payment Method
            </ButtonRow>
          </Section>
        </div>
      )}

      {showAdd && <PaymentMethodEditorSheet onClose={() => setShowAdd(false)} />}
      {editing && <PaymentMethodEditorSheet key={editing.id} method={editing} onClose={() => setEditing(null)} />}
      {deleting && <DeletePaymentMethodSheet method={deleting} onClose={() => setDeleting(null)} />}
    </>
  );
}
