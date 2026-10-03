import { useEffect, type ReactNode } from "react";

const EFFECTIVE_DATE = "October 2, 2026";

type LegalSectionData = {
  title: string;
  paragraphs: Array<string | { label: string; body: string }>;
};

function LegalPage({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  useEffect(() => {
    document.title = `${title} · Ryva`;
  }, [title]);

  return <section className="ry-mkt-band-cream">
    <article className="ry-mkt-section ry-mkt-legal-page">
      <header className="ry-mkt-legal-header">
        <p className="ry-mkt-kicker">Legal</p>
        <h1 className="ry-mkt-display">{title}</h1>
        <p className="ry-mkt-legal-effective">Effective Date: {EFFECTIVE_DATE}</p>
        {intro ? <p className="ry-mkt-lede">{intro}</p> : null}
      </header>
      <div className="ry-mkt-legal-body">{children}</div>
    </article>
  </section>;
}

function LegalSections({ sections }: { sections: LegalSectionData[] }) {
  return <>{sections.map((section) => <section key={section.title}>
    <h2>{section.title}</h2>
    {section.paragraphs.map((paragraph) => typeof paragraph === "string"
      ? <p key={paragraph}>{paragraph}</p>
      : <div className="ry-mkt-legal-subsection" key={paragraph.label}>
          <h3>{paragraph.label}</h3>
          <p>{paragraph.body}</p>
        </div>)}
  </section>)}</>;
}

function LegalContact() {
  return <address>
    Ryva Forge, LLC<br />
    d/b/a Ryva<br />
    2924 Espy Ave<br />
    Pittsburgh, PA 15216<br />
    United States<br />
    <a href="mailto:support@ryvaforge.com">support@ryvaforge.com</a>
  </address>;
}

const termsSections: LegalSectionData[] = [
  {
    title: "1. Eligibility",
    paragraphs: [
      "You must be at least 18 years old and legally capable of entering into a binding agreement to use or purchase the Services.",
      "By creating an account or purchasing a Ryva product, you represent that you satisfy these requirements.",
      "You are responsible for ensuring that your use of Ryva complies with laws applicable to you."
    ]
  },
  {
    title: "2. The Ryva Program",
    paragraphs: [
      "The Ryva Program is an independent educational program concerning brand placement, wholesale-commercial concepts, retailer and buyer relationships, products, assortments, orders, commissions, commercial analysis, and related subjects.",
      "The Program may include written lessons, educational videos, fictional commercial examples, guided activities, interactive calculations, knowledge checks, simulated commercial records, simulated Ryva workspace experiences, a Final Brand Placement Simulation, and a Final Brand Placement Assessment.",
      "The Ryva Program is designed for educational and informational purposes."
    ]
  },
  {
    title: "3. The Ryva Program Is Not a Professional Credential",
    paragraphs: [
      "Completion of The Ryva Program does not constitute professional certification, occupational certification, an academic degree or credential, professional licensure, government approval, employment qualification, proof of professional competence, job placement, eligibility for employment, or authorization to act on behalf of any brand or retailer.",
      "The completion designation means only that the user satisfied Ryva’s internal Program completion requirements.",
      "The completion designation is:",
      "The Ryva Program: Completed",
      "Ryva does not represent that any employer, brand, retailer, agency, showroom, licensing body, educational institution, trade association, or other organization will recognize Program completion."
    ]
  },
  {
    title: "4. No Employment, Income, Sales, or Business Guarantee",
    paragraphs: [
      "Ryva makes no promise or guarantee regarding employment, freelance opportunities, brand representation opportunities, client acquisition, retailer relationships, buyer responses, product placement, sales, opening orders, reorders, commission income, business revenue, profits, commercial success, career advancement, or earnings of any amount.",
      "Commercial outcomes depend on numerous circumstances outside Ryva’s control.",
      "Examples, simulations, financial calculations, case studies, hypothetical commissions, and commercial scenarios are educational illustrations and are not predictions of results.",
      "Nothing on the Services should be interpreted as a representation that purchasing or completing The Ryva Program will result in employment or income."
    ]
  },
  {
    title: "5. Independent Commercial Relationships",
    paragraphs: [
      "Ryva is not a party to the user’s independent commercial relationships.",
      "Any relationship, agreement, communication, transaction, representation arrangement, sales arrangement, placement, order, commission arrangement, payment obligation, dispute, claim, or other commercial activity between you and any brand, retailer, buyer, merchant, customer, client, representative, agency, showroom, distributor, supplier, manufacturer, service provider, employer, contractor, or other third party is solely between you and that third party.",
      "Ryva does not create, supervise, broker, approve, guarantee, manage, enforce, or assume responsibility for those relationships.",
      "Ryva is not responsible for whether a brand chooses to work with you, a retailer responds to you, a retailer places an order, an account pays an invoice, inventory is delivered, a product sells, a reorder occurs, a brand pays a commission, a contract is honored, exclusivity is recognized, territory disputes arise, a buyer changes employment, an order is canceled, commissions are adjusted, or a commercial relationship succeeds or fails.",
      "You are responsible for evaluating and entering into your own commercial relationships."
    ]
  },
  {
    title: "6. No Agency, Employment, Partnership, or Fiduciary Relationship",
    paragraphs: [
      "Your use of Ryva does not create an employment relationship, agency relationship, partnership, joint venture, franchise, fiduciary relationship, or representative relationship between you and Ryva.",
      "You are not authorized to make statements, commitments, warranties, agreements, or representations on behalf of Ryva unless we expressly authorize you in writing.",
      "Likewise, Ryva does not act as your agent in your relationships with brands, buyers, retailers, or other parties."
    ]
  },
  {
    title: "7. No Legal, Tax, Accounting, Investment, or Professional Advice",
    paragraphs: [
      "Ryva provides educational and software tools.",
      "Nothing in the Services constitutes legal, tax, accounting, investment, financial, employment, contractual, or other regulated professional advice.",
      "Examples involving commissions, pricing, orders, payment terms, territories, representation arrangements, margins, or other commercial matters are educational only.",
      "You are responsible for obtaining appropriate professional advice regarding your particular circumstances."
    ]
  },
  {
    title: "8. Commercial Judgment",
    paragraphs: [
      "Brand placement and wholesale-commercial decisions involve judgment.",
      "Ryva may provide educational frameworks, scores, calculations, organizational tools, prompts, analytics, or recommendations.",
      "These tools are designed to assist analysis and organization. They do not replace independent judgment.",
      "No Ryva score, recommendation, generated output, dashboard, calculation, or analysis should be treated as a guarantee that a commercial decision is appropriate.",
      "You are responsible for verifying information before relying upon it."
    ]
  },
  {
    title: "9. Fictional Educational Content",
    paragraphs: [
      "The Ryva Program uses fictional brands, retailers, buyers, orders, commercial circumstances, and other scenarios for educational purposes.",
      "Unless expressly stated otherwise, fictional entities appearing in Program materials are not affiliated with, endorsed by, sponsored by, or connected to real businesses.",
      "Any resemblance to actual businesses or individuals is coincidental unless expressly identified otherwise."
    ]
  },
  {
    title: "10. Program Purchase",
    paragraphs: [
      "The current purchase price for The Ryva Program is displayed before checkout.",
      "At launch, the Program may be offered for a one-time purchase price of $397 USD.",
      "Prices may change prospectively.",
      "A price change does not retroactively modify a completed purchase.",
      "Payment processing may be provided by Stripe or another third-party payment processor.",
      "Ryva does not directly store complete payment card numbers."
    ]
  },
  {
    title: "11. Program Purchases Are Final",
    paragraphs: [
      "Except where applicable law requires otherwise, purchases of The Ryva Program are final and non-refundable.",
      "By purchasing the Program, you acknowledge that you are purchasing access to digital educational content and interactive services.",
      "Ryva does not provide refunds because of change of mind, failure to begin the Program, failure to complete the Program, dissatisfaction with commercial results, inability to obtain brand relationships, inability to obtain retailer relationships, lack of buyer responses, inability to obtain employment, failure to earn income, disagreement with the curriculum, failure to achieve a particular score, failure to use included access, loss of interest, scheduling conflicts, or mistaken expectations inconsistent with the disclosures made before purchase.",
      "This policy does not limit any non-waivable rights you may have under applicable law.",
      "Nothing in these Terms limits legitimate rights relating to unauthorized transactions, duplicate charges, fraudulent transactions, or Services not provided as promised."
    ]
  },
  {
    title: "12. Payment Disputes and Chargebacks",
    paragraphs: [
      "If you believe you were charged incorrectly, contact Ryva at support@ryvaforge.com before initiating a payment dispute where practical.",
      "Nothing in this section prevents you from exercising rights provided by your payment provider or applicable law.",
      "Fraudulent or knowingly false payment disputes may result in account suspension or termination."
    ]
  },
  {
    title: "13. Ryva Pro Access",
    paragraphs: [
      "Program completion may include an introductory period of Ryva Pro access as described at the time of purchase.",
      "The current intended completion benefit is:",
      "30 days of Ryva Pro access beginning when Program completion is recorded.",
      "The introductory period begins once and is tied to the authoritative Program completion event.",
      "Revisiting course material or repeating completion actions does not restart the introductory period.",
      "Access to the educational Program may remain available after the Ryva Pro introductory period ends."
    ]
  },
  {
    title: "14. Paid Ryva Pro Subscription",
    paragraphs: [
      "If Ryva offers a recurring Ryva Pro subscription, the applicable price, billing frequency, renewal terms, cancellation method, and trial or introductory terms will be presented before you subscribe.",
      "A paid subscription will not begin automatically unless the checkout or subscription interface clearly tells you that recurring billing will occur and you affirmatively agree to it.",
      "If recurring billing is enabled, cancellation stops future renewals but ordinarily does not retroactively refund charges already incurred, except where required by law or expressly stated otherwise."
    ]
  },
  {
    title: "15. Accounts and Security",
    paragraphs: [
      "You are responsible for maintaining the confidentiality of your account credentials.",
      "You must provide accurate account information.",
      "You may not share credentials to avoid purchasing access, permit unauthorized use of your account, impersonate another person, create accounts using false identities, bypass access controls, or attempt to gain unauthorized access to another user’s information.",
      "Notify us promptly if you believe your account has been compromised."
    ]
  },
  {
    title: "16. Learner Progress and Assessments",
    paragraphs: [
      "Ryva may record lesson completion, knowledge-check responses, guided activity submissions, simulation progress, assessment attempts, scores, and Program completion state.",
      "The Final Brand Placement Assessment is an internal Program completion requirement.",
      "An assessment score is not a professional licensing examination result or occupational credential.",
      "Ryva may maintain rules relating to assessment integrity, including randomized questions and limits on access to answer banks."
    ]
  },
  {
    title: "17. User Content and Submissions",
    paragraphs: [
      "You may submit text, responses, files, commercial records, notes, or other material through the Services (“User Content”).",
      "You retain ownership of your User Content.",
      "You grant Ryva a limited license to host, process, reproduce, transmit, and display User Content as reasonably necessary to operate the Services, provide requested functionality, maintain records, provide support, secure the platform, and improve reliability.",
      "Ryva does not obtain ownership of your commercial relationships merely because information about them is stored in the Services."
    ]
  },
  {
    title: "18. Confidential and Third-Party Information",
    paragraphs: [
      "You are responsible for ensuring that you have the right to enter or upload information into Ryva.",
      "Do not upload information you are legally prohibited from sharing.",
      "You are responsible for obligations you owe to brands, retailers, employers, customers, or other parties concerning confidentiality and commercial information.",
      "Ryva does not authorize you to violate nondisclosure agreements, confidentiality obligations, privacy rights, intellectual-property rights, or contractual restrictions."
    ]
  },
  {
    title: "19. Accuracy of Records",
    paragraphs: [
      "You agree not to knowingly enter false or misleading information into Ryva, including fabricated buyer interactions, orders, payments, commissions, sales, placements, or account activity.",
      "Ryva is not responsible for decisions made from inaccurate data supplied by users or third parties."
    ]
  },
  {
    title: "20. Acceptable Use",
    paragraphs: [
      "You may not use Ryva to violate law, defraud or deceive another person, harass others, impersonate another person or company, send unlawful spam, infringe intellectual-property rights, distribute malware, bypass security protections, scrape the Services in an unauthorized manner, reverse engineer restricted parts of the Services except where law expressly permits, gain unauthorized access to accounts or data, interfere with the operation of the Services, or falsely claim affiliation with a brand or retailer."
    ]
  },
  {
    title: "21. Intellectual Property",
    paragraphs: [
      "Ryva and its licensors own the Services and associated materials, including curriculum, lesson text, graphics, software, user-interface designs, trademarks, logos, proprietary frameworks, assessment materials, and fictional educational scenarios.",
      "Purchase grants you a limited, personal, non-exclusive, non-transferable right to access the applicable Services.",
      "You may not reproduce, resell, publish, distribute, license, upload publicly, or create competing course materials from substantial portions of the Program without written permission."
    ]
  },
  {
    title: "22. Third-Party Services",
    paragraphs: [
      "Ryva may rely on third parties including payment processors, hosting providers, authentication providers, email providers, analytics or monitoring providers, and infrastructure providers.",
      "Your use of certain third-party functionality may also be governed by that provider’s terms.",
      "Ryva is not responsible for third-party services outside its reasonable control."
    ]
  },
  {
    title: "23. Availability and Changes",
    paragraphs: [
      "We may modify, improve, discontinue, replace, or update aspects of the Services.",
      "We do not guarantee that every feature will remain available indefinitely.",
      "We will not intentionally remove purchased Program access merely because Ryva Pro features change, except where necessary because of law, security, misuse, or service discontinuation."
    ]
  },
  {
    title: "24. Suspension and Termination",
    paragraphs: [
      "We may suspend or terminate access when reasonably necessary because of fraud, abuse, nonpayment, security threats, unauthorized account sharing, illegal activity, or material violation of these Terms.",
      "Where appropriate, we may provide notice and an opportunity to resolve the issue.",
      "Sections intended by their nature to survive termination remain effective after termination."
    ]
  },
  {
    title: "25. Disclaimer of Warranties",
    paragraphs: [
      "TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE SERVICES ARE PROVIDED “AS IS” AND “AS AVAILABLE.”",
      "RYVA DISCLAIMS WARRANTIES NOT EXPRESSLY PROVIDED IN THESE TERMS, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND WARRANTIES ARISING FROM COURSE OF DEALING OR USAGE.",
      "RYVA DOES NOT WARRANT THAT THE SERVICES WILL BE ERROR-FREE, THE SERVICES WILL ALWAYS BE AVAILABLE, ALL DATA WILL ALWAYS BE ACCURATE, USE OF THE SERVICES WILL PRODUCE COMMERCIAL RESULTS, THIRD PARTIES WILL RESPOND OR PERFORM AS EXPECTED, OR COMPLETION OF THE PROGRAM WILL PRODUCE EMPLOYMENT OR INCOME.",
      "Some jurisdictions do not permit certain warranty disclaimers, so portions of this section may not apply to you."
    ]
  },
  {
    title: "26. Limitation of Liability",
    paragraphs: [
      "TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, RYVA FORGE, LLC AND ITS OWNERS, OFFICERS, EMPLOYEES, CONTRACTORS, AFFILIATES, AND SERVICE PROVIDERS WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES ARISING FROM OR RELATING TO THE SERVICES.",
      "THIS INCLUDES LOSS OF PROFITS, SALES, COMMISSIONS, BUSINESS OPPORTUNITIES, GOODWILL, DATA, OR COMMERCIAL RELATIONSHIPS.",
      "TO THE MAXIMUM EXTENT PERMITTED BY LAW, RYVA FORGE, LLC’S AGGREGATE LIABILITY ARISING FROM OR RELATING TO THE SERVICES WILL NOT EXCEED THE AMOUNT YOU PAID TO RYVA FOR THE PRODUCT OR SERVICE GIVING RISE TO THE CLAIM DURING THE TWELVE MONTHS BEFORE THE EVENT GIVING RISE TO LIABILITY.",
      "Nothing in these Terms excludes liability that applicable law does not permit us to exclude."
    ]
  },
  {
    title: "27. Indemnification",
    paragraphs: [
      "To the extent permitted by law, you agree to indemnify and hold harmless Ryva Forge, LLC and its owners, affiliates, officers, employees, and contractors from claims, liabilities, damages, losses, and reasonable expenses arising from your unlawful use of the Services, your violation of these Terms, your infringement of another party’s rights, information you upload without authorization, your independent commercial dealings with third parties, or promises or representations you make to brands, buyers, customers, or other parties.",
      "This section does not require indemnification for conduct for which indemnification may not lawfully be required."
    ]
  },
  {
    title: "28. Governing Law",
    paragraphs: [
      "These Terms are governed by the laws of the Commonwealth of Pennsylvania, without regard to conflict-of-law principles, except where applicable consumer law requires otherwise."
    ]
  },
  {
    title: "29. Informal Dispute Resolution",
    paragraphs: [
      "Before filing a formal legal claim, you and Ryva agree to attempt in good faith to resolve the dispute informally.",
      "Send notice to:",
      "support@ryvaforge.com",
      "Include your name, account email, description of the dispute, and requested resolution.",
      "Unless applicable law requires otherwise, legal proceedings relating to these Terms or the Services may be brought in courts of competent jurisdiction located in Pennsylvania."
    ]
  },
  {
    title: "30. Changes to These Terms",
    paragraphs: [
      "We may update these Terms.",
      "When changes are material, we may provide notice through the Services, email, or another reasonable method.",
      "Changes apply prospectively unless law permits otherwise."
    ]
  }
];

export function TermsPage() {
  return <LegalPage
    title="Terms of Service"
    intro="These Terms of Service (“Terms”) govern your access to and use of The Ryva Program, the Ryva website, Ryva software, Ryva Pro, and related products, services, content, features, and applications collectively referred to as the “Services.”"
  >
    <p>The Services are operated by Ryva Forge, LLC, doing business as Ryva (“Ryva,” “we,” “us,” or “our”).</p>
    <p>By creating an account, purchasing The Ryva Program, accessing the Services, or otherwise using Ryva, you agree to these Terms.</p>
    <p>If you do not agree to these Terms, do not purchase or use the Services.</p>
    <LegalSections sections={termsSections} />
    <section>
      <h2>31. Contact</h2>
      <LegalContact />
    </section>
  </LegalPage>;
}

const privacySections: LegalSectionData[] = [
  {
    title: "1. Information We Collect",
    paragraphs: [
      { label: "Account Information", body: "We may collect your name, email address, account identifier, securely processed password credentials, authentication information, and session information." },
      { label: "Program Information", body: "When you participate in The Ryva Program, we may collect lesson progress, completion states, knowledge-check activity, guided activity responses, simulation submissions, assessment attempts, assessment scores, and Program completion records." },
      { label: "Ryva Operating Data", body: "If you use Ryva’s operating features, you may submit commercial information such as brand information, product information, retailer information, buyer/contact information, placements, outreach history, accounts, orders, reorders, commissions, tasks, notes, and documents. You are responsible for ensuring you have authority to provide third-party information to Ryva." },
      { label: "Transaction Information", body: "When you purchase a Ryva product, we may receive transaction-related information such as payment status, purchase amount, currency, payment-provider customer identifiers, checkout/session identifiers, and transaction timestamps. Payment-card information is handled by our payment processor and is not intended to be stored directly by Ryva." },
      { label: "Technical Information", body: "We may automatically collect information such as IP address, browser type, device information, operating system, timestamps, session information, pages or features accessed, and error/security logs." },
      { label: "Communications", body: "If you contact us, we may retain your email address, correspondence, support messages, and information you voluntarily provide." }
    ]
  },
  {
    title: "2. How We Use Information",
    paragraphs: [
      "We may use personal information to create and authenticate accounts, provide the Program, maintain learner progress, grade assessments, record Program completion, manage Program entitlements, provide Ryva Pro, process and reconcile payments, prevent duplicate or fraudulent purchases, maintain security, investigate misuse, provide customer support, deliver password-reset and service communications, diagnose errors, maintain and improve reliability, comply with legal obligations, and enforce our Terms."
    ]
  },
  {
    title: "3. Payment Processing",
    paragraphs: [
      "Payments may be processed through Stripe.",
      "Stripe may collect payment and transaction information directly under its own privacy practices and agreements.",
      "Ryva may receive transaction status and identifiers necessary to confirm purchases and manage access."
    ]
  },
  {
    title: "4. How We Disclose Information",
    paragraphs: [
      "We may disclose information to service providers that perform functions on our behalf, such as payment processing, cloud hosting, database infrastructure, authentication, transactional email, application monitoring, and security.",
      "We may also disclose information when required by law, in response to valid legal process, to protect users or Ryva, to investigate fraud or security incidents, or in connection with a merger, financing, acquisition, reorganization, or sale of assets, subject to applicable law."
    ]
  },
  {
    title: "5. We Do Not Own Your Commercial Relationships",
    paragraphs: [
      "Ryva does not acquire ownership of your brand, buyer, retailer, customer, or other commercial relationships because you store information about them in the Services.",
      "Ryva does not claim commissions or revenue from your independent commercial relationships unless you separately enter into a written agreement expressly providing otherwise."
    ]
  },
  {
    title: "6. Sale or Sharing of Personal Information",
    paragraphs: [
      "Ryva does not currently sell personal information for monetary consideration.",
      "If Ryva later adopts advertising, analytics, or tracking practices that trigger statutory definitions of “sale,” “sharing,” or targeted advertising under applicable privacy law, this Privacy Policy and any required opt-out mechanisms will be updated before those practices are introduced."
    ]
  },
  {
    title: "7. Cookies and Similar Technologies",
    paragraphs: [
      "Ryva may use cookies and similar technologies necessary for authentication, session management, security, checkout, and user preferences.",
      "If Ryva later deploys non-essential advertising, cross-site tracking, or optional analytics cookies, appropriate disclosures and consent or opt-out controls will be added where required."
    ]
  },
  {
    title: "8. Data Retention",
    paragraphs: [
      "We retain information for as long as reasonably necessary to provide the Services, maintain Program records, preserve purchases and entitlements, comply with law, resolve disputes, enforce agreements, and maintain security and fraud records.",
      "Different categories of information may have different retention periods.",
      "We may retain certain transaction, security, and legal records after account closure where reasonably necessary."
    ]
  },
  {
    title: "9. Security",
    paragraphs: [
      "Ryva uses reasonable administrative, technical, and organizational measures designed to protect personal information.",
      "However, no Internet-connected service can guarantee absolute security.",
      "You are responsible for protecting your login credentials."
    ]
  },
  {
    title: "10. Third-Party Information Entered by Users",
    paragraphs: [
      "Ryva may allow users to enter information concerning brands, retailers, buyers, customers, and other business contacts.",
      "Users are responsible for determining whether they have a lawful basis or appropriate authority to collect, use, or upload that information.",
      "Ryva should not be used as a method of unlawfully collecting or distributing personal information."
    ]
  },
  {
    title: "11. Your Privacy Choices",
    paragraphs: [
      "Depending on your jurisdiction, you may have rights concerning personal information, potentially including rights to access, correct, delete, obtain a copy, restrict certain uses, object to certain processing, or opt out of certain disclosures.",
      "Rights vary by jurisdiction and may be subject to exceptions.",
      "To submit a privacy request, contact:",
      "support@ryvaforge.com",
      "We may need to verify your identity before completing a request."
    ]
  },
  {
    title: "12. Account Deletion",
    paragraphs: [
      "Users may request account closure by contacting support@ryvaforge.com.",
      "Account deletion may not require deletion of information that Ryva must or may lawfully retain, including payment records, fraud/security records, legal records, and records needed to establish that a Program purchase or completion occurred."
    ]
  },
  {
    title: "13. Children’s Privacy",
    paragraphs: [
      "Ryva is not intended for children under 18.",
      "We do not knowingly offer accounts to children under 18.",
      "If we learn that information was collected from a child contrary to this policy, we will take reasonable steps to address it."
    ]
  },
  {
    title: "14. International Users",
    paragraphs: [
      "Ryva is operated from the United States.",
      "If you access the Services from another country, information may be processed in the United States or other countries where our service providers operate.",
      "Additional rights may apply under local law."
    ]
  },
  {
    title: "15. External Links",
    paragraphs: [
      "The Services may link to external websites.",
      "Ryva is not responsible for the privacy practices of third-party websites."
    ]
  },
  {
    title: "16. Changes to This Privacy Policy",
    paragraphs: [
      "We may update this Privacy Policy from time to time.",
      "If we materially change how personal information is handled, we will provide notice where required."
    ]
  }
];

export function PrivacyPage() {
  return <LegalPage title="Privacy Policy" intro="This Privacy Policy describes how Ryva Forge, LLC, doing business as Ryva (“Ryva,” “we,” “us,” or “our”) collects, uses, discloses, and protects personal information when you use Ryva.">
    <LegalSections sections={privacySections} />
    <section>
      <h2>17. Contact Us</h2>
      <LegalContact />
    </section>
  </LegalPage>;
}

export function RefundPolicyPage() {
  return <LegalPage title="Refund & Cancellation Policy">
    <section>
      <h2>The Ryva Program</h2>
      <p>Purchases of The Ryva Program are final and non-refundable except where required by applicable law.</p>
      <p>Access to digital Program content begins following a successful purchase.</p>
      <p>Ryva does not provide refunds based on change of mind, non-use, partial completion, failure to complete, assessment performance, lack of employment, lack of sales, inability to secure brands, buyers, retailers, customers, orders, commissions, or business opportunities, or dissatisfaction with independent commercial outcomes.</p>
      <p>This policy does not affect rights that cannot legally be waived.</p>
      <p>If you believe you experienced an unauthorized charge, duplicate billing, an incorrect amount, or failure to receive access after a confirmed purchase, contact:</p>
      <p><a href="mailto:support@ryvaforge.com">support@ryvaforge.com</a></p>
    </section>
    <section>
      <h2>Ryva Pro</h2>
      <p>If you purchase a recurring Ryva Pro subscription, you may cancel future renewal using the cancellation method provided in your account or subscription settings.</p>
      <p>Cancellation prevents future renewal but ordinarily does not refund charges already paid, except where required by law or expressly stated otherwise.</p>
    </section>
    <section>
      <h2>Included 30-Day Ryva Pro Access</h2>
      <p>If your Program purchase includes 30 days of Ryva Pro following Program completion, that included access period has no separate cash value and is not redeemable for a refund.</p>
      <p>Failure to use some or all of the included access period does not create a refund right.</p>
    </section>
  </LegalPage>;
}

export function DisclaimerPage() {
  return <LegalPage title="Educational & Commercial Disclaimer">
    <p>Ryva provides education, software, and organizational tools relating to brand placement and commercial activity.</p>
    <p>Ryva does not promise or guarantee employment, income, commissions, clients, brand relationships, buyer responses, retailer placements, orders, reorders, or commercial success.</p>
    <p>The Ryva Program is not certification, licensure, professional qualification, job placement, or employment training that guarantees an occupational outcome.</p>
    <p>Any calculations, examples, financial figures, commission examples, commercial scenarios, or fictional case studies are provided for educational purposes.</p>
    <p>Actual commercial arrangements vary.</p>
    <p>Ryva is not a party to agreements or disputes between users and brands, retailers, buyers, customers, agencies, showrooms, distributors, or other third parties.</p>
    <p>Users remain responsible for independent diligence, commercial decisions, contractual commitments, representations made to third parties, compliance with law, tax obligations, confidentiality obligations, and verifying commercial data.</p>
    <p>Nothing in Ryva constitutes legal, tax, accounting, investment, or other regulated professional advice.</p>
  </LegalPage>;
}
