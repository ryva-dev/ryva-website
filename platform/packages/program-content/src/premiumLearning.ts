import type { ProgramLibraryResource, ProgramLearningItem, VisualBriefingSlide } from "./index.js";

type ModuleLearning = {
  briefingTitle: string;
  briefingSubtitle: string;
  fieldNotes: string[];
  lens: string;
  misunderstandings: string[];
  slideTopics: Array<[string, string, string[]]>;
};

const moduleLearning: Record<string, ModuleLearning> = {
  "module-1": {
    briefingTitle: "How Brand Placement Actually Works",
    briefingSubtitle: "The ecosystem, responsibilities, decisions, and money behind a continuing wholesale relationship.",
    lens: "separate interest, placement, purchase, fulfillment, and account development instead of treating them as one event",
    misunderstandings: [
      "A retailer's enthusiasm is useful evidence, but it is not a purchase order.",
      "A representative supports a commercial relationship; the buyer still owns the retailer's assortment decision.",
      "An opening order begins a test. Reorders and account activity provide stronger evidence of continuity."
    ],
    fieldNotes: [
      "Wholesale is a business-to-business route to market. A brand sells inventory to a retailer at a wholesale price, and the retailer resells it to consumers at a retail price. Direct-to-consumer commerce removes that resale step: the brand owns the consumer transaction, presentation, service, and inventory risk. Many brands use both routes, but the economics, information needs, and relationships are different.",
      "Brand placement is the work of finding a credible retail context for a product and supporting the relationship that follows. It is not merely sending samples or persuading someone that an object is attractive. The retailer must decide whether the product deserves inventory dollars, physical or digital space, staff attention, and a place beside brands already in the assortment.",
      "The wholesale ecosystem includes brands, independent representatives, showrooms, distributors, buyers, retailers, logistics partners, and consumers. Their roles can overlap, especially in small businesses. A showroom may represent several brands; a distributor may purchase and resell inventory; an independent representative may be paid according to an agreement when commissionable business occurs. Titles alone do not prove responsibility, authority, or compensation.",
      "Sell-in and sell-through describe different moments. Sell-in is the brand-to-retailer sale. Sell-through describes the retailer's movement of product to consumers over a period. A strong opening order can create an impressive sell-in result while weak sell-through makes a reorder less likely. Conversely, a cautious opening order with healthy sell-through can become a valuable continuing account.",
      "The cleanest mental model is a sequence: research, fit, introduction, evaluation, placement, order, fulfillment, in-store or online performance, and possible reorder. Each stage produces different evidence. Commercial judgment improves when the learner asks what is known, what remains assumed, who owns the next decision, and what information should be recorded."
    ],
    slideTopics: [
      ["The ecosystem", "Brand placement connects creative product work to a retailer's commercial system.", ["Brand", "Representative or showroom", "Buyer and retailer", "Consumer"]],
      ["Two routes to market", "DTC and wholesale place different responsibilities on the brand.", ["DTC: brand owns the consumer sale", "Wholesale: retailer purchases for resale", "Hybrid models require clear channel thinking"]],
      ["The relationship flow", "Information and product move forward; evidence and demand signals move back.", ["Brand → representative → buyer", "Buyer → retailer assortment", "Retailer → consumer", "Consumer demand → reorder evidence"]],
      ["What the buyer is deciding", "A buyer allocates limited inventory dollars and attention.", ["Customer fit", "Assortment need", "Price and margin", "Timing and feasibility"]],
      ["Role boundaries", "Credible work depends on knowing what each participant can actually decide.", ["Brand sets approved facts and terms", "Representative communicates and supports", "Buyer evaluates the assortment", "Retailer owns its customer decision"]],
      ["Placement is not an order", "Commercial states should remain distinct.", ["Interest", "Evaluation", "Placement opportunity", "Purchase order"]],
      ["The opening order", "The first purchase is an inventory test, not proof of permanent success.", ["SKU edit", "Unit depth", "Minimums", "Ship window"]],
      ["Sell-in versus sell-through", "One measures retailer purchasing; the other describes consumer movement.", ["Opening order = sell-in", "Consumer sales = sell-through", "Reorder connects the two"]],
      ["The reorder lifecycle", "Reorders depend on demand, inventory, timing, cash, and availability.", ["Review account activity", "Identify needs", "Confirm availability", "Record the next purchase"]],
      ["Commercial money flow", "Retail sales and representative compensation are related but not interchangeable.", ["Retailer pays brand", "Consumer pays retailer", "Commission follows the governing agreement"]],
      ["Where commissions may arise", "Rates, attribution, timing, returns, and splits vary by agreement.", ["Commissionable base", "Approved rate", "Payment timing", "Adjustments"]],
      ["One connected system", "Strong placement work preserves context from first research through continuing account development.", ["Facts remain traceable", "Unknowns remain visible", "Next actions have owners"]]
    ]
  },
  "module-2": {
    briefingTitle: "Reading a Brand Like a Wholesale Professional",
    briefingSubtitle: "From product architecture and pricing to an assortment a retailer can actually buy.",
    lens: "translate brand presentation into orderable product, pricing, timing, and assortment information",
    misunderstandings: [
      "A product and a SKU are not interchangeable: a SKU is one orderable variation.",
      "Markup and gross margin use different denominators even when the gross-profit dollars are identical.",
      "A beautiful line is not commercially ready if pricing, minimums, availability, or documentation are unclear."
    ],
    fieldNotes: [
      "Commercial readiness begins by turning a product story into a reliable ordering system. A buyer needs to understand what each item is, which variations are separately orderable, what the retailer pays, what consumers are expected to pay, how much must be ordered, and when inventory can arrive. Missing operational facts can stop an otherwise appealing line from moving forward.",
      "Product hierarchy helps a learner read a line without confusing breadth with disorder. A collection may contain categories; a category contains products; a product may contain many SKUs. Hero products give an edit a recognizable center, while supporting products create usable price points, functions, colors, or gifting options. Breadth describes how many different choices exist. Depth describes how much inventory is committed to selected choices.",
      "Wholesale price, MSRP, gross-profit dollars, markup, and gross margin answer different questions. If wholesale is $25 and retail is $50, gross-profit dollars are $25, markup is 100%, and gross margin is 50%. Those product-level figures do not represent the retailer's final profitability after freight, markdowns, labor, rent, returns, and other operating costs.",
      "MOQ, case pack, opening minimum, lead time, availability, and ship window shape feasibility. A retailer may like a product but be unable to support a six-unit case, a $2,500 opening minimum, or delivery after the relevant selling season. These are not administrative details; they change the commercial decision.",
      "A useful line sheet reduces ambiguity. It connects images and descriptions to SKU, wholesale price, MSRP, variants, minimums, case packs, timing, terms, and contact information. It should help a buyer create a coherent edit and help both parties verify what was discussed."
    ],
    slideTopics: [
      ["Read the line as a system", "A brand is more than a collection of attractive objects.", ["Positioning", "Product hierarchy", "Price architecture", "Operational readiness"]],
      ["Product → variation → SKU", "Each orderable variation needs a stable identity.", ["Product: Travel Pouch", "Variation: Moss", "SKU: WGF-TP-MOS"]],
      ["Collection architecture", "Categories and price points create an assortment customers can navigate.", ["Hero products", "Supporting products", "Opening price points", "Higher-price anchors"]],
      ["Breadth versus depth", "More SKUs and more units solve different assortment problems.", ["Breadth tests choice", "Depth supports proven demand", "Space and budget constrain both"]],
      ["The pricing waterfall", "Wholesale price becomes retail value only when the account can support the economics.", ["Wholesale cost", "Gross-profit dollars", "MSRP", "Operating costs remain"]],
      ["Margin is not markup", "The numerator may match; the denominator does not.", ["Markup ÷ wholesale cost", "Margin ÷ retail price", "Name the measure explicitly"]],
      ["Minimums", "Opening minimums, MOQs, and case packs create different constraints.", ["Order-level threshold", "Product-level minimum", "Ordering multiple"]],
      ["Timing", "Lead time and ship windows must align with the retailer's plan.", ["Available now", "Made to order", "Seasonal window", "Replenishment"]],
      ["Line-sheet anatomy", "Presentation and operational facts belong together.", ["Image and description", "SKU and price", "Minimums and timing", "Terms and contact"]],
      ["Readiness dashboard", "A strong story cannot compensate for every missing commercial input.", ["Product data complete", "Pricing verified", "Inventory supportable", "Documents current"]],
      ["Wrenfield edit", "A coherent five-SKU edit may outperform an unfocused twelve-SKU offer.", ["Customer", "Price ceiling", "Shelf space", "Case-pack feasibility"]],
      ["Decision changes", "Price, MOQ, case pack, timing, and assortment can each change fit.", ["Recalculate", "Reframe the edit", "Name the unknown", "Avoid assumptions"]]
    ]
  },
  "module-3": {
    briefingTitle: "How to Read a Retail Account",
    briefingSubtitle: "A practical lens for buyers, customers, assortments, economics, and missing information.",
    lens: "evaluate the account's customer, category, price architecture, assortment, geography, and operating reality together",
    misunderstandings: [
      "A large audience does not establish customer demand or buying capacity.",
      "The person responsible for buying may be an owner, merchant, founder, or category manager.",
      "A fit score exposes assumptions; it does not turn incomplete information into objective truth."
    ],
    fieldNotes: [
      "Retail accounts differ in format, scale, customer, buying process, category authority, and operational requirements. An independent boutique may make quick owner-led decisions but place modest orders. A regional chain may offer larger potential while requiring formal onboarding, reliable replenishment, detailed documentation, and longer planning windows.",
      "Reading an account means understanding the customer it serves and the assortment logic it has already built. Useful signals include category mix, adjacent brands, price bands, store count, geography, presentation, promotional behavior, and visible gaps. Research should distinguish observed facts from inferences: a polished website is evidence of presentation, not proof of inventory capacity or sales performance.",
      "The buyer's role is to decide what belongs in the assortment under real constraints. Buyers consider customer relevance, category need, differentiation, price, margin, inventory commitment, timing, minimums, delivery reliability, and overlap with products already carried. They may appreciate a product and still decide that the current assortment does not need it.",
      "Account fit is multidimensional. Customer fit can be strong while order feasibility is weak; category fit can be credible while timing is poor. A matrix helps compare opportunities consistently, but every score should be explainable and revisable when new evidence appears.",
      "Missing information is part of the commercial picture. Store count, buyer authority, open-to-buy timing, existing inventory, sales history, and operational requirements may be unknown. A strong recommendation names those gaps and identifies what would change the decision."
    ],
    slideTopics: [
      ["Account anatomy", "A retailer is a customer system, assortment, buying process, and operating model.", ["Format", "Customer", "Categories", "Operations"]],
      ["Retailer types", "Independent, specialty, multi-location, department, and online accounts buy differently.", ["Different order sizes", "Different calendars", "Different requirements"]],
      ["Who is the buyer?", "Follow responsibility and influence rather than one job title.", ["Owner-buyer", "Merchant", "Category manager", "Founder/operator"]],
      ["Customer profile", "Fit begins with who shops, why, and at what price.", ["Need state", "Taste", "Budget", "Shopping occasion"]],
      ["Price architecture", "A price can be valid for the brand and still be wrong for the account.", ["Opening price", "Core range", "Premium anchor"]],
      ["Adjacent brands", "Neighbors reveal positioning, overlap, and possible gaps.", ["Complement", "Substitute", "Category saturation"]],
      ["The buyer lens", "Attractiveness is filtered through commercial constraints.", ["Need", "Economics", "Timing", "Risk"]],
      ["Good fit", "Several dimensions support the same conclusion.", ["Customer overlap", "Category gap", "Feasible commitment"]],
      ["Weak fit", "A strong product can still create the wrong inventory commitment.", ["Price mismatch", "Overlap", "Timing", "Minimum"]],
      ["Fit matrix", "Scores make judgments visible and comparable.", ["Customer", "Category", "Price", "Positioning", "Timing", "Feasibility"]],
      ["Missing information", "Unknowns should change confidence, not disappear from the recommendation.", ["Buyer authority", "Open-to-buy", "Inventory", "Operational rules"]],
      ["Qualification", "Prioritize the next useful question, not a premature yes or no.", ["What is known?", "What is assumed?", "What changes the decision?"]]
    ]
  },
  "module-4": {
    briefingTitle: "From a Market to a Placement Strategy",
    briefingSubtitle: "How territory, density, timing, fit, and opportunity become a focused account plan.",
    lens: "allocate limited attention according to fit, readiness, commercial potential, territory authority, and missing information",
    misunderstandings: ["The largest account is not automatically the highest priority.", "A territory can be geographic, account-based, channel-based, or defined by agreement.", "Urgency, attractiveness, and strategic importance are different signals."],
    fieldNotes: [
      "Placement strategy converts a long list of possible accounts into a reasoned sequence of work. The objective is not to contact everyone at once. It is to decide where attention is justified now, where evidence should be developed, and which opportunities should remain visible for a later window.",
      "Territory is the scope in which representation or account development occurs. It may be geographic, channel-specific, account-specific, or governed by named exclusions and existing relationships. Before outreach, the learner should understand authority, overlap, and any placement-density concern that could affect the brand or retailer.",
      "Market density can create both efficiency and conflict. Nearby accounts may reduce travel and support awareness, but too much overlap can weaken retailer differentiation or violate a brand's distribution approach. White space is not simply an empty map; it is a place where customer demand, account quality, and operational feasibility may or may not exist.",
      "A useful prioritization model separates fit, current probability or readiness, and commercial potential. A high-fit account without current budget may remain strategically important but not urgent. A large account with poor category fit may be attractive on paper but expensive to pursue.",
      "Sequencing matters because every conversation can improve the next one. Research, smaller account tests, regional travel, seasonal calendars, and product availability all shape a 30-day plan. The plan should preserve lower-priority accounts without pretending every opportunity deserves equal effort."
    ],
    slideTopics: [
      ["Market to strategy", "A map becomes useful only when commercial evidence is layered onto it.", ["Accounts", "Customers", "Channels", "Timing"]],
      ["Territory is scope", "Geography is one definition, not the only definition.", ["Region", "Channel", "Named accounts", "Agreement boundaries"]],
      ["Density", "Concentration can improve efficiency while creating overlap risk.", ["Travel efficiency", "Brand visibility", "Retailer differentiation"]],
      ["White space", "An empty area is a question, not proof of opportunity.", ["Demand", "Account quality", "Operational reach"]],
      ["Segment accounts", "Groups help match effort to evidence.", ["Strategic", "Develop", "Monitor"]],
      ["Fit versus opportunity", "A credible relationship and a large theoretical upside are different.", ["Fit", "Readiness", "Potential"]],
      ["Priority quadrant", "High fit and high readiness deserve different action from high fit and low readiness.", ["Act now", "Develop", "Qualify", "Deprioritize"]],
      ["Tier 1", "Strong evidence supports near-term action.", ["Clear reason", "Right timing", "Known contact"]],
      ["Tier 2", "Promising accounts need one or two facts before active pursuit.", ["Research gap", "Future window", "Introduction path"]],
      ["Tier 3", "Keep visible without consuming disproportionate attention.", ["Weak timing", "Low confidence", "Monitor change"]],
      ["Sequence the pipeline", "Research, introduction, conversation, and follow-up need deliberate order.", ["Owner", "Next action", "Date", "Evidence"]],
      ["Thirty-day plan", "Attention is a budget: allocate it explicitly.", ["Three active", "Three nurture", "Four monitor"]]
    ]
  },
  "module-5": {
    briefingTitle: "From Cold Account to Buyer Conversation",
    briefingSubtitle: "Research-led outreach, useful follow-up, buyer meetings, and professional next steps.",
    lens: "make every contact relevant, concise, supportable, and proportionate to the buyer's current level of interest",
    misunderstandings: ["Personalization is commercial relevance, not a decorative compliment.", "Follow-up should add context or timing rather than repeat the same request.", "A meeting is a discovery and decision conversation, not permission to overpromise."],
    fieldNotes: [
      "Outreach earns attention by making a credible connection between a brand and a retailer. Research comes first because the message should answer why this account, why this product context, and why now. A short message with a specific reason for fit is often stronger than a long brand biography.",
      "The first contact usually needs a clear subject line, a concise brand position, one or two relevant product or assortment points, supportable commercial context, and a low-friction next action. It rarely needs every founder detail, every SKU, every press mention, every term, and several attachments at once.",
      "Strong personalization refers to observable retailer context: a category, price band, customer, adjacent assortment, seasonal window, or stated buying need. Weak personalization flatters the store without demonstrating that the sender understands its commercial reality.",
      "Follow-up is useful when it adds something: requested material, a tighter product edit, updated availability, a relevant ship window, or a reason to revisit timing. Repetition without new value creates noise. A professional sequence also knows when to pause and keep the account available for a future window.",
      "Buyer appointments require preparation and listening. The representative should know the objective, product facts, approved terms, minimums, timing, and open questions. During the conversation, record what the buyer actually says, distinguish requests from decisions, clarify ownership, and close with an agreed next action.",
      "Professional boundaries matter. Do not invent availability, alter terms without authority, promise exclusivity, guarantee performance, or interpret silence as consent. Accurate follow-through builds more credibility than an immediate unsupported answer."
    ],
    slideTopics: [
      ["Outreach has a job", "The goal is a relevant next conversation, not maximum message volume.", ["Earn attention", "Establish fit", "Offer a next step"]],
      ["Research before contact", "Commercial context turns a cold message into a reasoned introduction.", ["Category", "Customer", "Price", "Timing"]],
      ["Subject lines", "Specific and useful beats dramatic or vague.", ["Brand + category", "Relevant collection", "Clear context"]],
      ["Message anatomy", "A buyer should quickly understand what, why them, and what next.", ["Context", "Position", "Evidence", "Action"]],
      ["Weak message", "Generic enthusiasm creates work for the buyer.", ["No account reason", "Too much biography", "Vague ask"]],
      ["Better message", "Specific relevance reduces interpretation effort.", ["Observed fit", "Focused edit", "Simple next action"]],
      ["Strong message", "Commercial clarity and restraint signal preparation.", ["Supportable claims", "Useful attachment", "Timing"]],
      ["Follow-up sequence", "Each touch should add value or respond to timing.", ["Reminder", "New context", "Close the loop"]],
      ["Prepare the appointment", "Know facts, authority, questions, and desired next action.", ["Assortment", "Terms", "Timing", "Unknowns"]],
      ["Meeting structure", "Open, discover, present, clarify, agree.", ["Listen", "Take notes", "Confirm"]],
      ["Buyer-response tree", "Interest, objection, delay, and no response require different next actions.", ["Clarify", "Provide", "Pause", "Close"]],
      ["Record the next step", "A relationship becomes manageable when context and ownership persist.", ["Who", "What", "When", "Why"]]
    ]
  },
  "module-6": {
    briefingTitle: "What Happens After a Buyer Says Yes",
    briefingSubtitle: "Purchase orders, verification, terms, fulfillment, discrepancies, and the path to reorder.",
    lens: "treat buyer interest, a valid purchase order, fulfillment, and payment as separate verifiable states",
    misunderstandings: ["A verbal yes is not a complete purchase order.", "Case-pack and price discrepancies should be resolved before fulfillment, not hidden in the workflow.", "Educational terms examples do not replace the parties' agreement or professional advice."],
    fieldNotes: [
      "A buyer's positive response begins operational work; it does not finish it. A purchase order should identify the parties, PO number, dates, ship-to and bill-to details, SKUs, quantities, unit prices, line extensions, totals, requested ship window, and applicable terms. Every important field should agree with approved product and commercial information.",
      "Order verification is a control. Match the PO against the current line sheet, approved price list, case packs, MOQs, opening minimum, availability, discounts, and agreed timing. Recalculate line extensions rather than assuming the supplied total is correct. A small discrepancy can create inventory, invoice, commission, or relationship problems later.",
      "Payment terms describe when payment is expected and may include conditions established by the parties. Ship windows describe when inventory is expected to leave or arrive. Freight, routing, cancellation, return, damage, and compliance requirements vary. Learners should record the governing facts and escalate legal, tax, accounting, or contract questions to qualified professionals.",
      "Fulfillment connects an approved order to actual inventory movement. The brand or fulfillment partner confirms inventory, prepares products and documents, ships, and resolves shortages or damage. The representative may support communication but should not claim operational authority they do not have.",
      "A reorder is a new commercial event informed by account activity. It should be verified with the same discipline as an opening order. Reorder timing, available inventory, product performance, season, and buyer intent all matter."
    ],
    slideTopics: [
      ["Interest is not a PO", "A positive conversation still needs a complete, authorized order.", ["Intent", "Document", "Verification"]],
      ["PO anatomy", "The document should identify parties, products, quantities, prices, dates, and terms.", ["Header", "Lines", "Totals", "Instructions"]],
      ["Order lines", "SKU, quantity, unit price, and extension must agree.", ["SKU", "Units", "Wholesale", "Line total"]],
      ["Verify the math", "Recalculate each line and the order total.", ["Quantity × price", "Discount authority", "Tax/freight treatment"]],
      ["Case-pack problem", "A requested quantity can be numerically clear and still not orderable.", ["Pack multiple", "Break-pack policy", "Clarification"]],
      ["Price discrepancy", "Current approved price controls the verification conversation.", ["Line sheet", "Quoted exception", "PO value"]],
      ["Ship-date issue", "Availability must support the buyer's selling window.", ["Requested date", "Lead time", "Confirmed window"]],
      ["Terms", "Payment and commercial conditions must be recorded accurately.", ["Due date", "Approved terms", "Professional advice when needed"]],
      ["Fulfillment timeline", "Confirmed order → allocation → pick/pack → shipment → receipt.", ["Owners", "Dates", "Evidence"]],
      ["Discrepancy handling", "Name the mismatch, confirm the governing fact, document the resolution.", ["Do not guess", "Do not silently edit", "Keep originals"]],
      ["Opening order", "The first purchase creates a baseline for follow-through.", ["Assortment", "Units", "Value", "Timing"]],
      ["Reorder", "A subsequent purchase reflects new need, not automatic continuation.", ["Performance", "Inventory", "Availability", "Intent"]]
    ]
  },
  "module-7": {
    briefingTitle: "What Happens After Placement",
    briefingSubtitle: "Account health, sell-through, reorder behavior, assortment development, and responsible interpretation.",
    lens: "interpret account activity over time without forcing a conclusion from one order or one metric",
    misunderstandings: ["A large opening order is not automatically healthier than a smaller account that reorders.", "Sell-through needs a time period, starting inventory, receipts, and context.", "A dashboard shows patterns; it does not prove causation."],
    fieldNotes: [
      "Placement creates an account-development question: what evidence shows that the relationship is working, changing, or at risk? The opening order establishes a baseline, but fulfillment, payment, product movement, buyer communication, reorders, and assortment changes reveal the continuing relationship.",
      "Sell-through describes units sold relative to units available during a defined period. It becomes more useful when the learner knows the dates, receipts, returns, markdowns, stockouts, placement, and season. Comparing percentages without comparable windows or inventory can create a false conclusion.",
      "Reorder cadence describes the rhythm of subsequent purchasing. A frequent healthy reorder account may be valuable even when each order is smaller. A large opening order with no reorder deserves investigation, but the absence of a reorder may reflect excess opening inventory, seasonality, delivery delay, buyer turnover, or unavailable product.",
      "Account health combines quantitative and qualitative evidence. Order history, payment status, sell-through, communication, inventory, returns, product mix, and next-step clarity can point in different directions. A health label should lead to a question and action, not conceal uncertainty.",
      "Account development may mean replenishing proven SKUs, expanding into adjacent products, adjusting depth, solving an operational issue, or accepting that the fit has weakened. Commercial follow-up should be proportionate to evidence and should record what additional data would change the recommendation."
    ],
    slideTopics: [
      ["Placement begins the account", "The opening order is a baseline, not the finish line.", ["Fulfillment", "Performance", "Reorder", "Development"]],
      ["Account lifecycle", "Accounts move through active, developing, stable, at-risk, and inactive patterns.", ["State can change", "Evidence should be dated"]],
      ["Opening baseline", "Capture assortment, units, value, and timing.", ["What entered", "When", "Under what conditions"]],
      ["Sell-through", "Units sold ÷ units available needs a defined period and inventory basis.", ["Window", "Receipts", "Returns", "Stockouts"]],
      ["Reorder cadence", "Timing between purchases can reveal need and planning rhythm.", ["Frequent", "Seasonal", "Irregular"]],
      ["Healthy pattern", "Fulfilled orders, responsive communication, and credible replenishment reinforce one another.", ["Payment", "Movement", "Next action"]],
      ["Declining pattern", "Reduced activity deserves investigation before a final label.", ["Inventory", "Timing", "Assortment", "Relationship"]],
      ["Three accounts", "Large/no reorder, small/growing, and frequent/healthy tell different stories.", ["Avoid one-metric ranking"]],
      ["Account-health dashboard", "Signals organize attention but do not establish cause.", ["Orders", "Reorders", "Payment", "Activity"]],
      ["Assortment expansion", "Add breadth or depth when evidence and buyer context support it.", ["Proven SKU", "Adjacent need", "Feasibility"]],
      ["Risk", "Silence, aging inventory, payment issues, and missing ownership require different responses.", ["Clarify", "Support", "Escalate"]],
      ["Development plan", "Choose the next action and the evidence needed to evaluate it.", ["Owner", "Date", "Reason", "Expected signal"]]
    ]
  },
  "module-8": {
    briefingTitle: "Understanding the Commercial Side of Representation",
    briefingSubtitle: "Commission logic, attribution, adjustments, records, judgment, and the connected Ryva workflow.",
    lens: "trace compensation to the governing agreement, verified commercial events, attribution, and adjustments",
    misunderstandings: ["Order value, commissionable value, approved commission, and paid commission are distinct.", "One commission structure does not apply to every brand relationship.", "A calculated expectation is not proof that payment is due."],
    fieldNotes: [
      "Commission can compensate representation or sales activity according to an agreement. The agreement should define the rate, commissionable base, territory or account attribution, exclusions, splits, timing, treatment of cancellations or returns, and what event makes an amount eligible, approved, or payable.",
      "Gross order value and commissionable sales may differ. Taxes, freight, discounts, returns, canceled units, house accounts, excluded channels, or other adjustments may affect the base depending on the agreement. The learner should calculate only from verified inputs and label assumptions when a governing fact is missing.",
      "Timing is a commercial state. Expected commission may be calculated when an order is recorded, approved later, and paid after the brand receives retailer payment or after another contractual milestone. A statement should make those states visible rather than collapsing them into one number.",
      "Splits and attribution require evidence. Two representatives, shared territories, inherited accounts, e-commerce orders, or buyer transfers can create questions that arithmetic alone cannot solve. Preserve the order, agreement, account history, adjustment, and decision record so the outcome can be explained.",
      "Commercial judgment connects the entire Program. Ryva organizes brands, products, buyers, placements, outreach, tasks, documents, orders, reorders, accounts, commissions, and analytics so that the next decision can be made with traceable context. The software does not replace the agreement or human responsibility."
    ],
    slideTopics: [
      ["Why commission exists", "Compensation follows a defined commercial relationship and agreement.", ["Scope", "Rate", "Base", "Timing"]],
      ["Order to commission", "The lifecycle passes through verification, attribution, approval, and payment.", ["Order", "Commissionable", "Approved", "Paid"]],
      ["Commissionable sales", "The base may differ from gross order value.", ["Freight", "Tax", "Discount", "Return"]],
      ["Rate", "Apply the agreed percentage to the verified base.", ["Base × rate", "Label the period"]],
      ["Statement anatomy", "A useful statement connects each amount to account, order, date, base, rate, and status.", ["Traceable", "Reconciled", "Explainable"]],
      ["Split example", "Shared credit needs an agreement or documented decision.", ["Participants", "Percentages", "Reason"]],
      ["Adjustment example", "Returns or canceled units can change a prior expectation.", ["Original", "Adjustment", "Revised"]],
      ["Attribution", "Territory, named account, channel, and timing may all matter.", ["Do not infer from geography alone"]],
      ["Disputes", "Preserve evidence and separate calculation from interpretation.", ["Order", "Agreement", "Account history", "Decision"]],
      ["Commercial records", "Good records make reconciliation possible.", ["Originals", "Structured data", "Audit trail"]],
      ["Ryva workflow", "Every module becomes one connected commercial map.", ["Research → placement → order → account → commission"]],
      ["You can now read the business", "The learner can identify facts, calculate carefully, name unknowns, and choose a responsible next action.", ["No guarantee", "Applied commercial literacy"]]
    ]
  }
};

