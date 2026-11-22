"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { Menu } from "@/components/ui";
import { type Theme, THEME_STORAGE_KEY as STORAGE_KEY } from "@/lib/theme";

const OPTIONS: { value: Theme; label: string; icon: LucideIcon }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): Theme {
  const t = document.documentElement.getAttribute("data-theme");
  return t === "light" || t === "dark" ? t : "system";
}

function setTheme(theme: Theme) {
  const root = document.documentElement;
  try {
    if (theme === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, theme);
  } catch {}
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  listeners.forEach((l) => l());
}

export function ThemeMenu({ align = "right" }: { align?: "left" | "right" }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => "system" as const);
  const current = OPTIONS.find((o) => o.value === theme)!;

  return (
    <Menu
      label="Appearance"
      align={align}
      trigger={<current.icon size={20} />}
      entries={OPTIONS.map((o) => ({
        label: o.label,
        icon: o.icon,
        selected: o.value === theme,
        onSelect: () => setTheme(o.value),
      }))}
    />
  );
}
