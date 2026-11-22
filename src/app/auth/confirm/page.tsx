"use client";

// Landing page for sign-in / sign-up emails (see supabase/templates/).
//
// The email links here with a one-time token_hash instead of straight to Supabase's verify URL.
// Email security scanners (Outlook Safe Links, Microsoft Defender, Mimecast…) open every link
// before the user sees the email; a direct verify link would be used up by that visit, and the
// user would get "link expired". Here, nothing is spent until the user presses the button.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { AppLogo } from "@/components/AppLogo";
import { useAuth } from "@/components/AuthProvider";
import { Spinner } from "@/components/ui";
import { supabase } from "@/lib/supabase";

const primaryButton =
  "flex w-full items-center justify-center rounded-[10px] bg-ios-blue p-4 text-[17px] font-semibold text-white disabled:opacity-50";

type Params = { tokenHash: string; type: EmailOtpType } | null;

export default function ConfirmPage() {
  const router = useRouter();
  const { user, initializing } = useAuth();
  // undefined: not read yet (the URL is only available in the browser).
  const [params, setParams] = useState<Params | undefined>(undefined);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const tokenHash = q.get("token_hash");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the URL once on mount
    setParams(tokenHash ? { tokenHash, type: (q.get("type") as EmailOtpType) || "email" } : null);
  }, []);

  const confirm = async () => {
    if (!params) return;
    setVerifying(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ token_hash: params.tokenHash, type: params.type });
    if (error) {
      setVerifying(false);
      setError("This link has expired or was already used. Request a new one.");
      return;
    }
    // AuthProvider's SIGNED_IN listener creates the default account.
    router.replace("/expenses");
  };

  const loading = initializing || params === undefined;
  const title = user ? "You're signed in" : "Sign in to Lifestyle OS";

  return (
    <div className="flex min-h-dvh items-center justify-center bg-primary-bg p-4">
      <div className="flex w-full max-w-md flex-col items-center gap-5 p-4 text-center">
        <AppLogo className="size-14" />
        {loading ? (
          <Spinner />
        ) : (
          <>
            <h1 className="text-[28px] font-bold leading-tight">{title}</h1>
            {user ? (
              <button className={primaryButton} onClick={() => router.replace("/expenses")}>
                Open Lifestyle OS
              </button>
            ) : params ? (
              <>
                <p className="text-[17px] text-label-2">Press the button to finish signing in on this device.</p>
                {error && <p className="text-xs text-ios-red">{error}</p>}
                <button className={primaryButton} onClick={confirm} disabled={verifying}>
                  {verifying ? <Spinner className="text-white" /> : "Continue"}
                </button>
              </>
            ) : (
              <p className="text-[17px] text-label-2">This sign-in link is incomplete. Request a new one.</p>
            )}
            {!user && (error || !params) && (
              <button className="text-[17px] text-ios-blue" onClick={() => router.replace("/expenses")}>
                Back to sign in
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
