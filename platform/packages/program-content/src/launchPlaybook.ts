import type {
  ActivityStep,
  ProgramContentBlock,
  ProgramLearningItem,
  ProgramLibraryResource,
  ProgramModule,
  VisualBriefingSlide
} from "./index.js";

const moduleId = "launch-playbook";

function briefing(id: string, title: string, subtitle: string, slides: VisualBriefingSlide[]): ProgramContentBlock {
  return { type: "visual_briefing", id, title, subtitle, slides };
}

function lesson(
  id: string,
  slug: string,
  title: string,
  description: string,
  position: number,
  estimatedMinutes: number,
  blocks: ProgramContentBlock[],
  steps: ActivityStep[]
): ProgramLearningItem {
  return {
    id,
    slug,
    moduleId,
    title,
    description,
    position,
    type: "guided_practice",
    status: "published",
    required: false,
    estimatedMinutes,
    contentVersion: 1,
    progressVersion: 1,
    blocks,
    activity: {
      introduction: "Use the facts provided, make assumptions visible, and save your work as optional guided practice. This activity does not change Program completion.",
      steps
    }
  };
}

const educationalBoundary: ProgramContentBlock = {
  type: "callout",
  title: "Educational scope",
  text: "This lesson provides independent industry education, not legal, tax, licensing, employment, or individualized business advice. Requirements and consequences vary by location and working relationship; a qualified attorney, accountant, or tax professional may be appropriate."
};

