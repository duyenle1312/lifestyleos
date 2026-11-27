import { Serif } from "./Serif";
import { SessionCta } from "./SessionCta";

export function FinalCta() {
  return (
    <section className="bg-[#14161c] text-[#f3efe6]">
      <div className="mx-auto max-w-7xl px-4 py-18 text-center sm:px-6 md:px-11 md:py-24">
        <h2 className="text-[32px] leading-[1.08] font-semibold tracking-[-0.02em] md:text-[42px]">
          Your first receipt <Serif gold>is waiting.</Serif>
        </h2>
        <p className="mx-auto mt-2.5 mb-6 max-w-[420px] text-sm leading-[1.45] text-[#a9abb3]">
          Free during beta. Sign in with just your email. No app store, no password, no card.
        </p>
        <SessionCta variant="final" />
      </div>
    </section>
  );
}
