// Expense, shopping list and inventory data access.
// `accountId` is the signed-in user's id, and `created_by_user_id` is set to it too.
import { supabase } from "./supabase";
import type { Category, Expense, InventoryItem, PaymentMethod, ReceiptItem, ScannedReceipt, ShoppingItem } from "./types";
import { receiptItemDisplayName } from "./types";
import { noonISO } from "./helpers";

const softDelete = () => ({ deleted_at: new Date().toISOString() });

// MARK: - Expenses

export interface ExpenseInput {
  amount: number;
  currency: string;
  expense_date: string;
  category_id: string | null;
  description: string | null;
  location: string | null;
  unit: number | null;
  unit_price: number | null;
  expire_date: string | null;
  payment_method_id: string | null;
  item: string | null;
}

/** endDate is exclusive, so a month is [start of month, start of next month). */
export async function fetchExpensesByDateRange(accountId: string, start: Date, end: Date) {
  const { data, error } = await supabase
    .from("expenses")
    .select()
    .eq("account_id", accountId)
    .gte("expense_date", start.toISOString())
    .lt("expense_date", end.toISOString())
    .is("deleted_at", null)
    .order("expense_date", { ascending: false });
  if (error) throw error;
  return data as Expense[];
}

export async function createExpense(accountId: string, input: ExpenseInput) {
  const { data, error } = await supabase
    .from("expenses")
    .insert({ account_id: accountId, created_by_user_id: accountId, metadata: {}, ...input })
    .select()
    .single();
  if (error) throw error;
  return data as Expense;
}

export async function updateExpense(id: string, input: Partial<ExpenseInput>) {
  const { data, error } = await supabase.from("expenses").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data as Expense;
}

export async function deleteExpense(id: string) {
  const { error } = await supabase.from("expenses").update(softDelete()).eq("id", id);
  if (error) throw error;
}

/**
 * One expense per line item; failures are skipped.
 * Uses the receipt's date, and stores
 * unit_price = line price ÷ quantity so that unit × unit_price = amount, like the expense form.
 */
export async function createExpensesFromReceipt(
  accountId: string,
  receipt: ScannedReceipt,
  items: ReceiptItem[],
  resolve: {
    categoryId: (name: string | null) => string | null;
    paymentMethodId: (name: string | null) => string | null;
  },
) {
  const expenseDate = receipt.date && /^\d{4}-\d{2}-\d{2}$/.test(receipt.date) ? noonISO(receipt.date) : new Date().toISOString();
  const created: Expense[] = [];
  for (const item of items) {
    const quantity = item.quantity && item.quantity > 0 ? item.quantity : 1;
    try {
      created.push(
        await createExpense(accountId, {
          amount: item.amount,
          currency: "EUR",
          expense_date: expenseDate,
          category_id: resolve.categoryId(item.category),
          description: null,
          location: receipt.storeName,
          unit: quantity,
          unit_price: Math.round((item.amount / quantity) * 10_000) / 10_000,
          expire_date: null,
          payment_method_id: resolve.paymentMethodId(receipt.paymentMethod ?? null),
          item: receiptItemDisplayName(item),
        }),
      );
    } catch (e) {
      console.error(`Failed to create expense for ${item.name}`, e);
    }
  }
  return created;
}

// MARK: - Shopping list

export interface ShoppingInput {
  item: string;
  description: string | null;
  location: string | null;
  available_date_start: string | null;
  available_date_end: string | null;
  unit_price: number | null;
  quantity: number | null;
  purchased: boolean;
  scheduled_date: string | null;
  priority: number | null;
}

