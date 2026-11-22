"use client";

// Small set of iOS-style building blocks shared by every screen.
import { Check, ChevronsUpDown, CircleX, LoaderCircle, type LucideIcon, Search, Trash2 } from "lucide-react";
import { Children, Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Overlays render at <body> level. Rendered in place, a sheet opened from inside another sheet sits in
 * that sheet's scroll container, and focusing its input made the browser scroll the parent form.
 */
function portal(node: React.ReactNode) {
  return typeof document === "undefined" ? node : createPortal(node, document.body);
}

/** Autofocus without letting the browser scroll ancestors (the sheet may still be sliding in). */
export function useAutoFocus<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (enabled) ref.current?.focus({ preventScroll: true });
  }, [enabled]);
  return ref;
}

// MARK: - Spinner

export function Spinner({ className = "", size = 22 }: { className?: string; size?: number }) {
  return <LoaderCircle size={size} className={`animate-spin text-label-2 ${className}`} />;
}

// MARK: - Body scroll lock (shared by sheets/alerts)

let lockCount = 0;
function useScrollLock() {
  useEffect(() => {
    lockCount++;
    document.body.style.overflow = "hidden";
    return () => {
      lockCount--;
      if (lockCount === 0) document.body.style.overflow = "";
    };
  }, []);
}

// MARK: - Sheet (modal with a navigation-bar style toolbar)

export interface BarButton {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  bold?: boolean;
}

