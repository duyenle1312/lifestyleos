"use client";

// Port of ContentView + MainTabView: signed out → LoginView, signed in → tabs.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleDollarSign, Layers, ScanText, Settings, ShoppingCart, UtensilsCrossed } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { CategoriesProvider } from "./CategoriesProvider";
import { PaymentMethodsProvider } from "./PaymentMethodsProvider";
import { LoginView } from "./LoginView";
import { Spinner } from "./ui";

const TABS = [
  { href: "/expenses", label: "Expenses", icon: CircleDollarSign },
  { href: "/shopping", label: "Shopping", icon: ShoppingCart },
  { href: "/inventory", label: "Inventory", icon: Layers },
  { href: "/scan", label: "Scan Receipt", icon: ScanText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, initializing } = useAuth();
  const pathname = usePathname();

  if (initializing) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!user) return <LoginView />;

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-dvh md:flex">
      {/* Sidebar – tablets / desktop */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-separator bg-bar px-3 py-5 backdrop-blur-xl md:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-ios-blue text-white">
            <UtensilsCrossed size={16} />
          </span>
          <span className="text-[17px] font-semibold">Lifestyle OS</span>
        </div>
        <nav className="flex flex-col gap-0.5">
          {TABS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] transition-colors ${
                isActive(href) ? "bg-ios-blue text-white" : "text-label hover:bg-fill"
              }`}
            >
              <Icon size={19} />
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 pb-[var(--tabbar-h)]">
        <div className="mx-auto w-full max-w-3xl">
          <CategoriesProvider>
            <PaymentMethodsProvider>{children}</PaymentMethodsProvider>
          </CategoriesProvider>
        </div>
      </main>

      {/* Bottom tab bar – phones */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-separator bg-bar pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        {TABS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex h-[50px] flex-1 flex-col items-center justify-center gap-0.5 ${
              isActive(href) ? "text-ios-blue" : "text-ios-gray"
            }`}
          >
            <Icon size={24} strokeWidth={isActive(href) ? 2.3 : 1.8} />
            <span className="text-[10px] font-medium leading-none">{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
