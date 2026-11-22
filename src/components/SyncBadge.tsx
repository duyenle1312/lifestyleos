"use client";

// Small status pill: offline / syncing / failed changes, plus one-off notices. Hidden when there is nothing to say.
import { useState } from "react";
import { CloudOff, RefreshCw, TriangleAlert, X } from "lucide-react";
import { type OutboxEntry } from "@/lib/offline/db";
import { useSync, useSyncStatus } from "./OfflineProvider";
import { Alert, ButtonRow, Row, Section, Sheet } from "./ui";

const plural = (n: number) => `${n} change${n === 1 ? "" : "s"}`;

const describe = (e: OutboxEntry) => {
  const what = e.table === "expenses" ? "Expense" : "Shopping item";
  const verb = e.op === "delete" ? "delete" : "save";
  return `${what} ${verb}`;
};

export function SyncBadge({ className = "" }: { className?: string }) {
  const { online, syncing, pending, failed, notices } = useSyncStatus();
  const { retry, discard, dismissNotice } = useSync();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  let label: string | null = null;
  let Icon = RefreshCw;
  let tone = "text-label-2";
  if (failed.length > 0) {
    label = `${plural(failed.length)} couldn't sync`;
    Icon = TriangleAlert;
    tone = "text-ios-red";
  } else if (!online) {
    label = `Offline · ${plural(pending)} waiting`;
    Icon = CloudOff;
  } else if (syncing) {
    label = "Syncing…";
  }

  if (!label && notices.length === 0) return null;

  const doDiscard = async (seq: number) => {
    try {
      await discard(seq);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't discard");
    }
  };

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
      {label && (
        <button
          type="button"
          disabled={failed.length === 0}
          onClick={() => setOpen(true)}
          className={`flex items-center gap-2 rounded-lg bg-fill px-3 py-2 text-left text-[13px] font-medium ${tone}`}
        >
          <Icon size={14} className={syncing && failed.length === 0 && online ? "animate-spin" : ""} />
          {label}
        </button>
      )}
      {open && failed.length > 0 && (
        <Sheet title="Changes that couldn't sync" right={{ label: "Done", onPress: () => setOpen(false), bold: true }} onClose={() => setOpen(false)}>
          {failed.map((e) => (
            <Section key={e.seq} footer={e.error ?? undefined}>
              <Row>{describe(e)}</Row>
              <ButtonRow onPress={() => void retry(e.seq!)}>Retry</ButtonRow>
              <ButtonRow destructive onPress={() => void doDiscard(e.seq!)}>
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