function briefingSlides(moduleId: string, topics: ModuleLearning["slideTopics"]): VisualBriefingSlide[] {
  return topics.map(([title, body, points], index) => ({
    id: `${moduleId}-briefing-${index + 1}`,
    eyebrow: index === 0 ? "Visual Briefing" : `Commercial view ${String(index + 1).padStart(2, "0")}`,
    title,
    body,
    points,
    ...(index === topics.length - 1 ? {
      teachingNote: "Carry this model into the decision practice and return to the reference library when you need the framework again."
    } : {})
  }));
}

export function enrichModuleItems(moduleId: string, items: ProgramLearningItem[]): ProgramLearningItem[] {
  const learning = moduleLearning[moduleId];
  if (!learning) return items;
  const firstArticleId = items.find((item) => item.type === "article")?.id;
  return items.map((item) => {
    if (item.type !== "article" || item.status !== "published") return item;
    const fieldNotes = item.id === firstArticleId ? [
      { type: "heading" as const, level: 2 as const, text: "Field Notes" },
      ...learning.fieldNotes.map((text) => ({ type: "paragraph" as const, text })),
      {
        type: "visual_briefing" as const,
        id: `${moduleId}-visual-briefing`,
        title: learning.briefingTitle,
        subtitle: learning.briefingSubtitle,
        slides: briefingSlides(moduleId, learning.slideTopics)
      }
    ] : [
      { type: "heading" as const, level: 2 as const, text: "Field Notes" },
      { type: "paragraph" as const, text: `${item.title.replace(/^\d+\.\d+\s+/, "")} matters because it changes what can be responsibly concluded from the commercial information available. In practice, the strongest next step is rarely based on one attractive signal; it comes from connecting the concept to the account, assortment, timing, economics, authority, and evidence around it.` },
      { type: "paragraph" as const, text: `Use this lesson to ${learning.lens}. Record the facts that are confirmed, label assumptions, and identify the missing information that would materially change the decision. Practices vary by brand, retailer, category, territory, and agreement, so the framework supports judgment rather than creating a universal rule.` }
    ];
    return {
      ...item,
      estimatedMinutes: Math.max(item.estimatedMinutes ?? 0, item.id === firstArticleId ? 18 : 12),
      blocks: [
        ...fieldNotes,
        { type: "heading", level: 2, text: "In Practice" },
        ...item.blocks,
        { type: "heading", level: 2, text: "Look Closer" },
        { type: "callout", title: "Common beginner misunderstandings", text: learning.misunderstandings.join(" ") },
        { type: "heading", level: 2, text: "Keep This" },
        { type: "callout", title: "Decision lens", text: `Ask: What is known? What is assumed? Who owns the decision? What information would change the recommendation? Then ${learning.lens}.` }
      ]
    };
  });
}

