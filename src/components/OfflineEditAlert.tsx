"use client";

import { Alert } from "./ui";

/**
 * Shown instead of opening a screen that only works online (inventory item detail, category and payment-method
 * editors). Those routes aren't in the offline shell cache, so navigating to them offline would land on the
 * service worker's /expenses fallback.
 */
export function OfflineEditAlert({ onDismiss }: { onDismiss: () => void }) {
  return (
    <Alert
      title="You're Offline"
      message="You can't edit this while offline — you can only view it. Expenses and the shopping list can still be edited offline."
      buttons={[{ label: "OK" }]}
      onDismiss={onDismiss}
    />
  );
}
