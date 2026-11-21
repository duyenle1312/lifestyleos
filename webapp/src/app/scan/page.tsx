"use client";

// Port of Views/ReceiptScanner/ReceiptScannerView.swift + ReceiptScannerViewModel.swift
import { useRef, useState } from "react";
import { Camera, CircleCheck, CirclePlus, Image as ImageIcon, Pencil, ScanText, Trash2 } from "lucide-react";
import { useAuth, useUser } from "@/components/AuthProvider";
import { Alert, LargeTitle, LoadingOverlay, Spinner, Toolbar } from "@/components/ui";
import { RECEIPT_CATEGORIES } from "@/lib/constants";
import { errorMessage, parseDecimal } from "@/lib/helpers";
import { createExpensesFromReceipt } from "@/lib/services";
import { type ReceiptItem, receiptItemDisplayName, type ScannedReceipt } from "@/lib/types";

/** Downscale to ≤1600px JPEG so uploads stay small (phone photos are often 5–10 MB). */
async function prepareImage(file: File): Promise<{ image: string; mimeType: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { image: dataUrl.split(",")[1], mimeType: "image/jpeg" };
}

const sumItems = (items: ReceiptItem[]) => items.reduce((s, i) => s + i.amount, 0);

export default function ScanPage() {
  const user = useUser();
  const { session } = useAuth();
  const [receipt, setReceipt] = useState<ScannedReceipt | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);

  const scan = async (file: File | undefined) => {
    if (!file) return;
    setIsScanning(true);
    setError(null);
    try {
      const payload = await prepareImage(file);
      const res = await fetch("/api/scan-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to scan receipt");
      setReceipt(json as ScannedReceipt);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setIsScanning(false);
    }
  };

  // Like the view model, every edit recalculates the total from the items.
  const updateItems = (fn: (items: ReceiptItem[]) => ReceiptItem[]) =>
    setReceipt((r) => (r ? { ...r, items: fn(r.items), total: sumItems(fn(r.items)) } : r));

  const save = async () => {
    if (!receipt) return;
    setIsSaving(true);
    setError(null);
    try {
      await createExpensesFromReceipt(user.id, receipt, receipt.items);
      setShowSuccess(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setIsSaving(false);
    }
  };

  const reset = () => {
    setReceipt(null);
    setError(null);
    setShowSuccess(false);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    scan(e.target.files?.[0]);
    e.target.value = ""; // allow picking the same file again
  };

  return (
    <>
      <Toolbar />
      <LargeTitle>Scan Receipt</LargeTitle>

      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      <input ref={libraryInput} type="file" accept="image/*" hidden onChange={onFile} />

      {!receipt ? (
        <div className="flex flex-col gap-8 p-4">
          <div className="flex flex-col items-center gap-4 pt-10 text-center">
            <ScanText size={80} strokeWidth={1.3} className="animate-pulse text-ios-blue" />
            <h2 className="text-[28px] font-bold">Scan Receipt</h2>
            <p className="text-[15px] text-label-2">Take a photo or select an image of your receipt</p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => cameraInput.current?.click()}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-ios-blue/85 to-ios-blue p-4 text-[17px] font-semibold text-white"
            >
              <Camera size={20} /> Take Photo
            </button>
            <button
              type="button"
              onClick={() => libraryInput.current?.click()}
              className="flex items-center justify-center gap-2 rounded-xl bg-ios-blue/10 p-4 text-[17px] font-semibold text-ios-blue"
            >
              <ImageIcon size={20} /> Choose from Library
            </button>
          </div>

          <div className="flex flex-col gap-3 rounded-xl bg-gray6 p-4 dark:bg-cell">
            <p className="text-[17px] font-semibold">Tips for best results:</p>
            {["Ensure receipt is flat and well-lit", "Hold camera steady", "Works with Bulgarian store receipts"].map(
              (tip) => (
                <p key={tip} className="flex items-start gap-3 text-[15px] text-label-2">
                  <CircleCheck size={20} className="shrink-0 fill-ios-green text-cell" />
                  {tip}
                </p>
              ),
            )}
          </div>
        </div>
      ) : (
        <ReceiptReview
          receipt={receipt}
          isSaving={isSaving}
          onUpdateItem={(id, patch) => updateItems((items) => items.map((i) => (i.id === id ? { ...i, ...patch } : i)))}
          onRemoveItem={(id) => updateItems((items) => items.filter((i) => i.id !== id))}
          onSave={save}
          onReset={reset}
        />
      )}

      {isScanning && <LoadingOverlay message="Scanning receipt..." />}
      {error && <Alert title="Error" message={error} buttons={[{ label: "OK" }]} onDismiss={() => setError(null)} />}
      {showSuccess && (
        <Alert
          title="Success"
          message="Expenses have been added successfully!"
          buttons={[{ label: "OK" }]}
          onDismiss={reset}
        />
      )}
    </>
  );
}