const resources: Array<[string, string, string, string, string[]]> = [
  ["glossary", "Brand Placement Glossary", "Foundations", "Core language used throughout the Program.", ["Brand placement: connecting products with appropriate retail environments and supporting the commercial relationship.", "Sell-in: the brand-to-retailer sale.", "Sell-through: consumer sales relative to available retail inventory over a defined period.", "Opening order: the retailer's first purchase from a brand.", "Reorder: a subsequent purchase by an established account."]],
  ["ecosystem-map", "Industry Ecosystem Map", "Foundations", "A role and responsibility map from brand to consumer.", ["Brand owns approved product and commercial facts.", "Representative or showroom supports the retailer relationship within agreed authority.", "Buyer evaluates assortment fit.", "Retailer purchases for resale.", "Consumer demand creates performance evidence."]],
  ["wholesale-math", "Wholesale Math Guide", "Commercial math", "Markup, margin, gross-profit dollars, order value, and sell-through formulas.", ["Line value = quantity × wholesale price", "Gross-profit dollars = retail − wholesale", "Markup = gross profit ÷ wholesale", "Gross margin = gross profit ÷ retail", "Sell-through = units sold ÷ units available"]],
  ["brand-readiness", "Brand Readiness Checklist", "Brands & products", "A pre-outreach review of commercial and operational readiness.", ["Product and SKU data complete", "Wholesale and MSRP verified", "Minimums and case packs documented", "Availability and lead times current", "Line sheet and ordering contact ready"]],
  ["pricing-margin", "Wholesale Pricing & Margin Guide", "Brands & products", "A worked reference for product-level economics.", ["Name the exact measure", "Use the correct denominator", "Separate product margin from full retailer profitability", "Recalculate after discounts or changes"]],
  ["assortment-planner", "Opening Assortment Planner", "Brands & products", "A structured worksheet for SKU breadth, depth, budget, and minimums.", ["Account customer and category need", "Selected SKUs and role", "Case-pack quantity", "Wholesale commitment", "Missing availability information"]],
  ["line-sheet", "Line Sheet Anatomy Guide", "Brands & products", "The commercial fields a buyer needs to understand and order the line.", ["Image, product, description", "SKU and variants", "Wholesale and MSRP", "MOQ, case pack, opening minimum", "Lead time, availability, terms, contact"]],
  ["account-research", "Retail Account Research Worksheet", "Accounts", "A fact-versus-assumption account research template.", ["Retail format and locations", "Customer and price architecture", "Categories and adjacent brands", "Visible gaps or overlap", "Unknown buying process and timing"]],
  ["buyer-profile", "Buyer Profile Worksheet", "Accounts", "Identify assortment responsibility and communication context.", ["Name, title, and actual responsibility", "Categories influenced", "Known preferences or requests", "Current decision stage", "Agreed next action"]],
  ["fit-matrix", "Brand–Account Fit Matrix", "Accounts", "Compare customer, category, price, positioning, timing, and feasibility.", ["Score each dimension 1–5", "Write the evidence behind the score", "Name missing information", "Re-score when facts change"]],
  ["qualification", "Account Qualification Checklist", "Accounts", "A quick screen before investing outreach effort.", ["Credible customer overlap", "Visible category need", "Compatible price band", "Feasible order commitment", "Reachable decision-maker or path"]],
  ["territory", "Territory Planning Worksheet", "Strategy", "Map authority, density, travel, channels, and whitespace.", ["Territory definition", "Existing placements", "Account clusters", "Conflict or density concerns", "Travel and timing implications"]],
  ["priority-matrix", "Opportunity Prioritization Matrix", "Strategy", "Separate fit, readiness, and potential.", ["Fit evidence", "Probability/readiness", "Commercial potential", "Required information", "Priority tier and next action"]],
  ["target-planner", "Target Account Planner", "Strategy", "Turn priority into accountable actions.", ["Account and reason", "Owner", "Next action", "Target date", "Evidence expected"]],
  ["thirty-day", "30-Day Placement Planning Sheet", "Strategy", "Allocate a limited attention budget.", ["Three active priorities", "Three nurture accounts", "Four monitor accounts", "Weekly evidence review"]],
  ["outreach-framework", "Buyer Outreach Framework", "Communication", "A concise structure for relevant first contact.", ["Observed retailer context", "Brand and focused product position", "Reason for fit", "Supportable commercial detail", "Low-friction next action"]],
  ["outreach-library", "Outreach Example Library", "Communication", "Weak, better, and strong fictional outreach patterns.", ["Weak: generic praise and no account reason", "Better: names relevant category and product", "Strong: specific fit, timing, evidence, and proportionate ask"]],
  ["follow-up", "Follow-Up Sequence", "Communication", "A three-touch sequence that adds value rather than noise.", ["Touch 1: concise reminder and easy next action", "Touch 2: add useful product, timing, or availability context", "Touch 3: close the loop and preserve a future path"]],
  ["appointment", "Buyer Appointment Prep Sheet", "Communication", "Prepare facts, questions, authority, and desired outcomes.", ["Meeting objective", "Focused assortment", "Approved prices, terms, and timing", "Questions and unknowns", "Desired next action"]],
  ["meeting-notes", "Post-Meeting Notes Template", "Communication", "Preserve what happened and who owns the next step.", ["Buyer statements and requests", "Decisions versus interest", "Open questions", "Owner and due date", "Supporting documents"]],
  ["po-anatomy", "Purchase Order Anatomy", "Orders", "A field-by-field PO reference.", ["Parties, PO number, and dates", "Bill-to and ship-to", "SKU, quantity, price, extension", "Total, terms, ship window", "Special instructions"]],
  ["po-review", "Purchase Order Review Checklist", "Orders", "Verify a PO before fulfillment.", ["Match SKU and price", "Check case packs and minimums", "Recalculate extensions and total", "Confirm discounts and terms", "Resolve ship-date issues"]],
  ["order-verification", "Order Verification Worksheet", "Orders", "Document each mismatch and resolution.", ["PO value", "Governing source", "Discrepancy", "Clarification owner", "Resolved value and evidence"]],
  ["terms", "Wholesale Terms Reference", "Orders", "Educational definitions for common order language.", ["Opening minimum", "MOQ", "Case pack", "Lead time", "Ship window", "Payment terms vary by agreement"]],
  ["reorder", "Reorder Readiness Checklist", "Orders", "Review demand, inventory, timing, and availability before a reorder.", ["Current on-hand inventory", "Defined performance period", "Upcoming selling need", "Product availability", "Verified reorder document"]],
  ["account-health", "Account Health Checklist", "Performance", "Combine order, activity, payment, and relationship signals.", ["Fulfillment and payment", "Reorder behavior", "Product movement", "Buyer communication", "Clear next action"]],
  ["performance", "Commercial Performance Guide", "Performance", "Interpret metrics without claiming unsupported causes.", ["Define period and denominator", "Compare like with like", "Separate signal from cause", "Request missing context", "Choose a proportionate action"]],
  ["account-development", "Account Development Planner", "Performance", "Plan replenishment, assortment expansion, or risk follow-up.", ["Current evidence", "Development hypothesis", "Next conversation", "Required data", "Review date"]],
  ["commission", "Commission Calculation Worksheet", "Commissions", "Trace expected compensation from verified inputs.", ["Order and account", "Commissionable base", "Rate", "Split or adjustment", "Expected, approved, and paid status"]],
  ["commission-statement", "Commission Statement Anatomy", "Commissions", "Reconcile statement lines with orders and agreements.", ["Period and account", "Order reference", "Base and rate", "Adjustment", "Approval and payment status"]],
  ["records", "Commercial Records Checklist", "Commissions", "The evidence needed for explanation and reconciliation.", ["Agreement", "Original order", "Structured order record", "Returns or adjustments", "Commission decision and audit history"]],
  ["workflow-map", "Brand Placement Workflow Map", "Ryva workflow", "A complete map from research through commission and account development.", ["Brand and product readiness", "Account research and placement", "Outreach and tasks", "Order, documents, and account", "Reorder, commission, and analytics"]]
];

export const brandPlacementLibrary: ProgramLibraryResource[] = resources.map(([id, title, category, summary, items]) => ({
  id,
  title,
  category,
  summary,
  sections: [{ title: "Use this reference", body: summary }, { title: "Working checklist", items }]
}));