export async function fetchShoppingItems(accountId: string) {
  const { data, error } = await supabase
    .from("shopping_lists")
    .select()
    .eq("account_id", accountId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as ShoppingItem[];
}

export async function createShoppingItem(accountId: string, input: ShoppingInput) {
  const { data, error } = await supabase
    .from("shopping_lists")
    .insert({ account_id: accountId, created_by_user_id: accountId, metadata: {}, ...input })
    .select()
    .single();
  if (error) throw error;
  return data as ShoppingItem;
}

export async function updateShoppingItem(id: string, input: Partial<ShoppingInput>) {
  const { data, error } = await supabase.from("shopping_lists").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data as ShoppingItem;
}

export async function deleteShoppingItem(id: string) {
  const { error } = await supabase.from("shopping_lists").update(softDelete()).eq("id", id);
  if (error) throw error;
}

// MARK: - Categories (supabase/migrations/*_categories.sql)

export async function fetchCategories(accountId: string) {
  const { data, error } = await supabase
    .from("categories")
    .select()
    .eq("account_id", accountId)
    .order("sort_order")
    .order("created_at");
  if (error) throw error;
  return data as Category[];
}

export interface CategoryStyle {
  icon: string;
  color: string;
}

export async function createCategory(accountId: string, name: string, sortOrder: number, style: CategoryStyle) {
  const { data, error } = await supabase
    .from("categories")
    .insert({ account_id: accountId, name, sort_order: sortOrder, ...style })
    .select()
    .single();
  if (error) throw error;
  return data as Category;
}

/** Renames the category. Expenses reference it by id, so nothing else changes. */
export async function renameCategory(id: string, name: string) {
  const { data, error } = await supabase
    .from("categories")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Category;
}

export async function updateCategoryStyle(id: string, style: CategoryStyle) {
  const { data, error } = await supabase
    .from("categories")
    .update({ ...style, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Category;
}

/**
 * Deletes a category. With `moveTo`, its expenses are moved there first and the count is returned;
 * otherwise the foreign key (on delete set null) leaves them uncategorized and 0 is returned.
 */
export async function deleteCategory(id: string, moveTo: string | null) {
  let moved = 0;
  if (moveTo) {
    const { data, error } = await supabase
      .from("expenses")
      .update({ category_id: moveTo })
      .eq("category_id", id)
      .select("id");
    if (error) throw error;
    moved = data.length;
  }
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;
  return moved;
}

export async function countCategoryExpenses(id: string) {
  const { count, error } = await supabase
    .from("expenses")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id)
    .is("deleted_at", null);
  if (error) throw error;
  return count ?? 0;
}

// MARK: - Payment methods (supabase/migrations/*_payment_methods.sql)

export async function fetchPaymentMethods(accountId: string) {
  const { data, error } = await supabase
    .from("payment_methods")
    .select()
    .eq("account_id", accountId)
    .order("sort_order")
    .order("created_at");
  if (error) throw error;
  return data as PaymentMethod[];
}

export async function createPaymentMethod(accountId: string, name: string, sortOrder: number) {
  const { data, error } = await supabase
    .from("payment_methods")
    .insert({ account_id: accountId, name, sort_order: sortOrder })
    .select()
    .single();
  if (error) throw error;
  return data as PaymentMethod;
}

/** Renames the method. Expenses reference it by id, so nothing else changes. */
export async function renamePaymentMethod(id: string, name: string) {
  const { data, error } = await supabase
    .from("payment_methods")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as PaymentMethod;
}

/**
 * Deletes a method. With `moveTo`, its expenses are moved there first and the count is returned;
 * otherwise the foreign key (on delete set null) leaves them without a method and 0 is returned.
 */
export async function deletePaymentMethod(id: string, moveTo: string | null) {
  let moved = 0;
  if (moveTo) {
    const { data, error } = await supabase
      .from("expenses")
      .update({ payment_method_id: moveTo })
      .eq("payment_method_id", id)
      .select("id");
    if (error) throw error;
    moved = data.length;
  }
  const { error } = await supabase.from("payment_methods").delete().eq("id", id);
  if (error) throw error;
  return moved;
}

export async function countPaymentMethodExpenses(id: string) {
  const { count, error } = await supabase
    .from("expenses")
    .select("id", { count: "exact", head: true })
    .eq("payment_method_id", id)
    .is("deleted_at", null);
  if (error) throw error;
  return count ?? 0;
}

// MARK: - Inventory

export interface InventoryInput {
  name: string;
  quantity: number;
  expiration_date: string | null;
  unit: string | null;
  description: string | null;
}

export async function fetchInventoryItems(accountId: string) {
  const { data, error } = await supabase
    .from("inventory_items")
    .select()
    .eq("account_id", accountId)
    .is("deleted_at", null)
    .order("name");
  if (error) throw error;
  return data as InventoryItem[];
}

export async function fetchInventoryItem(id: string) {
  const { data, error } = await supabase.from("inventory_items").select().eq("id", id).single();
  if (error) throw error;
  return data as InventoryItem;
}

export async function createInventoryItem(accountId: string, input: InventoryInput) {
  const { data, error } = await supabase
    .from("inventory_items")
    .insert({ account_id: accountId, created_by_user_id: accountId, metadata: {}, ...input })
    .select()
    .single();
  if (error) throw error;
  return data as InventoryItem;
}

export async function updateInventoryItem(id: string, input: Partial<InventoryInput>) {
  const { data, error } = await supabase.from("inventory_items").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data as InventoryItem;
}

export async function deleteInventoryItem(id: string) {
  const { error } = await supabase.from("inventory_items").update(softDelete()).eq("id", id);
  if (error) throw error;
}
