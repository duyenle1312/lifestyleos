import type { Metadata } from "next";
import { LegalPage } from "@/components/landing/LegalPage";

export const metadata: Metadata = { title: "Privacy policy — Lifestyle OS" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" accent="policy">
      <p>
        Lifestyle OS is a budgeting app. This page explains in plain English what we keep, who helps us run it and
        how to have your data deleted.
      </p>

      <h2>What we store</h2>
      <p>
        Your email address, and the data you enter or save in the app: expenses, shopping lists and inventory. When
        you scan a receipt, only the items you choose to save are kept.
      </p>

      <h2>Who processes your data</h2>
      <ul>
        <li>
          <strong>Supabase</strong> hosts our database (Postgres) and handles sign-in.
        </li>
        <li>
          <strong>Resend</strong> sends the sign-in emails (your code and link).
        </li>
        <li>
          <strong>Vercel</strong> hosts the website and app, and handles every request (including receipt photos on
          their way to Gemini).
        </li>
        <li>
          <strong>Google Gemini</strong> reads receipt photos so we can turn them into items.
        </li>
      </ul>

      <h2>Receipt photos</h2>
      <p>
        We don&apos;t store your receipt photos. The photo is sent to Google&apos;s Gemini AI to read the items, and
        only the items you save are kept. During beta we use Gemini&apos;s free tier, which means Google may use
        what is sent to improve its products. Avoid scanning anything with personal details on it.
      </p>

      <h2>On your device</h2>
      <p>
        To work offline, the app keeps a copy of your data in browser storage (IndexedDB) on your
        own device.
      </p>

      <h2>No ads, no selling</h2>
      <p>We show no ads, use no analytics trackers and never sell your data.</p>

      <h2>How long we keep it</h2>
      <p>We keep your data until you delete your account.</p>

      <h2>Deleting your account</h2>
      <p>
        Email <a href="mailto:team@lifestyleos.homes">team@lifestyleos.homes</a> and we will delete your account
        and its data within 30 days. There is no in-app deletion yet.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy: <a href="mailto:team@lifestyleos.homes">team@lifestyleos.homes</a>.
      </p>
    </LegalPage>
  );
}