const launchPlaybookItems: ProgramLearningItem[] = [
  lesson(
    "launch-1-getting-set-up",
    "getting-set-up-to-represent-brands",
    "Getting Set Up to Represent Brands",
    "Clarify the role, working relationship, professional basics, and minimum setup for responsible exploratory outreach.",
    1,
    22,
    [
      { type: "heading", level: 2, text: "Concept: representation begins with clarity" },
      { type: "paragraph", text: "Brand placement work connects a brand's approved commercial information with retailers that may fit. The representative researches, communicates, organizes follow-up, and supports a relationship within the authority the brand has actually granted. Researching a category or holding an exploratory conversation is different from claiming authority to quote terms, accept orders, or represent a brand." },
      { type: "comparison", columns: [
        { id: "independent-rep", title: "Independent sales representative", body: "Usually represents one or more complementary lines under an agreement and earns compensation defined by that agreement.", points: ["Clarify territory and account ownership", "Clarify commission basis and timing", "Avoid conflicting lines"] },
        { id: "contractor", title: "Independent contractor", body: "A broad working classification that may include sales representation, projects, or services. The written scope and local rules matter.", points: ["Confirm scope and authority", "Understand who pays expenses", "Seek professional advice where appropriate"] },
        { id: "employee", title: "Employee", body: "Works inside the brand's organization under its employment structure, responsibilities, policies, and compensation plan.", points: ["Role is set by the employer", "Internal systems may govern activity", "Do not assume contractor terms apply"] },
        { id: "agency", title: "Agency or showroom", body: "A business may represent a portfolio through a team, showroom, territory, or shared operating system.", points: ["Clarify who owns each relationship", "Confirm line and territory conflicts", "Document handoffs and reporting"] }
      ] },
      { type: "heading", level: 2, text: "Context: the professional minimum" },
      { type: "data_table", caption: "A practical starter setup", columns: ["Element", "Ready enough to begin", "Not required for early research"], rows: [
        ["Identity", "Professional email, accurate LinkedIn profile, short honest introduction", "Invented title, inflated experience, or a large personal brand"],
        ["Focus", "A starting category, geography, or retailer type", "A permanent niche or exclusive territory"],
        ["Organization", "Simple prospect tracker with source, contact, status, and next step", "A complicated CRM"],
        ["Commercial authority", "Clear distinction between exploration and authorized representation", "Permission to quote terms before a brand grants it"],
        ["Business setup", "Awareness that entity, tax, insurance, and registration needs vary", "A one-size-fits-all entity decision from a course"]
      ], note: "A beginner can research, learn, and have truthful exploratory conversations without pretending to hold experience or authority they do not have." },
      briefing("launch-setup-briefing", "From interest to responsible representation", "A five-part readiness check before outreach.", [
        { id: "role", eyebrow: "01 · Role", title: "Describe what you actually do", body: "Use plain language: you research fit, introduce appropriate opportunities, and support commercial follow-through within an agreed scope." },
        { id: "focus", eyebrow: "02 · Focus", title: "Choose a starting lane", points: ["One or two product categories", "A realistic geography", "Retail formats you can research well"] },
        { id: "tools", eyebrow: "03 · Tools", title: "Set up the lightest useful system", flow: [{ label: "Profile", detail: "Accurate professional context" }, { label: "Tracker", detail: "Prospects and next actions" }, { label: "Files", detail: "Approved brand materials" }] },
        { id: "boundary", eyebrow: "04 · Boundary", title: "Separate exploration from authority", body: "Do not promise pricing, exclusivity, placement, delivery, or account ownership before the brand confirms the terms." },
        { id: "decision", eyebrow: "05 · Decision", title: "Ready means honest and organized", body: "You are ready to begin research when you can describe your focus truthfully, track your work, and label what still needs agreement." }
      ]),
      educationalBoundary,
      { type: "callout", title: "Reflection", text: "A professional setup is not performance theater. It is enough structure to communicate accurately, protect context, and follow through." }
    ],
    [{
      id: "starter-profile",
      title: "Build your starter profile",
      context: "You are preparing for exploratory conversations, not claiming current representation.",
      prompt: "Choose a truthful starting focus and draft a two-sentence introduction.",
      fields: [
        { id: "focus", type: "option_selection", label: "Choose the most useful starting focus", required: true, options: [
          { id: "specific", label: "A defined category, geography, and retailer type I can research" },
          { id: "everything", label: "Every product category and every retailer nationally" },
          { id: "title-only", label: "A senior-sounding title without a defined focus" }
        ] },
        { id: "introduction", type: "written_response", label: "Your accurate two-sentence introduction", required: true, maxLength: 600 }
      ],
      considerations: ["State what you are exploring, not authority you do not yet have.", "Name a useful focus without presenting it as permanent.", "Keep the introduction easy for another person to understand and forward."],
      required: true
    }]
  ),
  lesson(
    "launch-2-finding-brands",
    "finding-brands-to-work-with",
    "Finding Brands to Work With",
    "Build a multi-channel brand pipeline and evaluate visible signs of wholesale readiness before reaching out.",
    2,
    24,
    [
      { type: "heading", level: 2, text: "Concept: sourcing is broader than social media" },
      { type: "paragraph", text: "A good sourcing process combines discovery channels. Instagram may reveal brand voice, LinkedIn may reveal people and growth priorities, Google and brand websites may show stockists and wholesale contact paths, and trade shows, directories, local markets, referrals, and competitor stockist pages may reveal brands already operating in wholesale. No single channel proves commercial readiness." },
      { type: "list", items: [
        "Search Instagram, LinkedIn, Google, brand websites, wholesale marketplaces, and industry directories with category and geography terms.",
        "Walk relevant shopping districts, attend appropriate trade shows, and notice local or emerging brands with coherent product lines.",
        "Study DTC and specialty brands for wholesale signals such as stockists, case packs, retailer inquiries, or trade materials.",
        "Use referrals and networking carefully: a warm introduction creates context, not an entitlement to a response.",
        "Review retailer stockist pages and competitor assortments to find adjacent brands and identify territory or category gaps."
      ] },
      { type: "heading", level: 2, text: "Context: visible readiness signals" },
      { type: "data_table", caption: "Brand Readiness Scorecard", columns: ["Criterion", "Stronger visible signal", "Question to verify"], rows: [
        ["Assortment", "Clear products, SKUs, variants, and roles", "Which products are current and wholesale-available?"],
        ["Pricing and margin", "Coherent MSRP and a wholesale price structure", "Are price, margin, and promotional expectations workable?"],
        ["Minimums", "Opening minimum, reorder minimum, and case packs are documented", "What is negotiable, if anything, and by whom?"],
        ["Operations", "Lead times, inventory, fulfillment, and shipping are explainable", "What happens when stock or timing changes?"],
        ["Assets", "Usable images, product details, and retailer-facing materials exist", "Which materials are approved for buyer use?"],
        ["Retail evidence", "Current accounts or a credible wholesale plan", "Which accounts, channels, or territories are excluded?"],
        ["Contact process", "A person or workflow owns wholesale inquiries", "Who approves accounts, terms, and orders?"],
        ["Fit and gaps", "A plausible retailer customer and open opportunity", "Where does the brand want growth—and why?" ]
      ], note: "Score only what evidence supports. A beautiful website is not proof of wholesale economics or fulfillment capacity." },
      briefing("launch-brand-sourcing-briefing", "A repeatable sourcing loop", "Move from discovery to evidence before outreach.", [
        { id: "discover", title: "Discover broadly", points: ["Search", "Social", "Directories", "Trade events", "Retail observation", "Referrals"] },
        { id: "capture", title: "Capture the source", body: "Record where the brand was found, the date, and the visible signal that made it relevant." },
        { id: "screen", title: "Screen for readiness", body: "Review assortment, pricing signals, operations, assets, wholesale presence, and likely fit." },
        { id: "questions", title: "Convert gaps into questions", body: "Unknown does not mean unready. It means the point must be verified before a recommendation." },
        { id: "prioritize", title: "Prioritize evidence and fit", body: "Reach out first where credible readiness and a specific commercial reason overlap." }
      ]),
      { type: "callout", title: "Decision rule", text: "A brand can be worth an exploratory conversation without being fully ready. The decision is whether the visible opportunity is strong enough to justify verifying the missing commercial facts." },
      { type: "callout", title: "Reflection", text: "The useful question is not ‘Do I like this brand?’ It is ‘What evidence suggests this brand could serve a retailer well, and what must I still verify?’" }
    ],
    [{
      id: "readiness-score",
      title: "Score a fictional brand",
      context: "Morrow Field makes five premium pantry products. Its website lists MSRP and three stockists but shows no wholesale pricing, minimum, lead time, or retailer contact. Product photography is strong and recent posts show packed retailer cartons.",
      prompt: "Score the visible evidence from 1–5, then identify the most important verification question.",
      fields: [
        { id: "score", type: "score_matrix", label: "Brand readiness evidence", required: true, maxScore: 5, rows: [
          { id: "assortment", label: "Assortment clarity" }, { id: "pricing", label: "Wholesale pricing readiness" }, { id: "operations", label: "Operational readiness" }, { id: "assets", label: "Retailer-facing assets" }, { id: "fit", label: "Potential retail fit" }
        ] },
        { id: "question", type: "written_response", label: "The first missing fact you would verify, and why", required: true, maxLength: 500 }
      ],
      considerations: ["Visible stockists are evidence of some wholesale activity, not proof of current terms or capacity.", "Do not award strong wholesale pricing or operational scores when the information is unknown.", "Prioritize a question that could materially change whether outreach is worthwhile."],
      required: true
    }]
  ),
  lesson(
    "launch-3-brand-outreach",
    "how-to-reach-out-to-brands",
    "How to Reach Out to Brands",
    "Choose the right outreach channel, make a credible first approach, and follow up without manufacturing urgency.",
    3,
    25,
    [
      { type: "heading", level: 2, text: "Concept: channel follows context" },
      { type: "paragraph", text: "Email is useful when you have the wholesale contact and need room for context. LinkedIn can work when a relevant person is identifiable. Instagram DMs and contact forms are best kept short and used to find the right owner. A phone call can clarify routing. Trade shows, networking, and referrals create situational context but still require a clear reason for the conversation." },
      { type: "data_table", caption: "Choosing a first channel", columns: ["Channel", "Best use", "Watch for"], rows: [
        ["Email", "Specific, professional introduction to a known wholesale contact", "Long biographies, attachments without permission, vague asks"],
        ["LinkedIn", "Relevant person is visible and the message can be contextual", "Connection spam or implying a relationship that does not exist"],
        ["Instagram DM", "Small founder-led brand is active and no wholesale route is visible", "Trying to conduct the full commercial conversation in DMs"],
        ["Website form", "The brand directs inquiries there", "Losing your own record of what was sent"],
        ["Phone", "Routing question or small business with a public business line", "Pressuring whoever answers or pitching consumers"],
        ["In person / trade show", "The setting welcomes commercial discovery", "Monopolizing booth time or demanding decisions on the spot"],
        ["Referral", "A real mutual contact can add accurate context", "Name-dropping without permission"]
      ] },
      { type: "heading", level: 2, text: "Context: a useful first touch" },
      { type: "list", items: ["Name the specific reason the brand caught your attention.", "Introduce your focus honestly without overstating experience, reach, or retailer relationships.", "Explain brand placement in plain commercial language if the recipient may not use the term.", "Ask whether the company works with independent representatives or who owns wholesale conversations.", "Make one low-friction next request: the right contact, a short exploratory call, or permission to send context.", "Keep approved follow-up measured. Two useful follow-ups are usually more professional than an endless sequence."] },
      briefing("launch-brand-outreach-briefing", "Anatomy of a credible first touch", "Five parts that work across channels.", [
        { id: "relevance", title: "1. Relevance", body: "Show why this brand and this moment are relevant; avoid generic praise." },
        { id: "identity", title: "2. Accurate identity", body: "State your focus and stage truthfully. Do not invent clients, retailer access, or results." },
        { id: "commercial", title: "3. Commercial reason", body: "Connect the product to a retailer type, territory question, or wholesale opportunity worth exploring." },
        { id: "ask", title: "4. One clear ask", body: "Ask who owns wholesale or whether a short exploratory conversation is appropriate." },
        { id: "follow-up", title: "5. Respectful follow-up", flow: [{ label: "First touch", detail: "Specific and brief" }, { label: "Follow-up 1", detail: "Add useful context" }, { label: "Follow-up 2", detail: "Close the loop" }, { label: "Stop", detail: "Unless new relevance emerges" }] }
      ]),
      { type: "callout", title: "Common mistake", text: "Do not lead with a promise that you can place the brand in named retailers. A credible first touch opens a factual conversation; it does not guarantee representation, orders, income, or placement." },
      { type: "callout", title: "Reflection", text: "Strong outreach makes it easy for the recipient to understand relevance, assess the request, and route it to the correct person." }
    ],
    [{
      id: "choose-channel",
      title: "Choose the channel",
      context: "A founder-led skincare brand posts daily on Instagram. Its site has a general contact form but no wholesale page. LinkedIn shows the founder but no sales employee.",
      prompt: "Select the strongest first approach and draft it without overstating your experience.",
      fields: [
        { id: "channel", type: "option_selection", label: "Best first approach", required: true, options: [
          { id: "short-dm", label: "A short Instagram DM asking who handles wholesale, followed by email if invited" },
          { id: "mass", label: "The same long pitch sent to every visible channel at once" },
          { id: "claim", label: "A message claiming retailer commitments to get a response" }
        ] },
        { id: "message", type: "written_response", label: "Draft the first message", required: true, maxLength: 900 }
      ],
      considerations: ["Use the channel the brand visibly attends to.", "Keep the DM short enough to route rather than conduct the whole sales conversation.", "Include relevance, accurate identity, and one clear ask."],
      required: true
    }]
  ),
  lesson(
    "launch-4-first-brand-conversation",
    "the-first-brand-conversation",
    "The First Brand Conversation",
    "Use an exploratory call to understand wholesale reality, decision authority, representation needs, and unresolved risk.",
    4,
    28,
    [
      { type: "heading", level: 2, text: "Concept: diagnose before proposing" },
      { type: "paragraph", text: "The first brand conversation is not a race to secure an agreement. It is a mutual fact-finding conversation. Your job is to understand the brand's current wholesale business, operational readiness, goals, boundaries, and decision process well enough to decide whether a next conversation makes sense." },
      { type: "data_table", caption: "First Brand Conversation Checklist", columns: ["Area", "Questions to ask", "Why it matters"], rows: [
        ["Wholesale today", "Where do you sell wholesale? Which retailers, channels, and regions are active?", "Establishes evidence, overlap, and the starting point."],
        ["Representation", "Do you have reps, agencies, distributors, or open territories?", "Prevents conflict and clarifies the actual opportunity."],
        ["Retail target", "What does an ideal retailer look like? Which regions or account types matter now?", "Turns a broad growth wish into a fit hypothesis."],
        ["Economics", "What are wholesale price, MSRP, MOQ, case packs, terms, and freight expectations?", "Tests feasibility for the retailer and brand."],
        ["Operations", "What are inventory levels, lead times, fulfillment process, seasonal calendars, and availability constraints?", "A sale cannot be separated from the ability to fulfill it."],
        ["Policies", "How are samples, returns, cancellations, damages, and credits handled?", "Sets expectations before buyer conversations."],
        ["Orders", "Who approves accounts, receives orders, confirms them, and communicates changes?", "Clarifies authority and handoff."],
        ["Accounts", "Are there house accounts, exclusions, protected accounts, or ownership rules?", "Avoids disputes over outreach and commission."],
        ["Continuity", "Who supports buyers, reorders, reporting, and product updates?", "Defines work after an opening order."],
        ["Compensation", "How is commission structured, earned, reported, and paid? Which expenses are covered?", "Tests whether the working relationship is understandable." ]
      ] },
      briefing("launch-first-call-briefing", "A 30-minute exploratory conversation", "A structure that leaves room for listening.", [
        { id: "open", title: "Open · 3 minutes", body: "Confirm time, purpose, and what each person hopes to learn." },
        { id: "story", title: "Brand context · 7 minutes", body: "Listen for product, customer, wholesale history, priorities, and current constraints." },
        { id: "commercial", title: "Commercial system · 12 minutes", body: "Explore assortment, economics, operations, accounts, communication, and representation." },
        { id: "fit", title: "Mutual fit · 5 minutes", body: "Name what appears aligned, what is unknown, and any conflict or boundary." },
        { id: "close", title: "Close · 3 minutes", body: "Agree on documents, owners, and a dated next step—or respectfully decide not to advance." }
      ]),
      { type: "callout", title: "Decision point", text: "A positive conversation is not yet authorization to represent the brand. The next step may be document review, another stakeholder conversation, a defined trial, agreement review, or no further action." },
      { type: "callout", title: "Reflection", text: "The best first conversation improves both sides' understanding. It does not conceal missing information to keep momentum." }
    ],
    [{
      id: "call-priorities",
      title: "Prioritize the next questions",
      context: "The founder says the brand wants specialty retail growth. Pricing is ready, but lead times vary, two regions already have reps, and no one has explained house accounts or reorder commission.",
      prompt: "Select the issues that must be clarified before discussing a representation arrangement, then write a neutral closing summary.",
      fields: [
        { id: "issues", type: "multi_select", label: "Priority issues", required: true, minSelections: 4, maxSelections: 6, options: [
          { id: "territory", label: "Open territories and existing rep boundaries" },
          { id: "lead-time", label: "Current lead-time and availability process" },
          { id: "house", label: "House accounts and account ownership" },
          { id: "reorders", label: "Reorder commission treatment" },
          { id: "approvals", label: "Who approves accounts and terms" },
          { id: "logo", label: "Whether you personally prefer the logo" }
        ] },
        { id: "summary", type: "written_response", label: "Your closing summary and next step", required: true, maxLength: 800 }
      ],
      considerations: ["Operational uncertainty can affect promises made to retailers.", "Existing rep territories and account rules must be known before outreach.", "End with owners and a specific next step, not assumed authorization."],
      required: true
    }]
  ),
  lesson(
    "launch-5-commission-structures",
    "commission-structures-and-getting-paid",
    "Commission Structures and Getting Paid",
    "Understand common compensation models and ask precise questions about how commission is earned, calculated, and paid.",
    5,
    26,
    [
      { type: "heading", level: 2, text: "Concept: the percentage is only one term" },
      { type: "paragraph", text: "Compensation can be a percentage commission, flat fee, retainer plus commission, territory-based arrangement, opening-order commission, reorder commission, or another agreed model. Even when a percentage is stated, the basis may be booked, invoiced, shipped, collected, or adjusted revenue. There is no single universal rate or structure for every category and relationship." },
      { type: "data_table", caption: "Common compensation structures", columns: ["Structure", "What it can mean", "Questions to resolve"], rows: [
        ["Percentage commission", "An agreed percentage of a defined commissionable amount", "Percentage of what, and at which event?"],
        ["Flat fee", "Fixed compensation for a defined scope or deliverable", "What work, time period, and expenses are included?"],
        ["Retainer + commission", "Base compensation plus performance-linked compensation", "What does each component cover?"],
        ["Territory commission", "Compensation tied to eligible sales within a defined territory", "What accounts and channels are excluded?"],
        ["Opening vs. reorder", "Different eligibility or rates for first and later orders", "Who supports the account and for how long?"],
        ["Collected revenue", "Commission after the brand receives payment", "How are aging, partial payments, credits, and bad debt reported?"],
        ["House or split accounts", "Excluded accounts or shared compensation", "Which named accounts, split formula, and ownership rules apply?"],
        ["Returns and chargebacks", "Adjustments may reduce a later commission", "Which events qualify and how are disputes documented?" ]
      ] },
      { type: "callout", title: "Professional language", text: "Ask: ‘How is commission structured for independent sales representatives?’ Then clarify the percentage or fee, commission basis, earning event, payment timing, reorders, house accounts, cancellations, returns, reporting, expenses, and post-termination orders." },
      briefing("launch-commission-briefing", "Follow the money through the order", "The same percentage can produce different timing and risk.", [
        { id: "booked", title: "Booked", body: "The buyer submits an order. It may still change or cancel." },
        { id: "invoiced", title: "Invoiced", body: "The brand issues an invoice, but product and payment status may differ." },
        { id: "shipped", title: "Shipped", body: "The brand fulfills the order, sometimes partially." },
        { id: "collected", title: "Collected", body: "The brand receives the retailer's payment." },
        { id: "adjusted", title: "Adjusted", body: "Returns, credits, cancellations, chargebacks, or splits may affect the commissionable base." }
      ]),
      educationalBoundary,
      { type: "callout", title: "Reflection", text: "A clear compensation conversation names the calculation, timing, exceptions, evidence, and responsibilities—not only the headline rate." }
    ],
    [{
      id: "commission-review",
      title: "Review an incomplete offer",
      context: "A brand offers ‘12% commission on sales, paid monthly.’ It has current house accounts, expects the rep to support reorders, and allows returns, but the proposal defines none of those terms.",
      prompt: "Identify what is missing and draft three professional follow-up questions.",
      fields: [
        { id: "missing", type: "multi_select", label: "Missing commission terms", required: true, minSelections: 5, options: [
          { id: "basis", label: "Commission basis: booked, invoiced, shipped, collected, or adjusted" },
          { id: "timing", label: "Payment date and reporting cycle" },
          { id: "reorders", label: "Reorder eligibility" },
          { id: "house", label: "House-account exclusions" },
          { id: "returns", label: "Returns, credits, and chargebacks" },
          { id: "termination", label: "Eligible post-termination orders" },
          { id: "font", label: "The font used on the proposal" }
        ] },
        { id: "questions", type: "written_response", label: "Three neutral follow-up questions", required: true, maxLength: 900 }
      ],
      considerations: ["‘Sales’ is not a sufficiently precise commission base.", "Ongoing account work should be considered alongside reorder eligibility.", "Clear questions are not adversarial; they reduce future ambiguity."],
      required: true
    }]
  ),
  lesson(
    "launch-6-brand-documents",
    "documents-to-request-from-a-brand",
    "Documents to Request From a Brand",
    "Assemble the approved commercial information needed to present products accurately and route orders responsibly.",
    6,
    24,
    [
      { type: "heading", level: 2, text: "Concept: documents turn claims into usable facts" },
      { type: "paragraph", text: "A representative needs current, brand-approved information. The goal is not to collect files for their own sake; it is to ensure that product, pricing, ordering, fulfillment, policy, account, and brand-use information can be communicated consistently." },
      { type: "data_table", caption: "Brand Document Request Checklist", columns: ["Document or information", "How it is used", "Verify"], rows: [
        ["Line sheet and wholesale price list", "Presents products, SKUs, prices, minimums, and order facts", "Effective date and current availability"],
        ["Product catalog and specifications", "Explains product use, variants, materials, dimensions, or claims", "Approved language and required disclosures"],
        ["Order form or ordering instructions", "Routes a buyer's order into the brand's system", "Approvals, contacts, and confirmation process"],
        ["Wholesale terms", "Sets payment, minimum, freight, cancellation, and other expectations", "Which terms can be changed, and by whom"],
        ["MOQ, case packs, lead times", "Tests order feasibility", "Opening vs. reorder and current exceptions"],
        ["Shipping and returns policies", "Prevents unsupported promises", "Damages, credits, return authorization, and freight"],
        ["Images and brand assets", "Supports retailer review with approved materials", "Usage permissions and latest files"],
        ["Retailer-facing deck", "Gives concise brand, assortment, customer, and proof context", "Claims are current and approved"],
        ["Territory and account exclusions", "Prevents overlapping outreach", "Named accounts, channels, and ownership rules"],
        ["Existing account list where appropriate", "Identifies conflicts and continuity", "Access, confidentiality, and update process"],
        ["Sales-rep agreement", "Defines the working relationship", "Signed version and amendments"],
        ["Tax and payment forms where applicable", "Supports lawful payment administration", "Request through an appropriate secure process" ]
      ] },
      { type: "heading", level: 2, text: "Context: when the brand does not have everything" },
      { type: "paragraph", text: "Missing materials are information, not an invitation for the representative to invent commercial or legal policy. Name the missing decision, explain the buyer-facing consequence, ask who owns the answer, and document the approved response. You may help organize brand-supplied facts, but the brand should authorize its pricing, terms, claims, policies, and assets." },
      briefing("launch-documents-briefing", "From brand file to buyer-ready fact", "A controlled information path.", [
        { id: "request", title: "Request", body: "Ask for the current approved source and owner." },
        { id: "verify", title: "Verify", points: ["Version", "Effective date", "Completeness", "Authority", "Usage rights"] },
        { id: "organize", title: "Organize", body: "Label files consistently and preserve their source." },
        { id: "use", title: "Use", body: "Present only the facts relevant to the retailer and current opportunity." },
        { id: "refresh", title: "Refresh", body: "Confirm changes before follow-up, ordering, or seasonal selling." }
      ]),
      { type: "callout", title: "Reflection", text: "Document readiness protects the buyer, the brand, and the representative from decisions based on stale or invented information." }
    ],
    [{
      id: "missing-documents",
      title: "Identify the missing sales facts",
      context: "A brand sends a beautiful catalog and product images. It has not provided wholesale prices, case packs, lead times, terms, order routing, or a returns policy.",
      prompt: "Select the missing information that blocks responsible buyer outreach and write a concise request to the brand.",
      fields: [
        { id: "gaps", type: "multi_select", label: "Blocking gaps", required: true, minSelections: 5, options: [
          { id: "prices", label: "Wholesale price list" }, { id: "case-packs", label: "MOQs and case packs" }, { id: "lead-times", label: "Lead times and availability" }, { id: "terms", label: "Wholesale and payment terms" }, { id: "routing", label: "Order routing and approval" }, { id: "returns", label: "Returns, damages, and credit policy" }, { id: "new-logo", label: "A new logo designed by the representative" }
        ] },
        { id: "request", type: "written_response", label: "Your document request", required: true, maxLength: 900 }
      ],
      considerations: ["The existing files support presentation but not an order decision.", "Explain why each requested fact matters instead of demanding a generic packet.", "Ask the brand to approve missing policies; do not create them on its behalf."],
      required: true
    }]
  ),
  lesson(
    "launch-7-agreement-review",
    "agreements-contracts-and-protecting-the-relationship",
    "Agreements, Contracts, and Protecting the Relationship",
    "Recognize common agreement terms, identify ambiguity, and prepare questions for appropriate professional review.",
    7,
    28,
    [
      { type: "heading", level: 2, text: "Concept: an agreement should match the operating reality" },
      { type: "paragraph", text: "A sales-rep or independent-contractor agreement often governs compensation, scope, territory, accounts, information, termination, and dispute handling. Reading for clarity is different from reaching a legal conclusion. The practical task is to compare the written terms with how both sides expect the relationship to work and flag questions for the appropriate decision-maker or professional adviser." },
      { type: "data_table", caption: "Rep Agreement Review Checklist", columns: ["Term", "Question to ask", "Operational consequence"], rows: [
        ["Commission", "What is the rate, basis, earning event, report, and payment timing?", "Determines how compensation can be verified."],
        ["Territory and exclusivity", "What geography, channel, category, and conflict rules apply?", "Defines where outreach is permitted."],
        ["House accounts and ownership", "Which accounts are excluded, protected, shared, or newly credited?", "Prevents duplicate contact and commission disputes."],
        ["Reorders", "Which repeat orders remain eligible, for how long, and with what support duties?", "Connects ongoing work with compensation."],
        ["Term, termination, notice", "How long does the agreement last and how can either side end it?", "Sets the transition process."],
        ["Post-termination orders", "What happens to pending, shipped, collected, and later reorder activity?", "Clarifies tail-period expectations."],
        ["Expenses", "Which expenses require approval and who pays them?", "Avoids unplanned cost assumptions."],
        ["Returns and chargebacks", "When can commission be reversed and what evidence is provided?", "Defines adjustment risk."],
        ["Confidentiality", "What information is protected and for how long?", "Affects records, sharing, and retention."],
        ["Non-solicitation / non-compete", "What conduct, parties, time, and geography does the clause cover?", "May have significant legal and work consequences."],
        ["IP and brand use", "Which names, images, files, and claims may be used?", "Controls how the brand is presented."],
        ["Governing law / disputes", "Which law, venue, process, fees, or arbitration terms apply?", "Affects how disagreements are handled."],
        ["Independent contractor language", "Do the written responsibilities and administration match the intended relationship?", "May have legal and tax consequences requiring professional advice." ]
      ] },
      briefing("launch-agreement-briefing", "Read agreements in four passes", "A practical review process, not legal advice.", [
        { id: "scope", title: "Pass 1 · Scope", body: "What work, authority, territory, channel, accounts, and exclusions are actually covered?" },
        { id: "money", title: "Pass 2 · Money", body: "How is compensation calculated, earned, reported, adjusted, and paid?" },
        { id: "lifecycle", title: "Pass 3 · Lifecycle", body: "What happens at start, renewal, termination, and after termination?" },
        { id: "risk", title: "Pass 4 · Risk and restrictions", body: "Review confidentiality, expenses, IP, restrictive covenants, liability, law, and disputes." },
        { id: "questions", title: "Turn ambiguity into written questions", body: "Do not fill gaps with assumptions. Ask, document the answer, and seek qualified review when appropriate." }
      ]),
      educationalBoundary,
      { type: "callout", title: "Important", text: "The Rep Agreement Review Checklist is an educational issue-spotting tool. It is not a substitute for legal review, and it does not determine whether a term is enforceable, advisable, or appropriate for you." },
      { type: "callout", title: "Reflection", text: "Clarity protects a relationship better than optimism about how an undefined term will work later." }
    ],
    [{
      id: "spot-ambiguity",
      title: "Spot the unclear terms",
      context: "A draft says: ‘Rep receives 10% on territory sales. Brand may terminate at any time. Existing accounts excluded.’ It does not define territory, sales, payment timing, existing accounts, reorders, or post-termination orders.",
      prompt: "Identify the ambiguities and prepare questions—not legal conclusions.",
      fields: [
        { id: "ambiguities", type: "multi_select", label: "Terms needing clarification", required: true, minSelections: 5, options: [
          { id: "territory", label: "Territory boundaries and channels" }, { id: "sales", label: "Commissionable sales and earning event" }, { id: "payment", label: "Reporting and payment timing" }, { id: "accounts", label: "Named existing or house accounts" }, { id: "reorders", label: "Reorder treatment" }, { id: "post-term", label: "Pending and post-termination orders" }, { id: "paper", label: "Paper color" }
        ] },
        { id: "questions", type: "written_response", label: "Questions you would ask before signing", required: true, maxLength: 1100 }
      ],
      considerations: ["Do not assume ordinary-language meanings match the agreement's intended definitions.", "Separate commercial clarification from legal advice.", "Restrictive, tax, classification, and dispute terms may warrant qualified professional review."],
      required: true
    }]
  ),
  lesson(
    "launch-8-finding-retailers",
    "finding-retailers-and-buyer-opportunities",
    "Finding Retailers and Buyer Opportunities",
    "Source potential accounts through multiple channels and assess commercial fit before outreach.",
    8,
    24,
    [
      { type: "heading", level: 2, text: "Concept: a prospect list should begin with fit" },
      { type: "paragraph", text: "Retail accounts can be found through Google Maps and Search, Instagram, retailer and competitor websites, LinkedIn, shopping districts, stockist and ‘where to buy’ pages, trade shows, directories, boutique associations, local market research, and referrals. The purpose is not to collect the largest list. It is to build a reasoned list of accounts where the product, customer, economics, and timing may align." },
      { type: "data_table", caption: "Retail Account Fit Scorecard", columns: ["Dimension", "Evidence to collect", "Fit question"], rows: [
        ["Assortment", "Categories, adjacent products, gaps, depth", "Does this product add something useful rather than duplicate without purpose?"],
        ["Price point", "Visible opening, core, and premium prices", "Can the product sit credibly inside the retailer's price architecture?"],
        ["Customer", "Brand voice, neighborhood, reviews, merchandising", "Is the likely customer problem or desire aligned?"],
        ["Geography", "Locations, shipping reach, tourism, local needs", "Does location affect seasonality, demand, or territory?"],
        ["Brand mix", "Aesthetic, values, scale, established/emerging balance", "Would the brand be coherent and differentiated here?"],
        ["Category", "Space, cadence, breadth, specialist knowledge", "Does the retailer actively support this category?"],
        ["Positioning", "Service model, channel, format, experience", "Does the proposed placement fit how the store sells?"],
        ["Demand evidence", "Comparable movement, requests, reviews, local signals", "What suggests interest without pretending demand is guaranteed?" ]
      ] },
      briefing("launch-retailer-sourcing-briefing", "Build a retailer hypothesis", "Research creates a reason to contact—not proof of an order.", [
        { id: "source", title: "Source", points: ["Maps", "Search", "Social", "Directories", "Stockists", "Street research", "Events", "Referrals"] },
        { id: "observe", title: "Observe", body: "Capture current assortment, price, customer, category, geography, and positioning evidence." },
        { id: "compare", title: "Compare", body: "Place the brand next to the retailer context. Note both alignment and tension." },
        { id: "hypothesis", title: "Form a hypothesis", body: "Write one sentence explaining why the product might belong and what must be verified." },
        { id: "prioritize", title: "Prioritize", body: "Use fit, readiness, timing, authority, and effort—not attractiveness alone." }
      ]),
      { type: "callout", title: "Reflection", text: "Research should make outreach more specific. If the same message could be sent to any retailer, the fit work is probably incomplete." }
    ],
    [{
      id: "retailer-fit",
      title: "Compare three accounts",
      context: "A brand sells design-led reusable lunch containers at $42 MSRP. It has strong product education, reliable inventory, and a compact display. Consider: a premium kitchen store with $30–$120 tools; a discount variety store centered below $15; and a design museum shop with functional gifts at $25–$85.",
      prompt: "Score the strongest account and explain the evidence and uncertainty.",
      fields: [
        { id: "account", type: "option_selection", label: "Strongest starting hypothesis", required: true, options: [
          { id: "kitchen", label: "Premium kitchen store" }, { id: "discount", label: "Discount variety store" }, { id: "museum", label: "Design museum shop" }
        ] },
        { id: "reasoning", type: "written_response", label: "Fit evidence, tension, and one question to verify", required: true, maxLength: 900 }
      ],
      considerations: ["More than one account can be plausible for different reasons.", "The discount store has a clear price-architecture tension.", "Distinguish a reasoned hypothesis from guaranteed consumer demand."],
      required: true
    }]
  ),
  lesson(
    "launch-9-finding-buyers",
    "finding-the-right-buyer-contact",
    "Finding the Right Buyer Contact",
    "Identify and verify the person who owns the relevant assortment decision instead of messaging blindly.",
    9,
    20,
    [
      { type: "heading", level: 2, text: "Concept: title and responsibility are not always the same" },
      { type: "paragraph", text: "The relevant contact may be an owner, founder, buyer, category buyer, merchandise manager, wholesale or buying inbox, or—especially in a smaller store—a manager who can route the inquiry. The goal is to verify who evaluates the category, not to collect the most senior name." },
      { type: "data_table", caption: "Contact verification methods", columns: ["Method", "What to look for", "How to verify"], rows: [
        ["Retailer website", "Team, contact, vendor, buying, or category pages", "Confirm the page is current and category-specific"],
        ["LinkedIn", "Current role, tenure, category responsibility", "Compare title with company and recent activity"],
        ["Google", "Interviews, trade coverage, event listings", "Check dates and primary sources"],
        ["Instagram", "Owner-led activity, tagged staff, category posts", "Use it as a clue, not proof of buying authority"],
        ["Phone", "A routing question to the public business line", "Ask who reviews the category and preferred submission method"],
        ["Store visit", "How the location operates and when staff can help", "Avoid interrupting service; ask for process, not a decision"],
        ["Trade show / referral", "A relevant introduction in context", "Confirm current responsibility and permission to follow up" ]
      ] },
      briefing("launch-contact-briefing", "A verified contact chain", "Use more than one weak clue when possible.", [
        { id: "role", title: "Name the decision", body: "Which category, account, location, or assortment decision needs an owner?" },
        { id: "candidate", title: "Find a candidate", body: "Use the retailer's own site first, then reputable professional and public sources." },
        { id: "cross-check", title: "Cross-check", body: "Confirm company, recency, title, category, and preferred route." },
        { id: "route", title: "Ask for routing", body: "A concise phone call or general inbox can verify the correct process without a full pitch." },
        { id: "record", title: "Record confidence", body: "Label contacts verified, probable, or unverified and note the source and date." }
      ]),
      { type: "callout", title: "Reflection", text: "Accurate routing is part of respectful outreach. A generic inbox may be the correct process; a named executive may be the wrong buyer." }
    ],
    [{
      id: "verify-contact",
      title: "Choose the next verification step",
      context: "A retailer website lists only hello@. LinkedIn shows a founder and a merchandise manager, but the manager's profile has not been updated in two years. Recent Instagram posts tag a store manager.",
      prompt: "Choose the strongest next step before sending the product pitch.",
      fields: [{ id: "step", type: "option_selection", label: "Next step", required: true, options: [
        { id: "routing", label: "Call or email the public channel to ask who reviews the category and the preferred submission method" },
        { id: "blast", label: "Send the same pitch to all three people and the general inbox" },
        { id: "founder", label: "Assume the founder personally buys every category" }
      ] }],
      considerations: ["The merchandise-manager clue may be stale.", "The store manager may help route but may not own assortment.", "Verification reduces duplicate outreach and respects the retailer's process."],
      required: true
    }]
  ),
  lesson(
    "launch-10-buyer-outreach",
    "reaching-out-to-retail-buyers",
    "Reaching Out to Retail Buyers",
    "Match the channel and message to a specific retailer, product fit hypothesis, and next commercial objective.",
    10,
    26,
    [
      { type: "heading", level: 2, text: "Concept: the ask changes with the stage" },
      { type: "paragraph", text: "Buyer outreach can happen by email, phone, LinkedIn, Instagram, in person, at a trade show, or through a referral. The best route respects the retailer's stated process and the goal of the touch. An introduction, appointment request, line-sheet review, sample review, opening-order conversation, and reorder follow-up are different asks." },
      { type: "data_table", caption: "Match message to objective", columns: ["Objective", "Useful content", "Clear next ask"], rows: [
        ["Introduction", "Why this brand may be relevant to this account", "May I send the current line sheet?"],
        ["Appointment", "Specific category or seasonal reason and concise relevant context", "Would a 15-minute review on either date work?"],
        ["Line-sheet review", "Assortment, price range, minimum, availability", "Which products or questions merit a closer look?"],
        ["Sample review", "What the samples demonstrate and approved handling", "Where and when should samples be reviewed?"],
        ["Opening order", "Confirmed selection, quantities, terms, timing, and routing", "May I prepare or route the order for approval?"],
        ["Reorder", "Account-specific inventory or timing signal", "Would replenishment or an assortment adjustment be useful?" ]
      ] },
      { type: "heading", level: 2, text: "Context: concise buyer outreach" },
      { type: "list", items: ["Lead with the retailer-specific reason, not a generic brand biography.", "Name the product category, useful distinction, relevant price range, and availability only when confirmed.", "Use attachments or links according to the retailer's process; do not flood an inbox.", "On the phone, ask whether it is a workable moment and keep the routing or opening question brief.", "In person, respect service time and never force a buying conversation on the sales floor.", "Follow up when you can add clarity, updated availability, a relevant seasonal reason, or a clean close-the-loop message—not merely ‘bumping this.’"] },
      briefing("launch-buyer-outreach-briefing", "One account, one reason, one next step", "A buyer should not have to reverse-engineer the purpose.", [
        { id: "account", title: "Account context", body: "Show you understand the retailer's customer, assortment, and category." },
        { id: "product", title: "Product relevance", body: "Name the useful product distinction without unsupported claims." },
        { id: "facts", title: "Commercial facts", body: "Use current price, minimum, timing, and availability when they matter to the ask." },
        { id: "ask", title: "Stage-appropriate ask", body: "Ask for the next reasonable review, not an instant order." },
        { id: "follow", title: "Follow-through", body: "Record the response, respect ‘no,’ and set only a justified next action." }
      ]),
      { type: "callout", title: "No mass-spam playbook", text: "Specific, lower-volume outreach is the standard here. Do not scrape private data, manufacture referrals, conceal bulk sending, or send repeated unwanted messages." },
      { type: "callout", title: "Reflection", text: "A buyer message earns attention by reducing the work needed to understand fit and decide on the next review step." }
    ],
    [{
      id: "buyer-email",
      title: "Write a fit-led buyer introduction",
      context: "Canopy Home is a two-location design store with functional kitchen goods at $30–$120. Morrow Field offers five design-led pantry tools at $38–$68 MSRP, a $350 opening minimum, six-week availability, and approved line-sheet assets.",
      prompt: "Draft a concise introduction that seeks a line-sheet review rather than promising an order.",
      fields: [{ id: "email", type: "written_response", label: "Buyer introduction email", required: true, maxLength: 1200 }],
      considerations: ["Name why the assortment and price architecture appear relevant.", "Include only confirmed commercial facts.", "End with one low-friction request for review."],
      required: true
    }]
  ),
  lesson(
    "launch-11-prospecting-system",
    "building-a-simple-prospecting-system",
    "Building a Simple Prospecting System",
    "Create a lightweight operating rhythm for brand prospects, retail prospects, follow-up, and next actions.",
    11,
    22,
    [
      { type: "heading", level: 2, text: "Concept: the tracker should answer what happens next" },
      { type: "paragraph", text: "A beginner does not need a complex CRM. A useful prospect tracker preserves source, contact, context, dates, status, notes, territory, account ownership, and the next dated action. It should prevent duplicate outreach and forgotten promises while making uncertainty visible." },
      { type: "data_table", caption: "Brand Placement Prospect Tracker", columns: ["Field", "Purpose", "Example"], rows: [
        ["Prospect type and name", "Separates brand and retail pipelines", "Retailer · Canopy Home"],
        ["Source and date found", "Preserves why it entered the pipeline", "Stockist page · May 6"],
        ["Fit hypothesis", "States the commercial reason", "Price and functional-design alignment"],
        ["Contact and verification", "Records person, role, route, confidence, source", "Merchandise manager · verified by store"],
        ["Territory / category", "Supports conflict and focus checks", "Northeast · Kitchen"],
        ["Last contact", "Prevents accidental over-contact", "May 9 · email"],
        ["Response status", "Uses a consistent stage", "Researching / ready / contacted / replied / meeting / paused / closed"],
        ["Next action and date", "Turns notes into work", "Send approved line sheet · May 14"],
        ["Notes and evidence", "Keeps facts, assumptions, objections, and preferences", "Prefers fall review; no attachments before request"],
        ["Account status / ownership", "Prevents overlap after a relationship advances", "Open prospect; not a house account" ]
      ] },
      briefing("launch-prospecting-briefing", "A simple weekly prospecting rhythm", "Consistency matters more than CRM complexity.", [
        { id: "research", title: "Research", body: "Add only prospects with a source and initial fit reason." },
        { id: "prioritize", title: "Prioritize", body: "Choose a small number based on fit, readiness, timing, and authority." },
        { id: "contact", title: "Contact", body: "Use a verified route, account-specific context, and one clear ask." },
        { id: "update", title: "Update", body: "Record exactly what happened while the context is fresh." },
        { id: "review", title: "Review", flow: [{ label: "Due", detail: "Complete dated next actions" }, { label: "Waiting", detail: "Respect follow-up timing" }, { label: "Paused", detail: "Name why and when to revisit" }, { label: "Closed", detail: "Preserve the outcome without endless chasing" }] }
      ]),
      { type: "callout", title: "Decision rule", text: "Every active prospect should have either a justified next action and date or a deliberate paused/closed status. ‘Follow up sometime’ is not a system." },
      { type: "callout", title: "Reflection", text: "The purpose of tracking is better judgment and reliable follow-through—not measuring activity for its own sake." }
    ],
    [{
      id: "tracker-plan",
      title: "Build your first operating rhythm",
      context: "You have 14 brand prospects, 26 retailer prospects, five unanswered messages, two requested follow-ups, and one brand conversation next week. Several records have no source or next date.",
      prompt: "Choose the best first cleanup action and define a sustainable weekly review routine.",
      fields: [
        { id: "cleanup", type: "option_selection", label: "First cleanup action", required: true, options: [
          { id: "normalize", label: "Add source, status, last contact, and a dated next action—or pause/close each record" },
          { id: "add-more", label: "Add 100 more names before reviewing existing commitments" },
          { id: "message-all", label: "Send every prospect the same message today" }
        ] },
        { id: "routine", type: "written_response", label: "Your simple weekly research, outreach, and follow-up routine", required: true, maxLength: 900 }
      ],
      considerations: ["Requested follow-ups and the scheduled conversation deserve priority.", "Source and next-action dates make records usable.", "A sustainable cadence should leave time for research quality and commercial follow-through."],
      required: true
    }]
  )
];

