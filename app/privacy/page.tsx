import type { Metadata } from "next";
import Link from "next/link";
import {
  PublicPage,
  PublicSection,
  publicPageStyles as s,
} from "@/components/PublicPage";

export const metadata: Metadata = {
  title: "Privacy Policy | ClientTempo",
};

const CONTACT_EMAIL = "sorinsoftware@outlook.com";

export default function PrivacyPage() {
  return (
    <PublicPage title="Privacy Policy" subtitle="Last updated: October 9, 2026">
      <PublicSection title="Overview">
        <p style={s.paragraph}>
          This policy explains what information ClientTempo (&quot;we&quot;,
          &quot;us&quot;) collects, how we use it, and the choices you have. It
          applies to the ClientTempo website and app.
        </p>
      </PublicSection>

      <PublicSection title="Information we collect">
        <p style={s.paragraph}>
          <strong>Account information.</strong> When you sign up, our
          authentication provider (Clerk) collects your name, email address,
          and sign-in details. If you sign in with a connected account, we
          receive basic profile information from that provider.
        </p>
        <p style={s.paragraph}>
          <strong>Content you enter.</strong> This includes the emails, notes,
          property details, and prompts you type, paste, or forward into the
          tools. It can include information about your clients and other
          people, such as names, email addresses, and property feedback.
        </p>
        <p style={s.paragraph}>
          <strong>Generated results.</strong> Replies, summaries, and listing
          descriptions created for you.
        </p>
        <p style={s.paragraph}>
          <strong>Forwarded emails.</strong> If you use a forwarding address,
          we receive the forwarded message, including its sender, subject, and
          body, through our email provider (Mailgun).
        </p>
        <p style={s.paragraph}>
          <strong>Plan and credit information.</strong> Your plan, credit
          balances, and a recent history of credit activity (such as credits
          used, purchased, or refunded, with dates).
        </p>
        <p style={s.paragraph}>
          <strong>Payment information.</strong> Payments are handled by Stripe.
          We receive your subscription status and a customer reference, but we
          do not receive or store your full payment card details.
        </p>
      </PublicSection>

      <PublicSection title="How we use information">
        <ul style={s.list}>
          <li>To provide the tools, save your results, and show them back to you</li>
          <li>To generate AI results from the content you submit</li>
          <li>To receive forwarded emails and send generated replies back to you</li>
          <li>To manage your plan, credits, and payments</li>
          <li>To keep the service secure, prevent abuse, and fix problems</li>
          <li>To respond when you contact us for support</li>
        </ul>
        <p style={s.paragraph}>
          We do not sell your personal information. The app does not currently
          use third-party advertising or analytics trackers.
        </p>
      </PublicSection>

      <PublicSection title="Service providers we share information with">
        <p style={s.paragraph}>
          We use the following providers to run ClientTempo. Each receives
          only the information needed for its role and handles it under its own
          terms and privacy policy.
        </p>
        <ul style={s.list}>
          <li>
            <strong>OpenAI</strong> generates AI results. The content you submit
            to a tool, including RealGPT messages, is sent to OpenAI to produce
            a response.
          </li>
          <li>
            <strong>Clerk</strong> handles sign-up, sign-in, and account
            sessions.
          </li>
          <li>
            <strong>Stripe</strong> processes subscriptions and credit
            purchases.
          </li>
          <li>
            <strong>Mailgun</strong> receives forwarded emails and sends
            generated replies.
          </li>
          <li>
            <strong>Upstash</strong> stores saved content, credit balances, and
            related app data.
          </li>
          <li>
            <strong>Vercel</strong> hosts the application.
          </li>
        </ul>
        <p style={s.paragraph}>
          We may also disclose information if required by law or to protect the
          rights, safety, or security of our users or the service.
        </p>
      </PublicSection>

      <PublicSection title="Where information is processed">
        <p style={s.paragraph}>
          Our service providers may store and process information in the United
          States and other countries outside Canada. Information processed in
          another country is subject to that country&apos;s laws, which may
          allow access by authorities there.
        </p>
      </PublicSection>

      <PublicSection title="How long we keep information">
        <ul style={s.list}>
          <li>
            Saved replies, notes, and listings are kept until you ask us to
            delete them or your account is deleted.
          </li>
          <li>Unfinished Showing Notes drafts expire after 14 days.</li>
          <li>
            RealGPT conversations are not saved by ClientTempo. They are lost
            when you leave or refresh the page.
          </li>
          <li>
            Identifiers used to detect duplicate forwarded emails are kept for
            7 days.
          </li>
          <li>Credit history is limited to your most recent activity.</li>
          <li>
            Service providers may keep copies under their own retention
            policies.
          </li>
        </ul>
      </PublicSection>

      <PublicSection title="Cookies and browser storage">
        <p style={s.paragraph}>
          We use cookies set by Clerk to keep you signed in. The listing
          generator remembers your preferred character limit in your
          browser&apos;s local storage.
        </p>
      </PublicSection>

      <PublicSection title="Information about your clients">
        <p style={s.paragraph}>
          When you enter information about clients or other people, you are
          responsible for having the right to share it with us for this
          purpose. Please enter only what is needed for the task.
        </p>
      </PublicSection>

      <PublicSection title="Your choices and rights">
        <p style={s.paragraph}>
          Subject to applicable law, including Canadian privacy law, you can
          ask to access, correct, or delete your personal information, or
          withdraw your consent to its use. Saved items cannot currently be
          deleted from within the app, so please email us to request deletion.
          Withdrawing consent may mean we can no longer provide some or all of
          the service.
        </p>
        <p style={s.paragraph}>
          If you are not satisfied with our response, you may contact the
          Office of the Privacy Commissioner of Canada or your local privacy
          regulator.
        </p>
      </PublicSection>

      <PublicSection title="Security">
        <p style={s.paragraph}>
          We use reputable providers and limit access to your data to your own
          account. No online service can guarantee complete security, so
          please avoid entering sensitive information that is not needed, such
          as payment card numbers or government ID numbers.
        </p>
      </PublicSection>

      <PublicSection title="Children">
        <p style={s.paragraph}>
          ClientTempo is intended for professionals and is not directed at
          children.
        </p>
      </PublicSection>

      <PublicSection title="Changes to this policy">
        <p style={s.paragraph}>
          We may update this policy from time to time. When we do, we will
          change the date at the top of this page.
        </p>
      </PublicSection>

      <PublicSection title="Contact">
        <p style={s.paragraph}>
          For privacy questions or requests, email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} style={s.link}>
            {CONTACT_EMAIL}
          </a>
          . You can also visit our{" "}
          <Link href="/support" style={s.link}>
            Support
          </Link>{" "}
          page.
        </p>
      </PublicSection>
    </PublicPage>
  );
}
