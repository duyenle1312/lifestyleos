"use client";

// Manage expense categories: add, edit (name / icon / color), swipe or tap → delete.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ChevronLeft, ChevronRight, CirclePlus, Plus, Tag } from "lucide-react";
import { useOnline } from "@/lib/useOnline";
import { useCategories } from "@/components/CategoriesProvider";
import { CategoryEditorSheet } from "@/components/categories/CategoryEditorSheet";
import { DeleteCategorySheet } from "@/components/categories/DeleteCategorySheet";
import { IconBubble } from "@/components/glyphs";
import { ButtonRow, EmptyState, IconButton, Section, Spinner, SwipeRow, Toolbar } from "@/components/ui";
import { categoryVisual } from "@/lib/categoryStyle";
import type { Category } from "@/lib/types";

export default function CategoriesPage() {
  return (
    <Suspense>
      <CategoriesScreen />
    </Suspense>
  );
}

function CategoriesScreen() {
  const { categories, isLoading, loadError } = useCategories();
  const online = useOnline();
  // ?from=expenses → back button returns to Expenses (opened from the filter menu).
  const fromExpenses = useSearchParams().get("from") === "expenses";
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);

  return (
    <>
      <Toolbar
        title="Categories"
        left={
          <Link
            href={fromExpenses ? "/expenses" : "/settings"}
            className="-ml-2 flex items-center text-[17px] text-ios-blue"
          >
            <ChevronLeft size={28} strokeWidth={2.2} />
            {fromExpenses ? "Expenses" : "Settings"}
          </Link>
        }
        right={<IconButton icon={Plus} label="New category" disabled={!online} onClick={() => setShowAdd(true)} />}
      />

      {isLoading ? (
        <div className="flex min-h-[60dvh] items-center justify-center">
          <Spinner />
        </div>
      ) : loadError ? (
        <EmptyState icon={Tag} title="Couldn't load categories" subtitle={loadError} />
      ) : categories.length === 0 ? (
        <EmptyState icon={Tag} title="No categories yet" subtitle={online ? "Create categories to organize your expenses" : "Needs a connection"}>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            disabled={!online}
            className="flex items-center gap-2 rounded-full bg-ios-blue px-5 py-2.5 text-[17px] font-semibold text-white disabled:opacity-40"
          >
            <CirclePlus size={20} /> Add Category
          </button>
        </EmptyState>
      ) : (
        <div className="pb-8">
          <Section
            className="pt-2"
            inset={72}
            footer={
              online ? "Tap a category to change its name, icon or color. Swipe left to delete." : "Needs a connection"
            }
          >
            {categories.map((c) => {
              const { Icon, color } = categoryVisual(c);
              return (
                <SwipeRow
                  key={c.id}
                  disabled={!online}
                  onDelete={() => setDeleting(c)}
                  onPress={online ? () => setEditing(c) : undefined}
                >
                  <div className="flex items-center gap-3 px-4 py-[10px]">
                    <IconBubble icon={Icon} color={color} />
                    <span className="min-w-0 flex-1 truncate text-[17px]">{c.name}</span>
                    <ChevronRight size={18} className="shrink-0 text-label-3" />
                  </div>
                </SwipeRow>
              );
            })}
          </Section>
          <Section>
            <ButtonRow disabled={!online} onPress={() => setShowAdd(true)}>
              <CirclePlus size={20} /> Add Category
            </ButtonRow>
          </Section>
        </div>
      )}

      {showAdd && <CategoryEditorSheet onClose={() => setShowAdd(false)} />}
      {editing && <CategoryEditorSheet key={editing.id} category={editing} onClose={() => setEditing(null)} />}
      {deleting && <DeleteCategorySheet category={deleting} onClose={() => setDeleting(null)} />}
    </>
  );
}
