"use client";

// Port of SettingsView (Lifestyle_OSApp.swift) + a Categories entry.
import Link from "next/link";
import { ChevronRight, CreditCard, Tag } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useCategories } from "@/components/CategoriesProvider";
import { usePaymentMethods } from "@/components/PaymentMethodsProvider";
import { ButtonRow, LargeTitle, Row, Section, Toolbar } from "@/components/ui";

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { categories, isLoading } = useCategories();
  const payment = usePaymentMethods();
  return (
    <>
      <Toolbar />
      <LargeTitle>Settings</LargeTitle>
      <Section header="Account" className="pt-2">
        {user?.email && <Row>Email: {user.email}</Row>}
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
    </>
  );
}
