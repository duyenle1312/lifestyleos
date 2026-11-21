"use client";

// Port of MonthPickerView. iOS uses a graphical day picker where any day selects its month;
// a month grid is the direct equivalent and works better with a mouse too.
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Sheet } from "../ui";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function MonthPicker({
  selected,
  onSelect,
  onClose,
}: {
  selected: Date;
  onSelect: (month: Date) => void;
  onClose: () => void;
}) {
  const now = new Date();
  const [year, setYear] = useState(selected.getFullYear());
  const [picked, setPicked] = useState({ y: selected.getFullYear(), m: selected.getMonth() });
  const isFuture = (m: number) => year > now.getFullYear() || (year === now.getFullYear() && m > now.getMonth());

  return (
    <Sheet
      title="Select Month"
      left={{ label: "Cancel", onPress: onClose }}
      right={{
        label: "Done",
        onPress: () => {
          onSelect(new Date(picked.y, picked.m, 1));
          onClose();
        },
      }}
      onClose={onClose}
    >
      <div className="mx-4 mt-4 rounded-[13px] bg-cell p-4">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[17px] font-semibold">{year}</span>
          <div className="flex gap-4 text-ios-blue">
            <button type="button" aria-label="Previous year" onClick={() => setYear(year - 1)}>
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              aria-label="Next year"
              disabled={year >= now.getFullYear()}
              className="disabled:opacity-30"
              onClick={() => setYear(year + 1)}
            >
              <ChevronRight size={22} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MONTHS.map((label, m) => {
            const active = picked.y === year && picked.m === m;
            return (
              <button
                key={label}
                type="button"
                disabled={isFuture(m)}
                onClick={() => setPicked({ y: year, m })}
                className={`h-11 rounded-full text-[17px] disabled:text-label-3 ${
                  active ? "bg-ios-blue font-semibold text-white" : "text-label active:bg-fill"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}
