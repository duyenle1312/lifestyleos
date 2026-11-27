"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

// Same key the offline layer writes on sign-in (src/lib/offline/session.ts). Read
// directly so this island doesn't pull in Dexie or the Supabase client.
const LAST_USER_KEY = "lifestyleos:lastUser";

function hasLastUser(): boolean {
  try {
    return window.localStorage.getItem(LAST_USER_KEY) !== null;
  } catch {
    return false;
  }
}

const subscribe = () => () => {};

const pill =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2";
const dark = "bg-[#14161c] text-[#fbf8f2] focus-visible:outline-[#14161c]";
const light = "bg-[#fbf8f2] text-[#14161c] focus-visible:outline-[#fbf8f2]";
const big = "px-[22px] py-[13px] text-[15px]";

// The page is static, so the server (and the first client render) always shows the
// signed-out CTA; after hydration a returning user sees "Open app →" instead.
export function SessionCta({ variant }: { variant: "nav" | "hero" | "final" }) {
  const signedIn = useSyncExternalStore(subscribe, hasLastUser, () => false);

  if (variant === "nav") {
    if (signedIn) {
      return (
        <Link href="/expenses" className={`${pill} ${dark} px-4 py-[9px] text-sm`}>
          Open app →
        </Link>
      );
    }
    return (
      <div className="flex items-center gap-3.5">
        <Link href="/expenses" className="text-sm text-[#14161c]/75 hover:text-[#14161c]">
          Log in
        </Link>
        <Link href="/expenses" className={`${pill} ${dark} px-4 py-[9px] text-sm`}>
          Get started →
        </Link>
      </div>
    );
  }

  const label = signedIn ? "Open app →" : "Get started free →";
  return (
    <Link href="/expenses" className={`${pill} ${variant === "final" ? light : dark} ${big}`}>
      {label}
    </Link>
  );
}
