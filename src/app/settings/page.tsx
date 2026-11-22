"use client";

// Port of SettingsView (Lifestyle_OSApp.swift) + a Categories entry.
import { useState } from "react";
import Link from "next/link";
import { ChevronRight, CreditCard, KeyRound, Tag } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useCategories } from "@/components/CategoriesProvider";
import { usePaymentMethods } from "@/components/PaymentMethodsProvider";
import { SetPasswordSheet } from "@/components/SetPasswordSheet";
import { ButtonRow, LargeTitle, Row, Section, Toolbar } from "@/components/ui";

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { categories, isLoading } = useCategories();
  const payment = usePaymentMethods();
  const [showPassword, setShowPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  return (
    <>
      <Toolbar />
      <LargeTitle>Settings</LargeTitle>
      <Section
        header="Account"
        className="pt-2"
        footer={passwordSaved ? "Password saved." : "A password lets you sign in when a sign-in link can't be emailed."}
      >
        {user?.email && <Row>Email: {user.email}</Row>}
        <button
          type="button"
          onClick={() => setShowPassword(true)}
          className="flex min-h-11 w-full items-center gap-3 px-4 py-[11px] text-left text-[17px] active:bg-gray5"
        >
          <span className="flex size-[29px] items-center justify-center rounded-[7px] bg-ios-gray text-white">
            <KeyRound size={17} />
          </span>
          <span className="flex-1">Set Password</span>
          <ChevronRight size={18} className="text-label-3" />
        </button>
      </Section>
      <Section header="Expenses">
        <Link href="/settings/categories" className="flex min-h-11 items-center gap-3 px-4 py-[11px] text-[17px] active:bg-gray5">
          <span className="flex size-[29px] items-center justify-center rounded-[7px] bg-ios-orange text-white">
            <Tag size={17} />
          </span>
          <span className="flex-1">Categories</span>
          {!isLoading && <span className="text-label-2">{categories.length}</span>}
          <ChevronRight size={18} className="text-label-3" />
        </Link>
        <Link
          href="/settings/payment-methods"
          className="flex min-h-11 items-center gap-3 px-4 py-[11px] text-[17px] active:bg-gray5"
        >
          <span className="flex size-[29px] items-center justify-center rounded-[7px] bg-ios-green text-white">
            <CreditCard size={17} />
          </span>
          <span className="flex-1">Payment Methods</span>
          {!payment.isLoading && <span className="text-label-2">{payment.methods.length}</span>}
          <ChevronRight size={18} className="text-label-3" />
        </Link>
      </Section>
      <Section>
        <ButtonRow destructive onPress={signOut}>
          Sign Out
        </ButtonRow>
      </Section>
      {showPassword && user?.email && (
        <SetPasswordSheet
          email={user.email}
          onDone={() => {
            setPasswordSaved(true);
            setShowPassword(false);
          }}
          onClose={() => setShowPassword(false)}
        />
      )}
    </>
  );
}
