import Link from "next/link";
import { Logo } from "./Logo";

const link = "block py-0.5 hover:text-[#14161c]";

export function Footer() {
  return (
    <footer className="mx-auto grid max-w-6xl grid-cols-2 gap-5 px-4 pt-8 pb-12 text-[13px] text-[#6b6e78] sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:px-11">
      <div className="col-span-2 md:col-span-1">
        <p className="mb-1.5 flex items-center gap-2 font-bold text-[#14161c]">
          <Logo size={20} /> Lifestyle OS
        </p>
        <p className="py-0.5">Budgeting for people who just moved.</p>
        <a href="mailto:team@lifestyleos.homes" className={link}>
          team@lifestyleos.homes
        </a>
        <p className="mt-2 py-0.5">© 2026</p>
      </div>
      <nav aria-label="Product">
        <p className="mb-1.5 font-bold text-[#14161c]">Product</p>
        <a href="#scan" className={link}>How it works</a>
        <a href="#features" className={link}>Features</a>
        <a href="#faq" className={link}>FAQ</a>
      </nav>
      <nav aria-label="Account">
        <p className="mb-1.5 font-bold text-[#14161c]">Account</p>
        <Link href="/expenses" className={link}>Get started</Link>
        <Link href="/expenses" className={link}>Log in</Link>
      </nav>
      <nav aria-label="Legal">
        <p className="mb-1.5 font-bold text-[#14161c]">Legal</p>
        <Link href="/privacy" className={link}>Privacy policy</Link>
        <Link href="/terms" className={link}>Terms</Link>
      </nav>
    </footer>
  );
}