export const launchPlaybookModule: ProgramModule = {
  id: moduleId,
  slug: "brand-placement-launch-playbook",
  title: "The Brand Placement Launch Playbook",
  description: "Turn the Program's commercial foundations into a responsible, organized first brand-placement workflow.",
  position: 9,
  status: "published",
  items: launchPlaybookItems
};

export const launchPlaybookResources: ProgramLibraryResource[] = [
  {
    id: "launch-brand-readiness-scorecard", title: "Brand Readiness Scorecard", category: "Launch Playbook", summary: "Score visible wholesale readiness while keeping unknowns explicit.",
    sections: [
      { title: "Score 1–5", items: ["Assortment and SKU clarity", "Wholesale pricing and margin readiness", "MOQ and case-pack clarity", "Inventory, lead time, and fulfillment", "Approved product images and assets", "Current retail evidence", "Wholesale contact and order process", "Territory gaps and target-retailer fit"] },
      { title: "Interpret the result", body: "A score organizes evidence; it does not approve or qualify a brand. Record the source for each score, separate unknown from weak, and list the three questions most likely to change the decision." }
    ]
  },
  {
    id: "launch-brand-email-templates", title: "Brand Outreach Email Templates", category: "Launch Playbook", summary: "Copy-ready first-touch, contact-form, warm-introduction, and trade-show follow-up structures.",
    sections: [
      { title: "First brand email", body: "Subject: Wholesale representation question for [Brand]\n\nHi [Name], I found [Brand] through [specific source] and was interested in [specific product/commercial reason]. I am developing a brand-placement focus in [category/geography/retailer type] and research potential brand-to-retailer fit. Does [Brand] currently work with independent sales representatives, or is there someone else who handles wholesale partnerships? If useful, I would be glad to share the specific retail context I noticed and learn more about your current priorities.\n\nBest,\n[Name]" },
      { title: "Website contact form", body: "Hello—I'm reaching out because [specific reason]. I research brand-to-retailer fit in [focus] and would like to ask who handles wholesale or independent-representative conversations for [Brand]. My contact information is [email/phone]. Thank you." },
      { title: "Warm introduction", body: "Hi [Name], [Mutual contact] suggested I contact you because [accurate context]. I am exploring [specific category/territory] brand placement and noticed [specific commercial reason]. Would a short exploratory conversation about your wholesale priorities be appropriate?" },
      { title: "Trade-show follow-up", body: "Subject: Following up from [Show]\n\nHi [Name], thank you for the conversation at [show/booth]. I noted [specific priority or product]. I would like to continue the conversation about [territory/account type/question]. Would [two reasonable times] work for a short call, or is there a preferred next step?" }
    ]
  },
  {
    id: "launch-brand-dm-templates", title: "Brand DM Templates", category: "Launch Playbook", summary: "Short routing messages for founder-led and socially active brands.",
    sections: [
      { title: "First DM", body: "Hi [Brand]—I found you through [specific source] and noticed [specific product/wholesale signal]. I research retail fit in [focus]. Who is the best person to contact about wholesale or independent sales representation? Happy to move this to email." },
      { title: "Reply when routed", body: "Thank you. I’ll contact [person/inbox] and mention that you directed me there. I’ll keep the note focused on [specific reason]." },
      { title: "Boundary", body: "Use DMs to establish relevance and routing. Do not send repeated pitches across every channel or claim retailer interest that has not been confirmed." }
    ]
  },
  {
    id: "launch-linkedin-templates", title: "LinkedIn Outreach Templates", category: "Launch Playbook", summary: "Accurate connection and follow-up language for brand and buyer contacts.",
    sections: [
      { title: "Brand connection note", body: "Hi [Name]—I follow [category] brands and noticed [specific relevant fact] at [Brand]. I would value connecting and learning who owns your wholesale/representation conversations." },
      { title: "Brand follow-up after connection", body: "Thank you for connecting. I research retailer fit in [focus], and [specific reason] made me curious about [Brand]'s wholesale priorities. Would you be the right person for a short exploratory question, or should I contact someone else?" },
      { title: "Buyer routing note", body: "Hi [Name]—I’m trying to verify who reviews [category] for [Retailer]. Your role appeared relevant, but I do not want to assume. Are you the right contact, or is there a preferred submission route?" }
    ]
  },
  {
    id: "launch-brand-follow-up-sequence", title: "Brand Follow-Up Sequence", category: "Launch Playbook", summary: "Two useful follow-ups and a respectful close-the-loop message.",
    sections: [
      { title: "Follow-up 1", body: "Hi [Name], following up on my note about [specific reason]. One additional point that may be useful: [new relevant context]. Is there a preferred person or process for wholesale representation conversations?" },
      { title: "Follow-up 2", body: "Hi [Name], I’ll close the loop after this note. I remain interested in [specific reason], and if [timing/priority] becomes relevant, I would be glad to reconnect. Thank you for considering it." },
      { title: "When to stop", items: ["Stop after a direct no or opt-out.", "Stop an unanswered sequence after the planned close-the-loop message.", "Reconnect only when genuinely new relevance exists—not to manufacture urgency."] }
    ]
  },
  {
    id: "launch-first-brand-conversation-checklist", title: "First Brand Conversation Checklist", category: "Launch Playbook", summary: "A printable agenda for mutual wholesale and representation discovery.",
    sections: [
      { title: "Before", items: ["Confirm participants, time, and exploratory purpose", "Review products, price signals, current stockists, and visible gaps", "Prepare factual questions rather than a predetermined pitch"] },
      { title: "Discuss", items: ["Wholesale history and current retailers", "Existing reps, open territories, priorities, and ideal retailer", "Wholesale price, MOQ, case packs, lead times, fulfillment, terms, returns, samples, availability, and seasonal calendar", "Order approvals and communication", "House accounts, ownership, reorders, commission, expenses, and reporting"] },
      { title: "Close", items: ["Summarize what appears aligned", "Name missing information and owners", "Agree on documents and a dated next step", "Do not treat interest as authorization"] }
    ]
  },
  {
    id: "launch-commission-conversation-worksheet", title: "Commission Conversation Worksheet", category: "Launch Playbook", summary: "Clarify the full compensation mechanism, not only a percentage.",
    sections: [
      { title: "Ask", items: ["How is commission structured for independent sales representatives?", "What is the percentage or fee?", "Is it based on booked, invoiced, shipped, collected, or adjusted revenue?", "When is it earned, reported, and paid?", "How are reorders, house accounts, splits, cancellations, returns, credits, and post-termination orders handled?", "Which expenses require approval and reimbursement?"] },
      { title: "Record", items: ["Brand's exact answer", "Agreement section or source", "Example calculation", "Open questions", "Person responsible for reports and disputes"] }
    ]
  },
  {
    id: "launch-brand-document-request-checklist", title: "Brand Document Request Checklist", category: "Launch Playbook", summary: "Request and verify buyer-ready commercial materials.",
    sections: [
      { title: "Commercial", items: ["Current line sheet", "Wholesale price list", "Catalog and specifications", "Order form or instructions", "Wholesale terms", "MOQ and case packs", "Lead times and availability", "Shipping, returns, damages, and credits"] },
      { title: "Brand and account", items: ["Approved images and brand assets", "Retailer-facing deck", "Territory and account exclusions", "Existing-account list where appropriate", "Sales-rep agreement", "Secure tax/payment forms where applicable"] },
      { title: "Version check", items: ["Owner", "Effective date", "Approval status", "Usage rights", "Refresh cadence"] }
    ]
  },
  {
    id: "launch-rep-agreement-review-checklist", title: "Rep Agreement Review Checklist", category: "Launch Playbook", summary: "Educational issue-spotting prompts for qualified review where appropriate.",
    sections: [
      { title: "Commercial terms", items: ["Commission rate, basis, earning event, payment timing, and reports", "Territory, channel, exclusivity, conflicts", "House accounts, account ownership, splits, and reorders", "Expenses, returns, chargebacks, and post-termination orders"] },
      { title: "Relationship terms", items: ["Term, renewal, termination, and notice", "Confidentiality", "Non-solicitation and non-compete language", "IP and brand-use restrictions", "Independent-contractor language", "Governing law and disputes"] },
      { title: "Educational limitation", body: "This checklist does not interpret enforceability, provide legal or tax advice, or replace review by a qualified attorney or accountant." }
    ]
  },
  {
    id: "launch-retail-account-fit-scorecard", title: "Retail Account Fit Scorecard", category: "Launch Playbook", summary: "Compare retailer fit using observable commercial evidence.",
    sections: [
      { title: "Score 1–5", items: ["Assortment fit", "Price-architecture fit", "Customer fit", "Geographic relevance", "Brand-mix fit", "Category support", "Store/channel positioning", "Demand evidence", "Timing and buying-process readiness"] },
      { title: "Decision note", body: "Write the fit hypothesis, the strongest tension, the evidence source, and the one missing fact most likely to change priority." }
    ]
  },
  {
    id: "launch-buyer-email-templates", title: "Buyer Outreach Email Templates", category: "Launch Playbook", summary: "Account-specific structures for introduction, review, appointment, and post-meeting follow-up.",
    sections: [
      { title: "Introduction", body: "Subject: [Category] idea for [Retailer]\n\nHi [Name], I noticed [specific assortment/customer context] at [Retailer]. I represent/support [Brand], whose [specific product] sits at [confirmed price range] and may be relevant because [fit hypothesis]. Would it be useful if I sent the current line sheet for a brief review?" },
      { title: "Appointment request", body: "Hi [Name], based on [specific context], I would value 15 minutes to show [narrow assortment/reason]. I am available [option 1] or [option 2], and I’m glad to follow your preferred review process." },
      { title: "Instagram routing message", body: "Hi [Retailer]—I support [Brand], a [accurate short category description], and noticed [specific fit reason]. Who is the best person or inbox for a brief [category] line-sheet review? Happy to continue by email and follow your buying process." },
      { title: "LinkedIn buyer message", body: "Hi [Name]—your role appears connected to [category] at [Retailer], but I do not want to assume. I support [Brand] and noticed [specific assortment reason]. Are you the right person for a concise line-sheet introduction, or is there another preferred route?" },
      { title: "Line-sheet review", body: "Hi [Name], attached/linked is the current approved line sheet you invited me to send. The most relevant products may be [SKUs] because [account-specific reason]. Confirmed opening minimum is [amount], price range is [range], and current availability is [timing]. Which questions or products, if any, merit a closer review?" },
      { title: "Post-meeting", body: "Thank you for reviewing [Brand]. I recorded [confirmed interest/questions/no decision]. I will [owned next action] by [date]. You indicated [buyer next step, if any]. Please correct anything I captured inaccurately." }
    ]
  },
  {
    id: "launch-buyer-call-opener", title: "Buyer Call Opener", category: "Launch Playbook", summary: "A permission-based phone opening for routing or a concise fit question.",
    sections: [
      { title: "Routing opener", body: "Hi, my name is [Name]. I’m trying to verify the right process for presenting a [category] line to [Retailer]. Who reviews that category, and is email, an appointment, or another submission route preferred?" },
      { title: "Known-contact opener", body: "Hi [Name], this is [Name] calling about [Brand]. Is this a workable moment for a 30-second reason I thought the line might be relevant to [Retailer], or would another time be better?" },
      { title: "Boundary", body: "Do not trap staff in a pitch, bypass a stated vendor process, or imply an existing buyer relationship." }
    ]
  },
  {
    id: "launch-buyer-voicemail", title: "Buyer Voicemail Template", category: "Launch Playbook", summary: "A short voicemail that makes the callback decision easy.",
    sections: [{ title: "Template", body: "Hi [Name], this is [Name] with [Brand/context]. I’m calling because [one retailer-specific reason]. I’d like to ask whether a review of [category/product] is appropriate for [Retailer]. My number is [number], and I’ll also send a brief email with the relevant context. Again, [name and number]. Thank you." }]
  },
  {
    id: "launch-buyer-follow-up-sequence", title: "Buyer Follow-Up Sequence", category: "Launch Playbook", summary: "Follow-up tied to new usefulness, timing, and a respectful stop point.",
    sections: [
      { title: "Follow-up after introduction", body: "Hi [Name], following up on [Brand/product] for [specific account reason]. The current [line sheet/availability detail] is ready if a review is useful. If this category is handled elsewhere, I would appreciate the correct route." },
      { title: "Close the loop", body: "Hi [Name], I’ll close the loop after this note. If [category/timing] becomes relevant later, I would be glad to reconnect with current information. Thank you." },
      { title: "Reorder follow-up", body: "Hi [Name], checking in on [specific account/product] because [confirmed timing or inventory signal]. Would replenishment, an assortment adjustment, or no action be most useful now?" }
    ]
  },
  {
    id: "launch-prospect-tracker", title: "Brand Placement Prospect Tracker", category: "Launch Playbook", summary: "A minimal, print-friendly schema for brands, retailers, contacts, and next actions.",
    sections: [
      { title: "Columns", items: ["Prospect type", "Company/account", "Source and date found", "Fit hypothesis", "Contact name, role, route, and verification source", "Territory/category", "Last contact date and channel", "Response status", "Next action and date", "Notes and evidence", "Account ownership/exclusion status"] },
      { title: "Statuses", items: ["Researching", "Ready for outreach", "Contacted", "Replied", "Meeting/review", "Waiting", "Paused", "Closed—fit", "Closed—no fit"] },
      { title: "Weekly review", items: ["Complete due commitments first", "Verify contacts before outreach", "Close or pause records without a justified next action", "Check for account/territory conflicts", "Add fewer, better-researched prospects"] }
    ]
  },
  {
    id: "launch-brand-onboarding-checklist", title: "Brand Onboarding Checklist", category: "Launch Playbook", summary: "Turn an agreed relationship into a controlled commercial handoff.",
    sections: [
      { title: "Relationship", items: ["Signed current agreement", "Scope, territory, channels, authority, and conflicts", "Commission, reports, payment, expenses", "House accounts, ownership, splits, and reorders", "Primary contacts and escalation path"] },
      { title: "Commercial readiness", items: ["Current line sheet, prices, terms, and order route", "Inventory, lead times, minimums, case packs", "Shipping, returns, damages, credits", "Approved claims, images, assets, and usage rules", "Sample and trade-show process"] },
      { title: "Operating rhythm", items: ["Account list and exclusions imported carefully", "Priority retailers agreed", "Reporting cadence set", "Document refresh owner named", "First 30-day actions and review date recorded"] }
    ]
  }
];
