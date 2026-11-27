import type { Metadata } from "next";
import { LegalPage } from "@/components/landing/LegalPage";

export const metadata: Metadata = { title: "Terms — Lifestyle OS" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of" accent="use">
      <p>By using Lifestyle OS you agree to these terms.</p>

      <h2>Beta, as is</h2>
      <p>
        Lifestyle OS is a beta. It is provided as is, without warranties, and it is free during beta. Pricing may
        change later, and existing users will hear first.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Use the app lawfully and only for your own budgeting.</li>
        <li>Don&apos;t try to break, overload or get around the service or its security.</li>
        <li>Don&apos;t use it to store or send content you have no right to use.</li>
      </ul>

      <h2>Receipt scanning</h2>
      <p>
        Scan results are machine readings, and they can be wrong. Check the amounts and items
        before you rely on them.
      </p>

      <h2>Ending your account</h2>
      <p>
        You can stop using Lifestyle OS at any time, and ask us to delete your account by email. We may suspend or
        end accounts that break these terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <a href="mailto:team@lifestyleos.homes">team@lifestyleos.homes</a>.
      </p>
    </LegalPage>
  );
}
