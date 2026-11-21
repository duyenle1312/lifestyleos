// Icon + color choices for categories. The database stores the keys (categories.icon / .color),
// so another client (e.g. iOS with SF Symbols) can map the same keys to its own icons.
import {
  Apple,
  Baby,
  BookOpen,
  Briefcase,
  Bus,
  Car,
  Coffee,
  Coins,
  Droplet,
  Dumbbell,
  Film,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  Heart,
  House,
  Landmark,
  Leaf,
  type LucideIcon,
  Monitor,
  Music,
  PawPrint,
  PiggyBank,
  Pill,
  Pizza,
  Plane,
  Scissors,
  Shirt,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Sprout,
  Stethoscope,
  Tag,
  TramFront,
  UtensilsCrossed,
  Wifi,
  Wine,
  Wrench,
  Zap,
} from "lucide-react";
import { createElement } from "react";
import { type IOSColor, iosColor } from "./constants";
import type { Category } from "./types";

export const CATEGORY_ICONS: { key: string; icon: LucideIcon }[] = [
  { key: "utensils", icon: UtensilsCrossed },
  { key: "cart", icon: ShoppingCart },
  { key: "house", icon: House },
  { key: "tram", icon: TramFront },
  { key: "bus", icon: Bus },
  { key: "car", icon: Car },
  { key: "fuel", icon: Fuel },
  { key: "plane", icon: Plane },
  { key: "phone", icon: Smartphone },
  { key: "wifi", icon: Wifi },
  { key: "zap", icon: Zap },
  { key: "droplet", icon: Droplet },
  { key: "coffee", icon: Coffee },
  { key: "pizza", icon: Pizza },
  { key: "apple", icon: Apple },
  { key: "wine", icon: Wine },
  { key: "shirt", icon: Shirt },
  { key: "scissors", icon: Scissors },
  { key: "paw", icon: PawPrint },
  { key: "baby", icon: Baby },
  { key: "heart", icon: Heart },
  { key: "pill", icon: Pill },
  { key: "stethoscope", icon: Stethoscope },
  { key: "dumbbell", icon: Dumbbell },
  { key: "gamepad", icon: Gamepad2 },
  { key: "film", icon: Film },
  { key: "music", icon: Music },
  { key: "book", icon: BookOpen },
  { key: "graduation", icon: GraduationCap },
  { key: "monitor", icon: Monitor },
  { key: "briefcase", icon: Briefcase },
  { key: "wrench", icon: Wrench },
  { key: "leaf", icon: Leaf },
  { key: "sprout", icon: Sprout },
  { key: "gift", icon: Gift },
  { key: "sparkles", icon: Sparkles },
  { key: "coins", icon: Coins },
  { key: "landmark", icon: Landmark },
  { key: "piggy", icon: PiggyBank },
  { key: "tag", icon: Tag },
];

export const CATEGORY_COLORS: IOSColor[] = [
  "blue",
  "cyan",
  "mint",
  "green",
  "yellow",
  "orange",
  "red",
  "pink",
  "purple",
  "indigo",
  "gray",
];

const ICON_BY_KEY = new Map(CATEGORY_ICONS.map((i) => [i.key, i.icon]));

export const iconFor = (key: string | null | undefined): LucideIcon => ICON_BY_KEY.get(key ?? "") ?? Tag;

export const colorFor = (key: string | null | undefined): string =>
  iosColor(CATEGORY_COLORS.includes(key as IOSColor) ? (key as IOSColor) : "gray");

/** Renders the icon for a stored key (avoids picking a component during render at call sites). */
export function CategoryIcon({ iconKey, size }: { iconKey: string | null | undefined; size?: number }) {
  return createElement(iconFor(iconKey), { size });
}

/** Icon + CSS color for a category; uncategorized / unknown → gray tag. */
export function categoryVisual(category: Pick<Category, "icon" | "color"> | null | undefined) {
  return { Icon: iconFor(category?.icon), color: colorFor(category?.color) };
}