export function Sheet({
  title,
  left,
  right,
  onClose,
  children,
  background = "grouped",
}: {
  title?: string;
  left?: BarButton;
  right?: BarButton;
  onClose: () => void;
  children: React.ReactNode;
  background?: "grouped" | "primary";
}) {
  useScrollLock();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const barButton = (b: BarButton | undefined, align: "left" | "right") =>
    b ? (
      <button
        type="button"
        onClick={b.onPress}
        disabled={b.disabled}
        className={`min-w-16 text-[17px] text-ios-blue disabled:text-label-3 ${
          align === "right" ? "text-right" : "text-left"
        } ${b.bold ?? align === "right" ? "font-semibold" : ""}`}
      >
        {b.label}
      </button>
    ) : (
      <span className="min-w-16" />
    );

  return portal(
    <div className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-black/40 md:items-center md:p-6">
      <div className="absolute inset-0" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative flex h-[calc(100dvh-env(safe-area-inset-top)-12px)] w-full animate-sheet-up flex-col overflow-hidden rounded-t-[12px] md:h-auto md:max-h-[85dvh] md:max-w-lg md:animate-pop-in md:rounded-[14px] md:shadow-2xl ${
          background === "grouped" ? "bg-grouped" : "bg-primary-bg"
        }`}
      >
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 px-4">
          {barButton(left, "left")}
          <h2 className="truncate text-[17px] font-semibold">{title}</h2>
          {barButton(right, "right")}
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom)+24px)]">
          {children}
        </div>
      </div>
    </div>,
  );
}

// MARK: - Toolbar / navigation bar

export function Toolbar({
  left,
  right,
  title,
  children,
}: {
  left?: React.ReactNode;
  right?: React.ReactNode;
  title?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-20 bg-grouped/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="relative flex h-11 items-center justify-between px-4">
        <div className="flex items-center">{left}</div>
        {title && (
          <h1 className="pointer-events-none absolute inset-x-24 truncate text-center text-[17px] font-semibold">
            {title}
          </h1>
        )}
        <div className="flex items-center">{right}</div>
      </div>
      {children}
    </div>
  );
}

export function LargeTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="px-4 pb-2 text-[34px] font-bold leading-tight">{children}</h1>;
}

export function IconButton({
  icon: Icon,
  onClick,
  label,
  filled,
  disabled,
}: {
  icon: LucideIcon;
  onClick?: () => void;
  label: string;
  filled?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex size-9 items-center justify-center text-ios-blue disabled:opacity-30"
    >
      <Icon size={22} strokeWidth={filled ? 2.6 : 2} />
    </button>
  );
}

// MARK: - Search bar (.searchable)

export function SearchBar({
  value,
  onChange,
  placeholder,
  inputRef,
  className = "px-4 pb-2",
  shortcut,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  inputRef?: React.Ref<HTMLInputElement>;
  className?: string;
  /** Keyboard hint shown while the field is empty (desktop). */
  shortcut?: string;
}) {
  return (
    <div className={className}>
      <label className="flex h-9 items-center gap-1.5 rounded-[10px] bg-fill px-2 text-label-2">
        <Search size={17} />
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-[17px] text-label outline-none"
        />
        {!value && shortcut && (
          <kbd className="rounded border border-separator px-1.5 font-sans text-[11px] text-label-3">{shortcut}</kbd>
        )}
        {value && (
          <button type="button" aria-label="Clear" onClick={() => onChange("")}>
            <CircleX size={17} className="fill-label-3 text-cell" />
          </button>
        )}
      </label>
    </div>
  );
}

// MARK: - Menu (popup menu with an inline picker)

export type MenuEntry =
  | { label: string; icon?: LucideIcon; selected?: boolean; onSelect: () => void; destructive?: boolean }
  | "divider";

export function Menu({
  trigger,
  entries,
  label,
  align = "left",
}: {
  trigger: React.ReactNode;
  entries: MenuEntry[];
  label: string;
  /** Edge the dropdown lines up with – use "right" for triggers near the right of the screen. */
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-1 text-ios-blue"
      >
        {trigger}
      </button>
      {open && (
        <div className={`absolute top-10 z-40 w-60 ${align === "right" ? "right-0" : "left-0"} ${MENU_PANEL}`}>
          <MenuItems entries={entries} onDone={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

const MENU_PANEL =
  "max-h-[60dvh] animate-pop-in overflow-y-auto overscroll-contain rounded-[13px] bg-cell/95 shadow-[0_8px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl";

function MenuItems({ entries, onDone, compact }: { entries: MenuEntry[]; onDone: () => void; compact?: boolean }) {
  return entries.map((entry, i) =>
    entry === "divider" ? (
      <div key={`d${i}`} className={compact ? "my-1 h-[0.5px] bg-separator" : "h-2 bg-fill"} />
    ) : (
      <button
        key={entry.label}
        type="button"
        role="menuitem"
        onClick={() => {
          entry.onSelect();
          onDone();
        }}
        className={
          compact
            ? `mx-1 flex w-[calc(100%-8px)] items-center gap-2 rounded-md px-2 py-1 text-left text-[14px] hover:bg-ios-blue hover:text-white ${
                entry.destructive ? "text-ios-red" : "text-label"
              }`
            : `flex w-full items-center gap-2 border-b border-separator/60 px-4 py-[11px] text-left text-[17px] last:border-b-0 active:bg-fill ${
                entry.destructive ? "text-ios-red" : "text-label"
              }`
        }
      >
        {compact ? (
          entry.icon && <entry.icon size={15} />
        ) : (
          <span className="w-5 shrink-0">{entry.selected && <Check size={17} strokeWidth={2.6} />}</span>
        )}
        <span className="flex-1">{entry.label}</span>
        {!compact && entry.icon && <entry.icon size={18} className="text-label" />}
      </button>
    ),
  );
}

// MARK: - Context menu (macOS-style right-click menu)

export interface ContextMenuState {
  x: number;
  y: number;
  entries: MenuEntry[];
}

/** Compact, cursor-anchored menu. Closes on outside click, Escape, scroll, resize or window blur. */
export function ContextMenu({ menu, onClose }: { menu: ContextMenuState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  // Flip so the menu never overflows the viewport (before paint, so it doesn't jump).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const pad = 8;
    el.style.left = `${menu.x + width + pad > window.innerWidth ? Math.max(pad, menu.x - width) : menu.x}px`;
    el.style.top = `${menu.y + height + pad > window.innerHeight ? Math.max(pad, menu.y - height) : menu.y}px`;
  }, [menu]);

  useEffect(() => {
    const onPointer = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    window.addEventListener("blur", onClose);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  return portal(
    <div
      ref={ref}
      role="menu"
      className={`fixed z-[70] w-56 py-1 ${MENU_PANEL} rounded-[10px] border border-separator/50`}
      style={{ left: menu.x, top: menu.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <MenuItems entries={menu.entries} onDone={onClose} compact />
    </div>,
  );
}

// MARK: - Inset grouped sections

export function Section({
  header,
  footer,
  children,
  inset = 16,
  className = "",
}: {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** Left inset of the row separators (aligned with the text). */
  inset?: number;
  className?: string;
}) {
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <section className={`px-4 pt-5 ${className}`}>
      {header && <div className="px-4 pb-1.5 text-[13px] uppercase text-label-2">{header}</div>}
      <div className="overflow-hidden rounded-[10px] bg-cell">
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 && <div className="h-[0.5px] bg-separator" style={{ marginLeft: inset }} />}
            {row}
          </Fragment>
        ))}
      </div>
      {footer && <div className="px-4 pt-1.5 text-[13px] text-label-2">{footer}</div>}
    </section>
  );
}

export function Row({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex min-h-11 items-center gap-3 px-4 py-[11px] text-[17px] ${className}`}>{children}</div>;
}

