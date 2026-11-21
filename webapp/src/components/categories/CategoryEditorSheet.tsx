"use client";

// Create or edit a category: name, color and icon (laid out like iOS Reminders' "New List").
import { useState } from "react";
import { Check } from "lucide-react";
import { CATEGORY_COLORS, CATEGORY_ICONS, CategoryIcon, colorFor } from "@/lib/categoryStyle";
import { iosColor } from "@/lib/constants";
import { errorMessage } from "@/lib/helpers";
import type { Category } from "@/lib/types";
import { MAX_CATEGORY_NAME, useCategories } from "../CategoriesProvider";
import { ButtonRow, Section, Sheet, useAutoFocus } from "../ui";
import { DeleteCategorySheet } from "./DeleteCategorySheet";

export function CategoryEditorSheet({
  category,
  onSaved,
  onClose,
}: {
  /** Present → edit mode (with Delete). */
  category?: Category;
  onSaved?: (category: Category) => void;
  onClose: () => void;
}) {
  const { validateName, addCategory, updateCategory } = useCategories();
  const isEdit = !!category;
  const [name, setName] = useState(category?.name ?? "");
  const [icon, setIcon] = useState(category?.icon ?? "tag");
  const [color, setColor] = useState(category?.color ?? "blue");
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const nameRef = useAutoFocus<HTMLInputElement>(!isEdit);

  const validation = validateName(name, category?.id);
  const unchanged = isEdit && name.trim() === category.name && icon === category.icon && color === category.color;
  const shownError = serverError ?? (touched ? validation : null);
  const canSave = !validation && !unchanged && !saving;

  const save = async () => {
    setTouched(true);
    if (!canSave) return;
    setSaving(true);
    setServerError(null);
    try {
      const draft = { name: name.trim(), icon, color };
      const saved = category ? await updateCategory(category.id, draft) : await addCategory(draft);
      onSaved?.(saved);
      onClose();
    } catch (e) {
      setServerError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Sheet
        title={isEdit ? "Edit Category" : "New Category"}
        left={{ label: "Cancel", onPress: onClose }}
        right={{ label: isEdit ? "Save" : "Add", onPress: save, disabled: !canSave }}
        onClose={onClose}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          {/* Preview + name */}
          <section className="px-4 pt-4">
            <div className="flex flex-col items-center gap-4 rounded-[10px] bg-cell p-5">
              <span
                className="flex size-20 items-center justify-center rounded-full text-white shadow-[0_4px_14px_rgba(0,0,0,0.15)]"
                style={{ backgroundColor: colorFor(color) }}
              >
                <CategoryIcon iconKey={icon} size={38} />
              </span>
              <input
                ref={nameRef}
                aria-label="Category name"
                className="w-full rounded-[10px] bg-fill px-4 py-3 text-center text-[20px] font-semibold outline-none"
                style={{ color: colorFor(color) }}
                placeholder="Category name"
                maxLength={MAX_CATEGORY_NAME}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setTouched(true);
                  setServerError(null);
                }}
              />
              {shownError && <p className="-mt-1 text-[13px] text-ios-red">{shownError}</p>}
            </div>
          </section>
        </form>

        <Section header="Color">
          <div className="grid grid-cols-6 justify-items-center gap-3 p-4 sm:grid-cols-11">
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                aria-pressed={c === color}
                onClick={() => setColor(c)}
                className="flex size-9 items-center justify-center rounded-full text-white"
                style={{
                  backgroundColor: iosColor(c),
                  boxShadow: c === color ? `0 0 0 3px var(--bg-cell), 0 0 0 5px ${iosColor(c)}` : undefined,
                }}
              >
                {c === color && <Check size={16} strokeWidth={3} />}
              </button>
            ))}
          </div>
        </Section>

        <Section header="Icon">
          <div className="grid grid-cols-6 justify-items-center gap-3 p-4 sm:grid-cols-8">
            {CATEGORY_ICONS.map(({ key, icon: ItemIcon }) => {
              const selected = key === icon;
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={key}
                  aria-pressed={selected}
                  onClick={() => setIcon(key)}
                  className={`flex size-11 items-center justify-center rounded-full ${selected ? "text-white" : "bg-fill text-label-2"}`}
                  style={selected ? { backgroundColor: colorFor(color) } : undefined}
                >
                  <ItemIcon size={20} />
                </button>
              );
            })}
          </div>
        </Section>

        {category && (
          <Section>
            <ButtonRow destructive center onPress={() => setShowDelete(true)}>
              Delete Category
            </ButtonRow>
          </Section>
        )}
      </Sheet>

      {category && showDelete && (
        <DeleteCategorySheet category={category} onDeleted={onClose} onClose={() => setShowDelete(false)} />
      )}
    </>
  );
}