const formatCurrency = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);

function ReceiptReview({
  receipt,
  isSaving,
  onUpdateItem,
  onRemoveItem,
  onSave,
  onReset,
}: {
  receipt: ScannedReceipt;
  isSaving: boolean;
  onUpdateItem: (id: string, patch: Partial<ReceiptItem>) => void;
  onRemoveItem: (id: string) => void;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex flex-col items-center gap-2 bg-gray6 p-4 dark:bg-cell">
        {receipt.storeName && <h2 className="text-[22px] font-bold">{receipt.storeName}</h2>}
        <p className="flex items-center gap-2">
          <span className="text-[17px] font-semibold text-label-2">Total:</span>
          <span className="text-[22px] font-bold text-ios-blue">{formatCurrency(receipt.total, receipt.currency)}</span>
        </p>
        <p className="text-xs text-label-2">{receipt.items.length} items</p>
      </div>

      <ul className="bg-primary-bg">
        {receipt.items.map((item) => (
          <ReceiptItemRow
            key={item.id}
            item={item}
            onUpdate={(patch) => onUpdateItem(item.id, patch)}
            onDelete={() => onRemoveItem(item.id)}
          />
        ))}
      </ul>

      <div className="sticky bottom-[var(--tabbar-h)] flex flex-col items-center gap-3 border-t border-separator bg-primary-bg p-4">
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving || receipt.items.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-ios-blue p-4 text-[17px] font-semibold text-white disabled:bg-ios-gray"
        >
          {isSaving ? (
            <Spinner className="text-white" />
          ) : (
            <>
              <CirclePlus size={20} /> Add to Expenses
            </>
          )}
        </button>
        <button type="button" onClick={onReset} className="text-[17px] text-ios-blue">
          Scan Another Receipt
        </button>
      </div>
    </div>
  );
}

function ReceiptItemRow({
  item,
  onUpdate,
  onDelete,
}: {
  item: ReceiptItem;
  onUpdate: (patch: Partial<ReceiptItem>) => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(receiptItemDisplayName(item));
  const [amount, setAmount] = useState(String(item.amount));
  const [category, setCategory] = useState(item.category ?? "Food & Drink");

  const startEditing = () => {
    setName(receiptItemDisplayName(item));
    setAmount(String(item.amount));
    setCategory(item.category ?? "Food & Drink");
    setIsEditing(true);
  };

  const save = () => {
    const parsed = parseDecimal(amount);
    onUpdate({ translatedName: name, category, ...(parsed != null ? { amount: parsed } : {}) });
    setIsEditing(false);
  };

  const inputClass = "rounded-md border border-separator bg-primary-bg px-2 py-1 text-[15px] outline-none";

  return (
    <li className="flex flex-col gap-3 border-b border-separator px-4 py-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <input className={`${inputClass} w-full`} value={name} onChange={(e) => setName(e.target.value)} />
          ) : (
            <>
              <p className="text-[17px] font-semibold">{receiptItemDisplayName(item)}</p>
              {item.name !== receiptItemDisplayName(item) && <p className="text-xs text-label-2">{item.name}</p>}
            </>
          )}
        </div>
        {isEditing ? (
          <input
            className={`${inputClass} w-[90px]`}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        ) : (
          <span className="text-[17px] font-semibold text-ios-blue">{item.amount.toFixed(2)}</span>
        )}
      </div>

      {isEditing ? (
        <div className="flex items-center gap-2">
          <select
            className="min-w-0 flex-1 bg-transparent text-[15px] text-ios-blue outline-none"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {RECEIPT_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={save}
            className="rounded-full bg-ios-blue px-3 py-1 text-[15px] font-medium text-white"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="rounded-full bg-ios-blue/15 px-3 py-1 text-[15px] font-medium text-ios-blue"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <span className="mr-auto rounded-full bg-ios-blue/10 px-2.5 py-1 text-xs text-ios-blue">
            {item.category ?? "Food & Drink"}
          </span>
          <button type="button" onClick={startEditing} className="flex items-center gap-1 text-[15px] text-ios-blue">
            <Pencil size={15} /> Edit
          </button>
          <button type="button" onClick={onDelete} className="flex items-center gap-1 text-[15px] text-ios-red">
            <Trash2 size={15} /> Delete
          </button>
        </div>
      )}
    </li>
  );
}