export function TextFieldRow({
  value,
  onChange,
  placeholder,
  inputMode,
  autoFocus = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoFocus?: boolean;
}) {
  const ref = useAutoFocus<HTMLInputElement>(autoFocus);
  return (
    <Row>
      <input
        ref={ref}
        className="min-w-0 flex-1 bg-transparent outline-none"
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
      />
    </Row>
  );
}

/** "Quantity  [___]" with the field right-aligned, like the shopping list form. */
export function LabeledFieldRow({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <Row>
      <span className="flex-1">{label}</span>
      <input
        className="w-[100px] bg-transparent text-right outline-none"
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
      />
    </Row>
  );
}

export function TextAreaRow({
  value,
  onChange,
  placeholder,
  minHeight = 100,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  return (
    <div className="px-4 py-[11px]">
      <textarea
        className="block w-full resize-y bg-transparent text-[17px] outline-none"
        style={{ minHeight }}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 ${
        checked ? "bg-ios-green" : "bg-fill"
      }`}
    >
      <span
        className={`absolute top-[2px] left-[2px] size-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)] transition-transform duration-200 ${
          checked ? "translate-x-[20px]" : ""
        }`}
      />
    </button>
  );
}

export function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row className="py-[6px]">
      <span className="flex-1">{label}</span>
      <Switch checked={checked} onChange={onChange} label={label} />
    </Row>
  );
}

/** Picker row: label on the left, current value on the right, native select underneath for the OS picker. */
export function SelectRow<T extends string | number>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; disabled?: boolean }[];
}) {
  const current = options.find((o) => o.value === value)?.label ?? "";
  return (
    <Row className="relative">
      <span className="flex-1">{label}</span>
      <span className="flex items-center gap-1 text-label-2">
        {current}
        <ChevronsUpDown size={15} />
      </span>
      <select
        aria-label={label}
        className="absolute inset-0 cursor-pointer opacity-0"
        value={String(value)}
        onChange={(e) => {
          const picked = options.find((o) => String(o.value) === e.target.value);
          if (picked) onChange(picked.value);
        }}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </Row>
  );
}

export function DateRow({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
}) {
  return (
    <Row className="py-[5px]">
      <span className="flex-1">{label}</span>
      <input
        type="date"
        aria-label={label}
        className="rounded-md bg-fill px-2.5 text-[17px] text-label outline-none"
        value={value}
        min={min}
        max={max}
        onChange={(e) => e.target.value && onChange(e.target.value)}
      />
    </Row>
  );
}

export function ValueRow({
  label,
  value,
  valueClassName = "text-label-2",
}: {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <Row>
      <span className="shrink-0">{label}</span>
      <span className={`ml-auto truncate text-right ${valueClassName}`}>{value}</span>
    </Row>
  );
}

export function ButtonRow({
  children,
  onPress,
  destructive,
  center,
  disabled,
}: {
  children: React.ReactNode;
  onPress: () => void;
  destructive?: boolean;
  center?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      className={`flex min-h-11 w-full items-center gap-2 px-4 py-[11px] text-[17px] active:bg-fill disabled:opacity-40 ${
        destructive ? "text-ios-red" : "text-ios-blue"
      } ${center ? "justify-center" : ""}`}
    >
      {children}
    </button>
  );
}

// MARK: - Swipe-to-delete row (.swipeActions)

const ACTION_WIDTH = 80;

export function SwipeRow({
  children,
  onDelete,
  onPress,
  hoverDelete = true,
  selected = false,
  disabled = false,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  onPress?: () => void;
  /** Highlighted as the row shown in the inspector (split view). */
  selected?: boolean;
  /** Show a delete button on mouse hover (desktop). */
  hoverDelete?: boolean;
  /** No swipe or hover delete (e.g. offline); `onPress` still works. */
  disabled?: boolean;
}) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const offsetRef = useRef(0);
  const gesture = useRef<{ x: number; y: number; base: number; axis: "none" | "h" | "v"; moved: boolean } | null>(
    null,
  );
  const suppressClick = useRef(false);

  const set = (v: number) => {
    offsetRef.current = v;
    setOffset(v);
  };

  return (
    <div className="group relative overflow-hidden">
      {!disabled && (
        <button
          type="button"
          onClick={() => {
            set(0);
            onDelete();
          }}
          className="absolute inset-y-0 right-0 flex items-center justify-center bg-ios-red text-[15px] text-white"
          // Hidden at rest: otherwise its red edge bleeds through the row's anti-aliased bottom edge.
          style={{ width: Math.max(ACTION_WIDTH, -offset), visibility: offset === 0 && !dragging ? "hidden" : "visible" }}
          tabIndex={offset === 0 ? -1 : 0}
        >
          <span className="flex flex-col items-center gap-0.5">
            <Trash2 size={18} />
            Delete
          </span>
        </button>
      )}

      <div
        aria-selected={selected || undefined}
        className={`relative ${selected ? "bg-gray5" : "bg-cell [@media(hover:hover)]:hover:bg-[color-mix(in_srgb,var(--bg-cell),var(--label)_4%)]"} ${dragging ? "" : "transition-transform duration-250 ease-out"} ${
          onPress ? "cursor-pointer active:bg-gray5" : ""
        }`}
        style={{ transform: `translateX(${disabled ? 0 : offset}px)`, touchAction: "pan-y" }}
        onPointerDown={(e) => {
          if (disabled || (e.pointerType === "mouse" && e.button !== 0)) return;
          gesture.current = { x: e.clientX, y: e.clientY, base: offsetRef.current, axis: "none", moved: false };
        }}
        onPointerMove={(e) => {
          const g = gesture.current;
          if (!g) return;
          const dx = e.clientX - g.x;
          const dy = e.clientY - g.y;
          if (g.axis === "none") {
            if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
              g.axis = "h";
              setDragging(true);
              e.currentTarget.setPointerCapture(e.pointerId);
            } else if (Math.abs(dy) > 8) {
              g.axis = "v";
            }
          }
          if (g.axis === "h") {
            g.moved = true;
            set(Math.min(0, Math.max(-ACTION_WIDTH * 1.6, g.base + dx)));
          }
        }}
        onPointerUp={() => {
          const g = gesture.current;
          gesture.current = null;
          setDragging(false);
          if (g?.moved) {
            suppressClick.current = true;
            set(offsetRef.current < -ACTION_WIDTH / 2 ? -ACTION_WIDTH : 0);
          }
        }}
        onPointerCancel={() => {
          gesture.current = null;
          setDragging(false);
          set(0);
        }}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            suppressClick.current = false;
            e.stopPropagation();
            e.preventDefault();
          } else if (!disabled && offsetRef.current !== 0) {
            set(0);
            e.stopPropagation();
            e.preventDefault();
          }
        }}
        onClick={onPress}
      >
        <div
          className={
            hoverDelete ? "transition-[padding] duration-200 [@media(hover:hover)]:group-hover:pr-11" : undefined
          }
        >
          {children}
        </div>
        {/* Mouse users: reveal a delete button on hover instead of dragging. */}
        {hoverDelete && !disabled && (
          <button
            type="button"
            aria-label="Delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="absolute top-1/2 right-3 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full bg-ios-red text-white [@media(hover:hover)]:group-hover:flex"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

// MARK: - Empty state / overlays / alerts

export function EmptyState({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[55dvh] flex-col items-center justify-center gap-4 px-6 text-center text-label-2">
      <Icon size={60} strokeWidth={1.4} />
      <p className="text-[17px] font-semibold">{title}</p>
      {subtitle && <p className="text-[15px]">{subtitle}</p>}
      {children}
    </div>
  );
}

export function LoadingOverlay({ message }: { message: string }) {
  useScrollLock();
  return portal(
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/40">
      <div className="flex flex-col items-center gap-5 rounded-[20px] bg-white/20 p-[30px] backdrop-blur-xl">
        <Spinner size={34} className="text-white" />
        <p className="text-[17px] font-semibold text-white">{message}</p>
      </div>
    </div>,
  );
}

export interface AlertButton {
  label: string;
  role?: "cancel" | "destructive";
  onPress?: () => void;
}

export function Alert({
  title,
  message,
  buttons,
  onDismiss,
}: {
  title: string;
  message?: string;
  buttons: AlertButton[];
  onDismiss: () => void;
}) {
  useScrollLock();
  return portal(
    <div className="fixed inset-0 z-[60] flex animate-fade-in items-center justify-center bg-black/40 p-6">
      <div role="alertdialog" className="w-[270px] animate-pop-in overflow-hidden rounded-[14px] bg-cell/95 text-center backdrop-blur-xl">
        <div className="px-4 pt-5 pb-5">
          <p className="text-[17px] font-semibold">{title}</p>
          {message && <p className="mt-1 text-[13px]">{message}</p>}
        </div>
        <div className={`flex border-t border-separator ${buttons.length > 2 ? "flex-col" : ""}`}>
          {buttons.map((b, i) => (
            <button
              key={b.label}
              type="button"
              onClick={() => {
                onDismiss();
                b.onPress?.();
              }}
              className={`h-11 flex-1 text-[17px] active:bg-fill ${i > 0 ? "border-l border-separator" : ""} ${
                b.role === "destructive" ? "text-ios-red" : "text-ios-blue"
              } ${b.role === "cancel" ? "font-semibold" : ""}`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ErrorBanner({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  if (!message) return null;
  return <Alert title="Error" message={message} buttons={[{ label: "OK" }]} onDismiss={onDismiss} />;
}
