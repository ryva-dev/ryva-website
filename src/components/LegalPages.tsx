// Legal & trust pages. Counsel should still review before marketing spend;
// support contact is wired from SUPPORT_EMAIL.

type LegalPageName = "privacy" | "terms" | "security";

const EFFECTIVE = "Effective date: July 12, 2026";
const COMPANY = "Ryva Forge, LLC";
const DEFAULT_SUPPORT = "support@ryva.dev";

function supportLine(supportEmail?: string | null) {
  return supportEmail?.trim() || DEFAULT_SUPPORT;
}

function Privacy({ supportEmail }: { supportEmail?: string | null }) {
  const contact = supportLine(supportEmail);
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="r-legal-meta">{EFFECTIVE}</p>

      <h2>What we collect</h2>
      <p>
        We collect the information you give us to run your office: your account details (name, email,
        hashed password), your onboarding answers and business context, the messages and tasks you
        create with your workers, and billing information processed by our payment provider. If you
        connect an inbox, we access the email content needed for your worker to do its job.
      </p>

      <h2>How your data is used and processed by AI</h2>
      <p>
        To generate work — drafts, plans, research, and replies — relevant parts of your business
        context and, if you connect Gmail, relevant email content are sent to our AI provider,
        Anthropic, for processing. Optional creative transcription may use OpenAI Whisper when that
        feature is enabled on the deployment. We do not sell your data or use it to serve ads.
      </p>

      <h2>Third parties we share data with</h2>
      <p>
        We use a small set of processors to operate the service: <b>Anthropic</b> (AI processing),
        <b> Google</b> (sign-in and Gmail when you connect it), <b>Stripe</b> (payments), and when
        video QA is enabled, <b>OpenAI</b> (transcription). Optional ops providers (for example Meta
        Ad Library or contact enrichment) only run when the operator configures them; creators do not
        paste those API keys into the product.
      </p>

      <h2>Security</h2>
      <p>
        Passwords are hashed, sessions use opaque hashed tokens, and connected-inbox OAuth tokens are
        encrypted at rest. See the Security page for details.
      </p>

      <h2>Your rights</h2>
      <p>
        You can export everything we hold about your account, and permanently delete your account and
        data, from Settings → Data &amp; privacy. Deleting your account cancels active subscriptions,
        removes your stored files, and erases your records. Disconnecting an inbox revokes the stored
        token at the provider.
      </p>

      <h2>Contact</h2>
      <p>
        Privacy questions: <a href={`mailto:${contact}`}>{contact}</a> ({COMPANY}).
      </p>
    </>
  );
}

function Terms({ supportEmail }: { supportEmail?: string | null }) {
  const contact = supportLine(supportEmail);
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="r-legal-meta">{EFFECTIVE}</p>

      <h2>The service</h2>
      <p>
        Ryva provides AI workers that perform role-specific work inside your office. The flagship
        hire for creators is Mara Vale (Creator Growth). Workers act within the permissions you grant
        and pause for your approval before taking sensitive or external actions such as sending email.
        You are responsible for reviewing and approving work before you act on it.
      </p>

      <h2>Your account</h2>
      <p>
        Keep your credentials secure and provide accurate information. You are responsible for
        activity under your account and for the content you supply to your workers.
      </p>

      <h2>Billing</h2>
      <p>
        Paid workers are billed as recurring subscriptions through Stripe at the salary shown at
        hire. You can manage or cancel billing from Settings. If a subscription lapses, that worker&apos;s
        background work pauses until billing is restored.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Don&apos;t use the service to break the law, infringe others&apos; rights, or send unlawful or abusive
        communications. AI output can be imperfect — verify anything before relying on it.
      </p>

      <h2>Disclaimers &amp; liability</h2>
      <p>
        The service is provided &quot;as is.&quot; To the extent permitted by law, {COMPANY} is not liable for
        indirect or consequential damages arising from use of the service or AI-generated output.
      </p>

      <h2>Contact</h2>
      <p>
        Support: <a href={`mailto:${contact}`}>{contact}</a>.
      </p>
    </>
  );
}

function Security({ supportEmail }: { supportEmail?: string | null }) {
  const contact = supportLine(supportEmail);
  return (
    <>
      <h1>Security</h1>
      <p className="r-legal-meta">How we protect your account and data · {EFFECTIVE}</p>

      <h2>Credentials &amp; sessions</h2>
      <p>
        Passwords are stored using scrypt hashing with per-user salts and constant-time comparison.
        Sessions are opaque tokens stored only as SHA-256 hashes, sent over secure, http-only cookies
        in production.
      </p>

      <h2>Encryption of connected accounts</h2>
      <p>
        When you connect an inbox, the OAuth tokens are encrypted at rest with AES-256-GCM. Tokens are
        never sent to your browser, and disconnecting an inbox revokes the token at the provider.
      </p>

      <h2>Payments</h2>
      <p>
        Payments are handled by Stripe; we don&apos;t store card numbers. Billing webhooks are signature-
        verified and processed idempotently.
      </p>

      <h2>Permissions &amp; approvals</h2>
      <p>
        Workers operate under an explicit permission model and require your approval before external
        actions like sending email. Daily usage limits guard against runaway automation.
      </p>

      <h2>Your controls</h2>
      <p>
        You can pause any worker, export your data, disconnect integrations, and delete your account
        at any time from Settings.
      </p>

      <h2>Report a concern</h2>
      <p>
        Security reports: <a href={`mailto:${contact}`}>{contact}</a>.
      </p>
    </>
  );
}

export function LegalPage({
  page,
  onHome,
  supportEmail
}: {
  page: LegalPageName;
  onHome?: () => void;
  supportEmail?: string | null;
}) {
  return (
    <div className="r-legal">
      <div className="r-legal-inner">
        <button className="ro-textlink r-legal-back" type="button" onClick={() => (onHome ? onHome() : (window.location.hash = "home"))}>
          ← Back
        </button>
        {page === "privacy" ? (
          <Privacy supportEmail={supportEmail} />
        ) : page === "terms" ? (
          <Terms supportEmail={supportEmail} />
        ) : (
          <Security supportEmail={supportEmail} />
        )}
        <p className="r-legal-note">
          This page describes how Ryva operates today. It is not legal advice; counsel should review
          policies before large-scale marketing.
        </p>
      </div>
    </div>
  );
}
