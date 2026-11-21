"use client";

// Port of Views/ReceiptScanner/ReceiptScannerView.swift + ReceiptScannerViewModel.swift
// Additions over iOS: editable store name + receipt date, editable quantity, user's own categories.
import { useRef, useState } from "react";
import { Camera, CircleCheck, CirclePlus, Image as ImageIcon, Pencil, ScanText, Trash2 } from "lucide-react";
import { useAuth, useUser } from "@/components/AuthProvider";
import { useCategories } from "@/components/CategoriesProvider";
import { Alert, LargeTitle, LoadingOverlay, Spinner, Toolbar, useAutoFocus } from "@/components/ui";
import { PAYMENT_METHODS } from "@/lib/constants";
import { errorMessage, formatQuantity, parseDecimal, todayInput } from "@/lib/helpers";
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
const isDateInput = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Map Gemini's category onto one of the user's categories (case-insensitive), else "Other"/first. */
function matchCategory(raw: string | null, names: string[]): string | null {
  if (!names.length) return raw;
  const found = names.find((n) => n.toLowerCase() === raw?.trim().toLowerCase());
  return found ?? names.find((n) => n.toLowerCase() === "other") ?? names[0];
}

export default function ScanPage() {
  const user = useUser();
  const { session } = useAuth();
  const { names: categoryNames } = useCategories();
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
        body: JSON.stringify({ ...payload, categories: categoryNames }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to scan receipt");
      const scanned = json as ScannedReceipt;
      setReceipt({
        ...scanned,
        paymentMethod: "Food Voucher", // previous hard-coded default, now editable
        date: isDateInput(scanned.date) ? scanned.date : todayInput(),
        items: scanned.items.map((i) => ({ ...i, category: matchCategory(i.category, categoryNames) })),
      });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setIsScanning(false);
    }
  };

  // Like the view model, every item edit recalculates the total from the items.
  const updateItems = (fn: (items: ReceiptItem[]) => ReceiptItem[]) =>
    setReceipt((r) => {
      if (!r) return r;
      const items = fn(r.items);
      return { ...r, items, total: sumItems(items) };
    });

  const save = async () => {
    if (!receipt) return;
    setIsSaving(true);
    setError(null);
    try {
      const created = await createExpensesFromReceipt(user.id, receipt, receipt.items);
      if (created.length < receipt.items.length) {
        throw new Error(`Only ${created.length} of ${receipt.items.length} items were added.`);
      }
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
          categories={categoryNames}
          isSaving={isSaving}
          onChangeStore={(storeName) => setReceipt((r) => (r ? { ...r, storeName } : r))}
          onChangeDate={(date) => setReceipt((r) => (r ? { ...r, date } : r))}
          onChangePayment={(paymentMethod) => setReceipt((r) => (r ? { ...r, paymentMethod } : r))}
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
  categories,
  isSaving,
  onChangeStore,
  onChangeDate,
  onChangePayment,
  onUpdateItem,
  onRemoveItem,
  onSave,
  onReset,
}: {
  receipt: ScannedReceipt;
  categories: string[];
  isSaving: boolean;
  onChangeStore: (name: string | null) => void;
  onChangeDate: (date: string) => void;
  onChangePayment: (method: string | null) => void;
  onUpdateItem: (id: string, patch: Partial<ReceiptItem>) => void;
  onRemoveItem: (id: string) => void;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-2 bg-gray6 px-4 py-3 dark:bg-cell">
        <div className="flex items-center gap-3">
          <label className="flex min-w-0 flex-1 items-center gap-1.5 border-b border-transparent focus-within:border-ios-blue">
            <input
              aria-label="Store name"
              className="min-w-0 flex-1 bg-transparent text-[20px] font-bold outline-none placeholder:font-normal"
              placeholder="Store name"
              value={receipt.storeName ?? ""}
              onChange={(e) => onChangeStore(e.target.value || null)}
            />
            <Pencil size={14} className="shrink-0 text-label-3" />
          </label>
          <span className="shrink-0 text-[20px] font-bold text-ios-blue">
            {formatCurrency(receipt.total, receipt.currency)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            aria-label="Receipt date"
            className="rounded-md bg-fill px-2 py-1 text-[15px] text-label outline-none"
            value={receipt.date ?? todayInput()}
            max={todayInput()}
            onChange={(e) => e.target.value && onChangeDate(e.target.value)}
          />
          <select
            aria-label="Payment method"
            className="min-w-0 rounded-md bg-fill px-2 py-1 text-[15px] text-label outline-none"
            value={receipt.paymentMethod ?? ""}
            onChange={(e) => onChangePayment(e.target.value || null)}
          >
            <option value="">No method</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
          <span className="ml-auto shrink-0 text-xs text-label-2">{receipt.items.length} items</span>
        </div>
      </div>

      <ul className="bg-primary-bg">
        {receipt.items.map((item) => (
          <ReceiptItemRow
            key={item.id}
            item={item}
            categories={categories}
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
  categories,
  onUpdate,
  onDelete,
}: {
  item: ReceiptItem;
  categories: string[];
  onUpdate: (patch: Partial<ReceiptItem>) => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const nameRef = useAutoFocus<HTMLInputElement>(isEditing);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");

  const startEditing = () => {
    setName(receiptItemDisplayName(item));
    setQuantity(String(item.quantity ?? 1));
    setAmount(String(item.amount));
    setCategory(item.category ?? categories[0] ?? "");
    setIsEditing(true);
  };

  const parsedQty = parseDecimal(quantity);
  const parsedAmount = parseDecimal(amount);
  const valid = name.trim() !== "" && parsedQty != null && parsedQty > 0 && parsedAmount != null && parsedAmount >= 0;

  const save = () => {
    if (!valid) return;
    onUpdate({ translatedName: name.trim(), quantity: parsedQty, amount: parsedAmount, category: category || null });
    setIsEditing(false);
  };

  // Keep a category Gemini returned selectable even if the user doesn't have it.
  const categoryOptions = category && !categories.includes(category) ? [...categories, category] : categories;
  const fieldClass = "w-full rounded-md border border-separator bg-primary-bg px-2 py-1.5 text-[16px] outline-none focus:border-ios-blue";
  const labelClass = "flex flex-col gap-1 text-xs text-label-2";

  if (isEditing) {
    return (
      <li className="flex flex-col gap-3 border-b border-separator bg-gray6/60 px-4 py-4 dark:bg-cell/60">
        <label className={labelClass}>
          Item
          <input ref={nameRef} className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            Quantity
            <input
              className={fieldClass}
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
          <label className={labelClass}>
            Price
            <input className={fieldClass} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
        </div>
        <label className={labelClass}>
          Category
          <select className={fieldClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            {categoryOptions.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="rounded-full bg-ios-blue/15 px-4 py-1.5 text-[15px] font-medium text-ios-blue"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!valid}
            className="rounded-full bg-ios-blue px-4 py-1.5 text-[15px] font-medium text-white disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-3 border-b border-separator px-4 py-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-semibold">{receiptItemDisplayName(item)}</p>
          {item.name !== receiptItemDisplayName(item) && <p className="text-xs text-label-2">{item.name}</p>}
          <p className="mt-0.5 text-[13px] text-label-2">Qty: {formatQuantity(item.quantity ?? 1)}</p>
        </div>
        <span className="text-[17px] font-semibold text-ios-blue">{item.amount.toFixed(2)}</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="mr-auto truncate rounded-full bg-ios-blue/10 px-2.5 py-1 text-xs text-ios-blue">
          {item.category ?? "Uncategorized"}
        </span>
        <button type="button" onClick={startEditing} className="flex items-center gap-1 text-[15px] text-ios-blue">
          <Pencil size={15} /> Edit
        </button>
        <button type="button" onClick={onDelete} className="flex items-center gap-1 text-[15px] text-ios-red">
          <Trash2 size={15} /> Delete
        </button>
      </div>
    </li>
  );
}
