import { Coins, House, Mail, WifiOff } from "lucide-react";

const LANGUAGES = [
  { name: "Български", lang: "bg" },
  { name: "Deutsch", lang: "de" },
  { name: "ไทย", lang: "th" },
  { name: "Tiếng Việt", lang: "vi" },
  { name: "日本語", lang: "ja" },
  { name: "Español", lang: "es" },
  { name: "Polski", lang: "pl" },
  { name: "Türkçe", lang: "tr" },
  { name: "Português", lang: "pt" },
  { name: "한국어", lang: "ko" },
];

const FACTS = [
  { icon: WifiOff, label: "Works offline" },
  { icon: House, label: "Installs to your home screen" },
  { icon: Mail, label: "No password needed" },
  { icon: Coins, label: "20+ currencies" },
];

export function ProofStrip() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-5 pb-12 text-center sm:px-6 md:px-11">
      <p className="mb-3.5 text-sm text-[#6b6e78]">Reads receipts in</p>
      <ul className="flex flex-wrap justify-center gap-2 text-sm">
        {LANGUAGES.map((l) => (
          <li key={l.lang} lang={l.lang} className="rounded-full bg-[#efe9dd] px-3 py-1.5">
            {l.name}
          </li>
        ))}
        <li className="rounded-full bg-[#efe9dd] px-3 py-1.5">+ any language</li>
      </ul>
      <ul className="mt-6 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-[#4a4d57]">
        {FACTS.map(({ icon: Icon, label }) => (
          <li key={label} className="inline-flex items-center gap-1.5">
            <Icon aria-hidden="true" size={15} strokeWidth={2} />
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}
