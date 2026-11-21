import { ListFilter, Pencil } from "lucide-react";

/** SF Symbol `line.3.horizontal.decrease.circle` / `.fill` */
export function FilterGlyph({ active }: { active: boolean }) {
  return (
    <span
      className={`flex size-[23px] items-center justify-center rounded-full ${
        active ? "bg-ios-blue text-white" : "border-[1.8px] border-ios-blue text-ios-blue"
      }`}
    >
      <ListFilter size={13} strokeWidth={2.6} />
    </span>
  );
}

/** SF Symbol `pencil.circle.fill` */
export function PencilCircleGlyph() {
  return (
    <span className="flex size-[22px] items-center justify-center rounded-full bg-ios-blue text-white">
      <Pencil size={11} strokeWidth={2.8} />
    </span>
  );
}

/** Small category / status bubble used by expense + inventory rows. */
export function IconBubble({ icon: Icon, color }: { icon: React.ComponentType<{ size?: number }>; color: string }) {
  return (
    <span
      className="flex size-11 shrink-0 items-center justify-center rounded-full"
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 20%, transparent)` }}
    >
      <Icon size={18} />
    </span>
  );
}
