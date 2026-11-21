// Row shapes mirror the Supabase tables used by the iOS app (Models/*.swift).
// Dates come back from PostgREST as ISO strings and are kept as strings here.

export type Json = Record<string, unknown>;

export interface Expense {
  id: string;
  account_id: string;
  created_by_user_id: string;
  amount: number;
  currency: string;
  expense_date: string;
  category: string | null;
  description: string | null;
  location: string | null;
  unit: number | null;
  unit_price: number | null;
  expire_date: string | null;
  payment_method: string | null;
  item: string | null;
  metadata: Json;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShoppingItem {
  id: string;
  account_id: string;
  created_by_user_id: string;
  item: string;
  description: string | null;
  metadata: Json;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  location: string | null;
  available_date_start: string | null;
  available_date_end: string | null;
  unit_price: number | null;
  quantity: number | null;
  purchased: boolean;
  scheduled_date: string | null;
  priority: number | null;
}

export interface InventoryItem {
  id: string;
  account_id: string;
  created_by_user_id: string;
  name: string;
  quantity: number;
  expiration_date: string | null;
  unit: string | null;
  description: string | null;
  metadata: Json;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  account_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ReceiptItem {
  id: string;
  name: string;
  translatedName: string | null;
  amount: number;
  quantity: number | null;
  category: string | null;
}

export interface ScannedReceipt {
  storeName: string | null;
  date: string | null;
  items: ReceiptItem[];
  total: number;
  currency: string;
}

export const receiptItemDisplayName = (item: ReceiptItem) => item.translatedName ?? item.name;
