import Link from "next/link";
import { SessionCta } from "./SessionCta";

export function Nav() {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-[18px] sm:px-6 md:px-11">
      <Link href="/" className="text-base font-bold whitespace-nowrap">
        <span aria-hidden="true">◐</span> Lifestyle OS
      </Link>
      <nav aria-label="Page sections" className="hidden gap-[22px] text-sm text-[#14161c]/75 md:flex">
        <a href="#how" className="hover:text-[#14161c]">How it works</a>
        <a href="#features" className="hover:text-[#14161c]">Features</a>
        <a href="#faq" className="hover:text-[#14161c]">FAQ</a>
      </nav>
      <SessionCta variant="nav" />
    </header>
  );
}
