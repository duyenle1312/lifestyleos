import Link from "next/link";
import { Logo } from "./Logo";
import { SessionCta } from "./SessionCta";

export function Nav() {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-[18px] sm:px-6 md:px-11">
      <Link href="/" className="flex items-center gap-2 text-base font-bold whitespace-nowrap">
        <Logo size={26} /> Lifestyle OS
      </Link>
      <nav aria-label="Page sections" className="hidden gap-[22px] text-sm text-[#14161c]/75 md:flex">
        <a href="#scan" className="hover:text-[#14161c]">Scan receipts</a>
        <a href="#expenses" className="hover:text-[#14161c]">Expenses</a>
        <a href="#shopping" className="hover:text-[#14161c]">Shopping</a>
        <a href="#pantry" className="hover:text-[#14161c]">Pantry</a>
      </nav>
      <SessionCta variant="nav" />
    </header>
  );
}
