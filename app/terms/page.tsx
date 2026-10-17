import type { Metadata } from "next";
import Link from "next/link";
import {
  PublicPage,
  PublicSection,
  publicPageStyles as s,
} from "@/components/PublicPage";

export const metadata: Metadata = {
  title: "Terms of Service | ClientTempo",
};

const CONTACT_EMAIL = "sorinsoftware@outlook.com";

export default function TermsPage() {
  return (
    <PublicPage title="Terms of Service" subtitle="Last updated: October 9, 2026">
      <PublicSection title="About these terms">
        <p style={s.paragraph}>
          These terms explain the rules for using ClientTempo (&quot;ClientTempo&quot;,
          &quot;we&quot;, &quot;us&quot;). By creating an account
          or using the service, you agree to them. If you do not agree, please
          do not use the service.
        </p>
      </PublicSection>

      <PublicSection title="The service">
        <p style={s.paragraph}>
          ClientTempo provides AI-assisted writing tools for real estate
          professionals, including client email replies, showing notes, open
          house notes, listing descriptions, and the RealGPT assistant. Features
          may change over time.
        </p>
      </PublicSection>

      <PublicSection title="Your account">
        <ul style={s.list}>
          <li>
            You must provide accurate information and keep your sign-in details
            secure.
          </li>
          <li>You are responsible for activity that happens under your account.</li>
          <li>
            Let us know promptly if you believe your account has been accessed
            without permission.
          </li>
        </ul>
      </PublicSection>

      <PublicSection title="Your content and client information">
        <ul style={s.list}>
          <li>
            You keep ownership of the content you enter and the results you
            generate.
          </li>
          <li>
            You allow us to store and process your content as needed to provide
            the service, including sending it to our AI and email providers as
            described in our{" "}
            <Link href="/privacy" style={s.link}>
              Privacy Policy
            </Link>
            .
          </li>
          <li>
            If you enter information about clients or other people, you are
            responsible for having the right to share it and for meeting any
            privacy, brokerage, or professional obligations that apply to you.
          </li>
        </ul>
      </PublicSection>

      <PublicSection title="AI-generated results">
        <ul style={s.list}>
          <li>
            Results are produced by AI and may be inaccurate, incomplete, or
            unsuitable for your situation.
          </li>
          <li>
            Review and edit every result before you send, publish, or rely on
            it. You are responsible for what you send to clients and what you
            publish, including compliance with advertising, fair housing, and
            brokerage rules.
          </li>
          <li>
            ClientTempo does not provide legal, financial, or professional real
            estate advice.
          </li>
        </ul>
      </PublicSection>

      <PublicSection title="Acceptable use">
        <p style={s.paragraph}>You agree not to:</p>
        <ul style={s.list}>
          <li>Use the service for unlawful, misleading, or harmful purposes</li>
          <li>Send spam or unsolicited messages through the service</li>
          <li>
            Try to access other users&apos; data, interfere with the service, or
            bypass usage limits or credit checks
          </li>
          <li>Resell or share access to your account without our permission</li>
        </ul>
      </PublicSection>

      <PublicSection title="Plans, credits, and payments">
        <ul style={s.list}>
          <li>
            Current plans and prices are shown on the{" "}
            <Link href="/pricing" style={s.link}>
              Pricing
            </Link>{" "}
            page. Prices are in US dollars.
          </li>
          <li>
            Paid subscriptions renew monthly until cancelled. You can manage or
            cancel your subscription from the{" "}
            <Link href="/billing" style={s.link}>
              Billing
            </Link>{" "}
            page. When a subscription ends, your account moves to the Free plan.
          </li>
          <li>
            Monthly plan credits reset at the start of each calendar month (UTC)
            and do not carry over. Purchased credit packs do not reset.
          </li>
          <li>
            Credits have no cash value and cannot be transferred between
            accounts.
          </li>
          <li>
            Payments are processed by Stripe. We do not receive or store your
            full payment card details.
          </li>
          <li>
            If you have a question about a charge, contact us. Nothing in these
            terms limits any rights you have under applicable consumer
            protection law.
          </li>
        </ul>
      </PublicSection>

      <PublicSection title="Changes and availability">
        <p style={s.paragraph}>
          We may update, add, or remove features, and we may change prices with
          reasonable notice. We aim to keep the service available but cannot
          guarantee it will be uninterrupted or error-free.
        </p>
      </PublicSection>

      <PublicSection title="Suspension and closing your account">
        <p style={s.paragraph}>
          You may stop using the service at any time. To close your account,
          contact us. We may suspend or close accounts that break these terms or
          put the service or other users at risk.
        </p>
      </PublicSection>

      <PublicSection title="Disclaimers and limitation of liability">
        <p style={s.paragraph}>
          To the extent permitted by law, the service is provided &quot;as
          is&quot; without warranties of any kind, and we are not liable for
          indirect or consequential losses arising from your use of the service
          or of AI-generated results.
        </p>
      </PublicSection>

      <PublicSection title="Changes to these terms">
        <p style={s.paragraph}>
          We may update these terms from time to time. When we do, we will
          change the date at the top of this page. Continuing to use the
          service after an update means you accept the revised terms.
        </p>
      </PublicSection>

      <PublicSection title="Contact">
        <p style={s.paragraph}>
          Questions about these terms can be sent to{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} style={s.link}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </PublicSection>
    </PublicPage>
  );
}
