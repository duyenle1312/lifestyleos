"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, CreditCard, KeyRound, Mail, Tag, UserRound } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useCategories } from "@/components/CategoriesProvider";
import { usePaymentMethods } from "@/components/PaymentMethodsProvider";
import { useSyncStatus } from "@/components/OfflineProvider";
import { NameSheet } from "@/components/NameSheet";
import { SetPasswordSheet } from "@/components/SetPasswordSheet";
import { Alert, ButtonRow, LargeTitle, Row, Section, Toolbar } from "@/components/ui";
import { useCanEditOnline } from "@/lib/useOnline";
import { OfflineEditAlert } from "@/components/OfflineEditAlert";

// One tile color for every settings icon, so the list reads calmly.
const ICON_TILE = "flex size-[29px] shrink-0 items-center justify-center rounded-[7px] bg-ios-blue text-white";

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { categories, isLoading } = useCategories();
  const payment = usePaymentMethods();
  const [showPassword, setShowPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [showName, setShowName] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [showOffline, setShowOffline] = useState(false);
  const sync = useSyncStatus();
  // Name and password are saved straight to Supabase Auth, so they need a connection and a live session.
  const canEdit = useCanEditOnline();
  // The category and payment-method editors aren't cached for offline use: explain instead of navigating.
  const guardOffline = (e: React.MouseEvent) => {
    if (canEdit) return;
    e.preventDefault();
    setShowOffline(true);
  };
  const unsynced = sync.pending + sync.failed.length;
  const fullName = typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "";
  return (
    <>
      <Toolbar />
      <LargeTitle>Settings</LargeTitle>
      <Section
        header="Account"
        className="pt-2"
        footer={
          !canEdit
            ? "Needs a connection"
            : passwordSaved
              ? "Password saved."
              : "A password lets you sign in when a sign-in link can't be emailed."
        }
      >
        <button
          type="button"
          onClick={() => setShowName(true)}
          disabled={!canEdit}
          className="flex min-h-11 w-full items-center gap-3 px-4 py-[11px] text-left text-[17px] active:bg-gray5 disabled:opacity-40 disabled:active:bg-transparent"
        >
          <span className={ICON_TILE}>
            <UserRound size={17} />
          </span>
          <span className="shrink-0">Name</span>
          <span className={`ml-auto truncate ${fullName ? "text-label-2" : "text-label-3"}`}>{fullName || "Add"}</span>
          <ChevronRight size={18} className="shrink-0 text-label-3" />
        </button>
        {user?.email && (
          <Row>
            <span className={ICON_TILE}>
              <Mail size={17} />
            </span>
            <span className="shrink-0">Email</span>
            <span className="ml-auto truncate text-label-2">{user.email}</span>
          </Row>
        )}
        <button
          type="button"
          onClick={() => setShowPassword(true)}
          disabled={!canEdit}
          className="flex min-h-11 w-full items-center gap-3 px-4 py-[11px] text-left text-[17px] active:bg-gray5 disabled:opacity-40 disabled:active:bg-transparent"
        >
          <span className={ICON_TILE}>
            <KeyRound size={17} />
          </span>
          <span className="flex-1">Set Password</span>
          <ChevronRight size={18} className="text-label-3" />
        </button>
      </Section>
      <Section header="Expenses">
        <Link href="/settings/categories" onClick={guardOffline} className="flex min-h-11 items-center gap-3 px-4 py-[11px] text-[17px] active:bg-gray5">
          <span className={ICON_TILE}>
            <Tag size={17} />
          </span>
          <span className="flex-1">Categories</span>
          {!isLoading && <span className="text-label-2">{categories.length}</span>}
          <ChevronRight size={18} className="text-label-3" />
        </Link>
        <Link
          href="/settings/payment-methods"
          onClick={guardOffline}
          className="flex min-h-11 items-center gap-3 px-4 py-[11px] text-[17px] active:bg-gray5"
        >
          <span className={ICON_TILE}>
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
      {showOffline && <OfflineEditAlert onDismiss={() => setShowOffline(false)} />}
      {showName && canEdit && <NameSheet initialName={fullName} onClose={() => setShowName(false)} />}
      {showPassword && canEdit && user?.email && (
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
