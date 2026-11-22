"use client";

import { useSyncExternalStore } from "react";
import { useAuth } from "@/components/AuthProvider";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** navigator.onLine with live updates; assumes online on the server. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}

/**
 * True when online-only actions (Supabase writes that bypass the offline outbox) can run: there is a connection
 * and a live session. An offline session (expired login shown from the remembered user) has no token to send.
 */
export function useCanEditOnline(): boolean {
  const online = useOnline();
  const { isOfflineSession } = useAuth();
  return online && !isOfflineSession;
}
