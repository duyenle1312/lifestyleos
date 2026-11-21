"use client";

// Delete a category, optionally moving its expenses to another category first.
import { useEffect, useState } from "react";
import { categoryVisual } from "@/lib/categoryStyle";
import { errorMessage } from "@/lib/helpers";
import { countCategoryExpenses } from "@/lib/services";
import type { Category } from "@/lib/types";
import { IconBubble } from "../glyphs";
import { useCategories } from "../CategoriesProvider";
import { ButtonRow, Row, Section, SelectRow, Sheet, Spinner } from "../ui";

export function DeleteCategorySheet({
  category,
  onDeleted,
  onClose,
}: {
  category: Category;
  onDeleted?: () => void;
  onClose: () => void;
}) {
  const { categories, deleteCategory } = useCategories();
  const [count, setCount] = useState<number | null>(null);
  const [moveTo, setMoveTo] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { Icon, color } = categoryVisual(category);

  useEffect(() => {
    countCategoryExpenses(category.id)
      .then(setCount)
      .catch((e) => setError(errorMessage(e)));
  }, [category.id]);

  const remove = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteCategory(category.id, moveTo || null);
      onClose();
      onDeleted?.();
    } catch (e) {
      setError(errorMessage(e));
      setDeleting(false);
    }
  };

  const options = [
    { value: "", label: "Uncategorized" },
    ...categories.filter((c) => c.id !== category.id).map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <Sheet title="Delete Category" left={{ label: "Cancel", onPress: onClose }} onClose={onClose}>
      <Section
        className="pt-4"
        footer={
          count == null ? undefined : count === 0 ? (
            "No expenses use this category."
          ) : (
            `${count} expense${count === 1 ? "" : "s"} use this category. Choose where they should go.`
          )
        }
      >
        <Row>
          <IconBubble icon={Icon} color={color} />
          <span className="flex-1 truncate font-semibold">{category.name}</span>
          {count == null && !error && <Spinner size={18} />}
        </Row>
        {count != null && count > 0 && (
          <SelectRow label="Move expenses to" value={moveTo} onChange={setMoveTo} options={options} />
        )}
      </Section>

      {error && <p className="px-8 pt-3 text-[13px] text-ios-red">{error}</p>}

      <Section>
        <ButtonRow destructive center onPress={() => !deleting && count != null && remove()}>
          {deleting ? <Spinner size={18} className="text-ios-red" /> : "Delete Category"}
        </ButtonRow>
      </Section>
    </Sheet>
  );
}
