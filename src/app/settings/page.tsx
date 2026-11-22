"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, CreditCard, KeyRound, Tag, UserRound } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useCategories } from "@/components/CategoriesProvider";
import { usePaymentMethods } from "@/components/PaymentMethodsProvider";
import { useSyncStatus } from "@/components/OfflineProvider";
import { NameSheet } from "@/components/NameSheet";
import { SetPasswordSheet } from "@/components/SetPasswordSheet";
import { Alert, ButtonRow, LargeTitle, Row, Section, Toolbar } from "@/components/ui";

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { categories, isLoading } = useCategories();
  const payment = usePaymentMethods();
  const [showPassword, setShowPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [showName, setShowName] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const sync = useSyncStatus();
  const unsynced = sync.pending + sync.failed.length;
  const fullName = typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "";
  return (
    <>
      <Toolbar />
      <LargeTitle>Settings</LargeTitle>
      <Section
        header="Account"
        className="pt-2"
        footer={passwordSaved ? "Password saved." : "A password lets you sign in when a sign-in link can't be emailed."}
      >
        <button
          type="button"
          onClick={() => setShowName(true)}
          className="flex min-h-11 w-full items-center gap-3 px-4 py-[11px] text-left text-[17px] active:bg-gray5"
        >
          <span className="flex size-[29px] items-center justify-center rounded-[7px] bg-ios-blue text-white">
            <UserRound size={17} />
          </span>
          <span className="shrink-0">Name</span>
          <span className={`ml-auto truncate ${fullName ? "text-label-2" : "text-label-3"}`}>{fullName || "Add"}</span>
          <ChevronRight size={18} className="shrink-0 text-label-3" />
        </button>
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
        <ButtonRow destructive onPress={() => (unsynced > 0 ? setConfirmSignOut(true) : void signOut())}>
          Sign Out
        </ButtonRow>
      </Section>
      {confirmSignOut && (
        <Alert
          title="Unsynced Changes"
          message={`${unsynced === 1 ? "1 change hasn't" : `${unsynced} changes haven't`} synced yet. They'll be sent next time you sign in.`}
          buttons={[{ label: "Cancel", role: "cancel" }, { label: "Sign Out", role: "destructive", onPress: () => void signOut() }]}
          onDismiss={() => setConfirmSignOut(false)}
        />
      )}
      {showName && <NameSheet initialName={fullName} onClose={() => setShowName(false)} />}
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
