"use client";

// Manage expense categories: add new ones, tap a row to rename it.
import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, Pencil, Plus, Tag } from "lucide-react";
import { useCategories } from "@/components/CategoriesProvider";
import { CategoryNameSheet } from "@/components/categories/CategoryNameSheet";
import { IconBubble } from "@/components/glyphs";
import { EmptyState, IconButton, Section, Spinner, Toolbar } from "@/components/ui";
import { categoryColor, categoryIcon, iosColor } from "@/lib/constants";
import type { Category } from "@/lib/types";

export default function CategoriesPage() {
  const { categories, isLoading, loadError, addCategory, renameCategory } = useCategories();
  const [showAdd, setShowAdd] = useState(false);
  const [renaming, setRenaming] = useState<Category | null>(null);

  return (
    <>
      <Toolbar
        title="Categories"
        left={
          <Link href="/settings" className="-ml-2 flex items-center text-[17px] text-ios-blue">
            <ChevronLeft size={28} strokeWidth={2.2} />
            Settings
          </Link>
        }
        right={<IconButton icon={Plus} label="New category" onClick={() => setShowAdd(true)} />}
      />

      {isLoading ? (
        <div className="flex min-h-[60dvh] items-center justify-center">
          <Spinner />
        </div>
      ) : loadError ? (
        <EmptyState icon={Tag} title="Couldn't load categories" subtitle={loadError} />
      ) : categories.length === 0 ? (
        <EmptyState icon={Tag} title="No categories yet" subtitle="Tap + to create your first category" />
      ) : (
        <Section
          className="pt-2"
          inset={72}
          footer="Renaming a category also updates the expenses that use it."
        >
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setRenaming(c)}
              className="flex w-full items-center gap-3 px-4 py-[10px] text-left active:bg-gray5"
            >
              <IconBubble icon={categoryIcon(c.name)} color={iosColor(categoryColor(c.name))} />
              <span className="min-w-0 flex-1 truncate text-[17px]">{c.name}</span>
              <Pencil size={16} className="shrink-0 text-label-3" />
            </button>
          ))}
        </Section>
      )}

      {showAdd && (
        <CategoryNameSheet
          title="New Category"
          actionLabel="Add"
          onSubmit={async (name) => {
            await addCategory(name);
          }}
          onClose={() => setShowAdd(false)}
        />
      )}
      {renaming && (
        <CategoryNameSheet
          title="Rename Category"
          actionLabel="Save"
          initialName={renaming.name}
          exceptId={renaming.id}
          footer="Expenses in this category will be moved to the new name."
          onSubmit={async (name) => {
            await renameCategory(renaming.id, name);
          }}
          onClose={() => setRenaming(null)}
        />
      )}
    </>
  );
}
