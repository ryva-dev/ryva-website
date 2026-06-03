import Link from "next/link";

export const metadata = {
  title: "Business Associate Agreement — Ryva",
  description: "Ryva Forge LLC Business Associate Agreement (BAA) for HIPAA-covered entities.",
};

export default function BAAPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-20">
      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-green-700 mb-3">Legal</p>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Business Associate Agreement</h1>
        <p className="text-gray-500 text-sm">Effective upon execution &nbsp;·&nbsp; Ryva Forge LLC</p>
      </div>

      <div className="prose prose-gray max-w-none text-gray-700 leading-relaxed space-y-8">
        <section>
          <p>
            Ryva Forge LLC ("<strong>Business Associate</strong>") offers a Business Associate Agreement
            (BAA) to covered entities and business associates under the Health Insurance Portability and
            Accountability Act of 1996 (HIPAA) and its implementing regulations.
          </p>
          <p>
            A signed BAA is required before transmitting, processing, or storing any Protected Health
            Information (PHI) through the Ryva platform. The BAA establishes the permitted uses and
            disclosures of PHI, the safeguards Business Associate must apply, and the obligations of
            both parties under 45 C.F.R. Parts 160 and 164.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">What the BAA Covers</h2>
          <ul className="list-disc pl-6 space-y-2 text-gray-700">
            <li>Permitted uses and disclosures of Protected Health Information (PHI) and electronic PHI (ePHI)</li>
            <li>Administrative, physical, and technical safeguards required under the HIPAA Security Rule</li>
            <li>Breach notification obligations under the HIPAA Breach Notification Rule</li>
            <li>Subcontractor and downstream business associate obligations</li>
            <li>Individual rights, including the right to access and amend PHI</li>
            <li>Term and termination, including disposition of PHI upon termination</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Eligibility</h2>
          <p>
            BAAs are available to customers on the <strong>Enterprise plan</strong>. If you are on a
            lower tier and require HIPAA compliance, please contact our sales team to discuss an upgrade.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">How to Execute a BAA</h2>
          <ol className="list-decimal pl-6 space-y-2 text-gray-700">
            <li>Contact us at <a href="mailto:hello@ryvaforge.com" className="text-green-700 hover:text-green-800 underline">hello@ryvaforge.com</a> with the subject line <em>"BAA Request"</em>.</li>
            <li>Include your organization name, the name and title of the authorized signatory, and your Ryva account email.</li>
            <li>We will send a draft BAA for review within two (2) business days.</li>
            <li>Upon mutual execution, the BAA takes effect immediately and remains in force for the duration of your Ryva subscription.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Subprocessors</h2>
          <p>
            Ryva Forge LLC engages the following subprocessors that may handle ePHI under an active BAA:
          </p>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-6 font-semibold text-gray-900">Subprocessor</th>
                  <th className="text-left py-2 pr-6 font-semibold text-gray-900">Purpose</th>
                  <th className="text-left py-2 font-semibold text-gray-900">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="py-2 pr-6">Supabase</td>
                  <td className="py-2 pr-6">Database &amp; authentication</td>
                  <td className="py-2">United States</td>
                </tr>
                <tr>
                  <td className="py-2 pr-6">Railway</td>
                  <td className="py-2 pr-6">Backend infrastructure</td>
                  <td className="py-2">United States</td>
                </tr>
                <tr>
                  <td className="py-2 pr-6">Vercel</td>
                  <td className="py-2 pr-6">Frontend hosting</td>
                  <td className="py-2">United States</td>
                </tr>
                <tr>
                  <td className="py-2 pr-6">Anthropic</td>
                  <td className="py-2 pr-6">AI model inference</td>
                  <td className="py-2">United States</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Each subprocessor is subject to data processing agreements that include HIPAA-appropriate
            safeguards prior to any processing of ePHI.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Questions</h2>
          <p>
            For questions about HIPAA compliance, data handling, or to request our Security &amp; Compliance
            documentation, contact us at{" "}
            <a href="mailto:hello@ryvaforge.com" className="text-green-700 hover:text-green-800 underline">
              hello@ryvaforge.com
            </a>.
          </p>
        </section>
      </div>

      <div className="mt-16 pt-8 border-t border-gray-100 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Link
          href="/contact"
          className="inline-flex items-center justify-center rounded-full bg-green-700 text-white text-sm font-medium px-6 py-3 hover:bg-green-800 transition-colors"
        >
          Request a BAA
        </Link>
        <Link href="/privacy" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
          Privacy Policy →
        </Link>
        <Link href="/terms" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
          Terms of Service →
        </Link>
      </div>
    </div>
  );
}
