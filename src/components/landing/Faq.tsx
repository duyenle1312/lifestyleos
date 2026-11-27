const FAQS = [
  { q: "Is it free?", a: "Free during beta. If that changes, existing users hear first." },
  {
    q: "Which languages and countries does it work with?",
    a: "Any printed receipt language, translated into English, plus the supported currencies.",
  },
  {
    q: "Do I need to download anything from an app store?",
    a: "No. Open it in the browser and add it to your home screen.",
  },
  {
    q: "What happens to my receipt photos?",
    a: "We don't store them. The photo goes to Google's Gemini AI to read the items, and only the items you save are kept. During beta we use Gemini's free tier, which means Google may use what's sent to improve its products, so avoid scanning anything with personal details on it.",
  },
  {
    q: "Can I use it without internet?",
    a: "Yes. Lists and expenses work offline and sync later. Scanning needs a connection.",
  },
];

// Native <details>: no JavaScript needed.
export function Faq() {
  return (
    <section id="faq" data-reveal className="mx-auto max-w-7xl scroll-mt-4 px-4 py-14 sm:px-6 md:px-11 md:py-16">
      <h2 className="text-[26px] leading-[1.08] font-semibold tracking-[-0.02em] md:text-[30px]">Questions</h2>
      <div className="mt-2.5">
        {FAQS.map((f) => (
          <details key={f.q} className="group border-b border-[#14161c]/10">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3.5 text-[15px] [&::-webkit-details-marker]:hidden">
              <span>{f.q}</span>
              <span aria-hidden="true" className="text-lg transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="max-w-[640px] pb-4 text-sm leading-normal text-[#4a4d57]">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
