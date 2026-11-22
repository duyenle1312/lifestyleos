"use client";

// Small status pill: offline / syncing / failed changes, plus one-off notices. Hidden when there is nothing to say.
import { useState } from "react";
import { CloudOff, RefreshCw, TriangleAlert, X } from "lucide-react";
import { badgeLabel, describeEntry } from "@/lib/offline/syncLabels";
import { useAwaitingFirstPull } from "@/lib/offline/useAwaitingFirstPull";
import { useSync, useSyncStatus } from "./OfflineProvider";
import { Alert, ButtonRow, Row, Section, Sheet } from "./ui";

export function SyncBadge({ className = "" }: { className?: string }) {
  const { online, syncing, pending, failed, notices } = useSyncStatus();
  const { retry, discard, dismissNotice } = useSync();
  // The reference tables are pulled last, so their marker means the very first full pull has finished.
  const awaitingFirstPull = useAwaitingFirstPull("refs");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close the sheet once nothing is left to resolve.
  if (open && failed.length === 0) setOpen(false);

  const { state, label } = badgeLabel({ online, syncing, pending, failed: failed.length, awaitingFirstPull });
  const Icon = state === "failed" ? TriangleAlert : state === "offline" ? CloudOff : RefreshCw;
  const tone = state === "failed" ? "text-ios-red" : "text-label-2";

  if (!label && notices.length === 0) return null;

  const attempt = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  const pill = `flex items-center gap-2 rounded-lg bg-fill px-3 py-2 text-left text-[13px] font-medium ${tone}`;
  const content = (
    <>
      <Icon size={14} className={state === "syncing" ? "animate-spin" : ""} />
      {label}
    </>
  );

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {notices.map((n, i) => (
        <div key={n} className="flex items-start gap-2 rounded-lg bg-fill px-3 py-2 text-[13px] text-label">
          <span className="min-w-0 flex-1">{n}</span>
          <button type="button" aria-label="Dismiss" onClick={() => dismissNotice(i)} className="mt-0.5 text-label-2">
            <X size={14} />
          </button>
        </div>
      ))}
      {label &&
        (failed.length > 0 ? (
          <button type="button" onClick={() => setOpen(true)} className={pill}>
            {content}
          </button>
        ) : (
          <div className={pill}>{content}</div>
        ))}
      {open && failed.length > 0 && (
        <Sheet title="Changes that couldn't sync" right={{ label: "Done", onPress: () => setOpen(false), bold: true }} onClose={() => setOpen(false)}>
          {failed.map((e) => (
            <Section key={e.seq} footer={e.error ?? undefined}>
              <Row>{describeEntry(e)}</Row>
              <ButtonRow onPress={() => void attempt(() => retry(e.seq!))}>Retry</ButtonRow>
              <ButtonRow destructive onPress={() => void attempt(() => discard(e.seq!))}>
                Discard
              </ButtonRow>
            </Section>
          ))}
        </Sheet>
      )}
      {error && <Alert title="Error" message={error} buttons={[{ label: "OK" }]} onDismiss={() => setError(null)} />}
    </div>
  );
}
