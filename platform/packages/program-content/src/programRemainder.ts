import type {
  AssessmentDomain,
  AssessmentQuestion,
  ActivityStep,
  KnowledgeCheckQuestion,
  ProgramContentBlock,
  ProgramLearningItem
} from "./index.js";

type ModuleId = `module-${2 | 3 | 4 | 5 | 6 | 7 | 8}`;
type Option = { id: string; label: string };

const option = (label: string, id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")): Option => ({ id, label });
const single = (id: string, prompt: string, labels: string[], correct: number, explanation: string, review = explanation): KnowledgeCheckQuestion => ({
  id, type: "single_choice", prompt, options: labels.map((label) => option(label)), answer: { optionId: option(labels[correct]!).id, explanation, review }
});
const multi = (id: string, prompt: string, labels: string[], correct: number[], explanation: string): KnowledgeCheckQuestion => ({
  id, type: "multiple_select", prompt, options: labels.map((label) => option(label)), answer: { optionIds: correct.map((index) => option(labels[index]!).id), explanation, review: explanation }
});
const truth = (id: string, prompt: string, value: boolean, explanation: string): KnowledgeCheckQuestion => ({
  id, type: "true_false", prompt, answer: { value, explanation, review: explanation }
});
const number = (id: string, prompt: string, value: number, unitLabel: string, explanation: string, tolerance = 0.01): KnowledgeCheckQuestion => ({
  id, type: "numeric_calculation", prompt, unitLabel, answer: { value, tolerance, explanation, review: explanation }
});

function section(
  moduleId: ModuleId,
  sectionNumber: string,
  title: string,
  description: string,
  blocks: ProgramContentBlock[],
  questions: KnowledgeCheckQuestion[],
  position: number
): ProgramLearningItem[] {
  const slug = title.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return [{
    id: `${moduleId}-lesson-${sectionNumber.replace(".", "-")}`,
    slug,
    moduleId,
    title: `${sectionNumber} ${title}`,
    description,
    position,
    type: "article",
    status: "published",
    required: true,
    estimatedMinutes: 10,
    contentVersion: 1,
    progressVersion: 1,
    blocks
  }, {
    id: `${moduleId}-check-${sectionNumber.replace(".", "-")}`,
    slug: `knowledge-check-${sectionNumber.replace(".", "-")}`,
    moduleId,
    title: `Knowledge Check ${sectionNumber}`,
    description: `Review ${title.toLowerCase()} in commercial context.`,
    position: position + 1,
    type: "knowledge_check",
    status: "published",
    required: true,
    estimatedMinutes: 4,
    contentVersion: 1,
    progressVersion: 1,
    blocks: [],
    knowledgeCheck: {
      introduction: "Use the information available, then compare your answer with the commercial reasoning in the lesson.",
      questions
    }
  }];
}

function activity(moduleId: ModuleId, id: string, slug: string, title: string, description: string, position: number, steps: ActivityStep[], additionalBlocks: ProgramContentBlock[] = []): ProgramLearningItem {
  return {
    id, slug, moduleId, title, description, position, type: "guided_practice", status: "published", required: true,
    estimatedMinutes: 18, contentVersion: 1, progressVersion: 1,
    blocks: [{ type: "callout", title: "Compare your reasoning", text: "Use the facts provided, make assumptions visible, and explain the tradeoffs you notice. More than one response may be reasonable." }, ...additionalBlocks],
    activity: { introduction: "Complete each required step. Your work is saved as guided practice and is not binary-graded.", steps }
  };
}

const workspace = (title: string, scenario: string, areas: Array<[string, string, string]>): ProgramContentBlock => ({
  type: "workspace_preview",
  eyebrow: "Read-only Program simulation",
  title,
  description: "Explore how the same fictional commercial context is organized across Ryva without entering the live operating platform.",
  scenario: { title: scenario, facts: ["Fictional educational records", "Read-only workspace", "Facts and assumptions remain visibly distinct"] },
  areas: areas.map(([label, purpose, record]) => ({ id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label, purpose, fictionalRecord: record })),
  prompts: ["What is known here?", "What is still missing?", "What would you pay attention to next?"]
});

const module2: ProgramLearningItem[] = [
  ...section("module-2", "2.1", "Brand Positioning in Commercial Context", "Distinguish brand identity from the commercial position a retailer must evaluate.", [
    { type: "paragraph", text: "Brand identity describes how a brand presents itself: its visual language, voice, story, and recognizable point of view. Commercial positioning adds who the brand serves, where it competes, its category and price level, what differentiates the products, and where the line can credibly belong." },
    { type: "heading", level: 2, text: "A beautiful brand is not automatically commercially ready" },
    { type: "list", items: ["Target customer and likely retail customer overlap", "Category and price level", "Meaningful product differentiation", "Consistency between the brand story and the assortment", "A credible place within the market"] },
    { type: "callout", title: "Placement question", text: "A retailer evaluates whether the story, products, prices, customer, and existing assortment make sense together—not whether the visual identity is attractive in isolation." }
  ], [
    single("identity-positioning", "Which best distinguishes identity from commercial positioning?", ["Identity is the logo; positioning is the packaging", "Identity is how the brand presents itself; positioning includes how it competes, who it serves, and where it belongs", "They are interchangeable", "Positioning is only the wholesale price"], 1, "Commercial positioning connects presentation to customer, market, category, price, competition, and placement context."),
    single("target-customer", "Why does target customer matter to placement?", ["It guarantees an order", "Retailers serve particular customer profiles, so overlap affects fit", "It replaces product information", "It determines the representative's commission"], 1, "A brand is more credible when its likely customer overlaps with the retailer's customer."),
    truth("branding-guarantee", "Strong branding guarantees strong account fit.", false, "Strong branding does not resolve customer, category, price, timing, inventory, or assortment mismatch.")
  ], 1),
  ...section("module-2", "2.2", "Products, SKUs, and Assortments", "Read a product line as a structured assortment rather than a list of unrelated objects.", [
    { type: "paragraph", text: "A product is the broader item concept. A SKU is a distinct sellable variation—such as one color, size, or scent—with its own stock-keeping identity. An assortment is the edited group of products and SKUs a brand offers or a retailer chooses." },
    { type: "comparison", columns: [
      { id: "product", title: "Product", body: "Travel pouch", points: ["The broader item concept", "May have several sellable variations"] },
      { id: "sku", title: "SKU", body: "Travel pouch · moss", points: ["One distinct variation", "Tracked and ordered operationally"] },
      { id: "assortment", title: "Assortment", body: "An intentional edit", points: ["Balances hero and supporting products", "Uses breadth and depth to fit the account"] }
    ] },
    { type: "callout", title: "Wrenfield Goods", text: "Four card-case colors, three travel pouches, two scarves, and one weekender form an assortment with category, price, and variant structure—not ten unrelated products." },
    { type: "data_table", caption: "Product, variation, and SKU", columns: ["Product", "Variation", "SKU", "Role"], rows: [["Card Case", "Moss", "WGF-CC-MOS", "Hero color"], ["Card Case", "Ink", "WGF-CC-INK", "Supporting color"], ["Travel Pouch", "Moss", "WGF-TP-MOS", "Travel category"], ["Weekender", "Sand", "WGF-WK-SND", "High-price anchor"]], note: "Each variation is orderable as its own SKU while remaining part of a connected assortment." },
    { type: "paragraph", text: "A buyer may choose only part of a line because of budget, space, customer fit, season, category need, price architecture, and the cohesion of the resulting edit." }
  ], [
    single("sku-definition", "What is a SKU?", ["A retailer account", "A distinct sellable product variation", "A seasonal budget", "A product photograph"], 1, "A SKU identifies one distinct sellable variation operationally."),
    multi("partial-line", "Why might a buyer choose only five SKUs from a 30-SKU line?", ["Budget", "Available space", "Customer fit", "Season", "Category need", "Assortment cohesion", "The alphabetical order of SKUs"], [0,1,2,3,4,5], "Buyers edit lines around customer, budget, space, timing, category need, price, and cohesion."),
    single("hero-product", "What is a hero product?", ["The cheapest SKU", "A product that strongly expresses the brand or drives attention or performance", "Every product in the line", "A discontinued sample"], 1, "A hero product gives the assortment a strong point of focus.")
  ], 3),
  ...section("module-2", "2.3", "The Line Sheet", "Use a line sheet to connect product presentation with orderable commercial information.", [
    { type: "paragraph", text: "A line sheet is a buyer-facing commercial reference. It makes the product line understandable and orderable by bringing images and descriptions together with operational facts." },
    { type: "heading", level: 2, text: "Anatomy of a useful line sheet" },
    { type: "list", items: ["Image, SKU, product name, and description", "Wholesale price and MSRP", "Available variants", "Case pack and MOQ", "Opening order minimum", "Lead time, availability, and ship window", "Terms and contact information"] },
    { type: "data_table", caption: "Annotated Wrenfield Goods line-sheet excerpt", columns: ["SKU / product", "Wholesale", "MSRP", "Variants", "Case / MOQ", "Timing"], rows: [["WGF-TP-MOS · Travel Pouch", "$28", "$62", "Moss, Ink, Clay", "Pack 4 · MOQ 4", "Available · 2-week lead"], ["WGF-CC-SND · Card Case", "$18", "$42", "Sand, Moss, Ink, Clay", "Pack 4 · MOQ 4", "Available · 2-week lead"], ["WGF-WK-SND · Weekender", "$74", "$168", "Sand, Moss", "Pack 2 · MOQ 2", "Aug 15–Sep 15 ship window"]], note: "Opening order minimum: $1,500. Terms and contact information belong with the complete line sheet." }
  ], [
    single("line-sheet-purpose", "Why is a line sheet commercially useful?", ["It replaces every buyer conversation", "It provides structured product and ordering information", "It guarantees availability", "It approves payment terms"], 1, "A line sheet supports assortment and purchase decisions with structured product and order information."),
    single("variant-field", "Which field distinguishes product variants operationally?", ["Caption", "SKU", "Brand story", "Contact title"], 1, "The SKU identifies the distinct sellable variation."),
    single("lead-time", "Why does lead time matter?", ["It calculates margin", "It shows whether inventory can arrive for the planned selling period", "It sets commission rate", "It identifies the buyer"], 1, "Timing and availability must support the retailer's planned assortment.")
  ], 5),
  ...section("module-2", "2.4", "Seasonality, Timing & Availability", "Understand why an attractive product can still be mistimed.", [
    { type: "paragraph", text: "Seasonal products depend on a narrower selling window. Evergreen products are intended to sell beyond one narrow season, but they still face launch timing, retailer planning calendars, inventory availability, and ship windows." },
    { type: "list", items: ["Seasonal and gifting periods", "Launch timing and market appointments", "Retailer planning windows and open-to-buy constraints", "Committed inventory and category saturation", "Availability, delivery windows, and replenishment"] },
    { type: "pull_quote", text: "The right product at the wrong time can still be a poor opportunity." }
  ], [
    single("evergreen", "What is an evergreen product?", ["A green-colored product", "A product intended to sell beyond a narrow seasonal window", "A product that never changes price", "A guaranteed reorder"], 1, "Evergreen describes selling relevance beyond a narrow seasonal window."),
    multi("buyer-decline", "Why might a buyer decline a product they genuinely like?", ["Timing", "Budget", "Existing inventory commitments", "Delivery window", "Category saturation", "Planning cycle", "The product has a SKU"], [0,1,2,3,4,5], "A decline can reflect timing, budget, inventory, delivery, category, or planning constraints rather than permanent lack of interest."),
    truth("buyer-no", "A buyer's no always means permanent lack of interest.", false, "A no may reflect the current season, budget, timing, availability, or assortment plan.")
  ], 7),
  ...section("module-2", "2.5", "Pricing Architecture: Wholesale Price, Retail Price, Markup & Margin", "Calculate product-level markup, margin, and gross profit dollars accurately.", [
    { type: "data_table", caption: "Alder & Vale candle pricing", columns: ["Product", "Wholesale", "MSRP", "Gross profit / unit"], rows: [["Ceramic candle", "$34", "$68", "$34"]] },
    { type: "formula", title: "Retail markup", formula: "(Retail − wholesale) ÷ wholesale", example: "($68 − $34) ÷ $34", result: "100% markup" },
    { type: "formula", title: "Retail gross margin", formula: "(Retail − wholesale) ÷ retail", example: "($68 − $34) ÷ $68", result: "50% gross margin", note: "Product-level gross margin is not the retailer's full profitability." },
    { type: "comparison", columns: [
      { id: "markup", title: "Markup", body: "(Retail − wholesale) ÷ wholesale", points: ["Compares gross profit dollars with cost"] },
      { id: "margin", title: "Gross margin", body: "(Retail − wholesale) ÷ retail", points: ["Compares gross profit dollars with selling price"] },
      { id: "profit", title: "Gross profit dollars", body: "Retail − wholesale", points: ["Before freight, markdowns, labor, rent, returns, and other expenses"] }
    ] },
    { type: "paragraph", text: "This is product-level commercial math, not retailer accounting. Actual profitability also depends on freight, markdowns, labor, rent, payment processing, damaged goods, returns, and operating expenses." }
  ], [
    number("markup", "A retailer buys a product for $25 and sells it for $50. What is the markup?", 100, "%", "The $25 gross profit is divided by the $25 cost: 100%."),
    number("margin", "A retailer buys a product for $25 and sells it for $50. What is the gross margin?", 50, "%", "The $25 gross profit is divided by the $50 selling price: 50%."),
    number("profit-dollars", "A product costs the retailer $42 and retails for $84. What are gross profit dollars per unit?", 42, "$", "$84 − $42 = $42."),
    single("markup-margin", "Why are markup and margin different?", ["Markup uses MSRP while margin uses SKU", "Markup compares profit with cost; margin compares profit with selling price", "Only markup is a percentage", "They are not different"], 1, "The denominator changes: cost for markup, selling price for margin.")
  ], 9),
  ...section("module-2", "2.6", "Minimums, Case Packs & Order Feasibility", "Test whether buyer interest can become an orderable, supportable assortment.", [
    { type: "heading", level: 2, text: "Three different constraints" },
    { type: "list", items: ["Opening order minimum: the minimum monetary value or quantity for an opening purchase", "MOQ: a minimum order quantity for a product or order", "Case pack: the required ordering multiple"] },
    { type: "callout", title: "Paws & Pine ceramic bowl", text: "$24 wholesale · case pack 4. Six units are not orderable when packs cannot be broken; the buyer may need 4 or 8. Eight units × $24 = $192." },
    { type: "paragraph", text: "Minimums matter to account fit because a retailer may like the line but lack the budget, space, or demand to support the required commitment." }
  ], [
    number("case-value", "A product wholesales for $18 with a case pack of 6. What is the line value of one case?", 108, "$", "6 × $18 = $108."),
    truth("minimum-met", "An opening minimum is $1,500 and a buyer's cart totals $1,420. The minimum has been met.", false, "$1,420 is $80 below the required opening minimum."),
    single("minimum-fit", "Why do minimums matter when evaluating account fit?", ["They determine visual identity", "The retailer may not have the budget, space, or demand for the commitment", "They eliminate the need for research", "They guarantee sell-through"], 1, "Commercial interest must still be feasible as an inventory commitment.")
  ], 11),
  ...section("module-2", "2.7", "Ryva Workspace Preview — Brands, Products, Documents & Imports", "See how product information becomes structured, validated commercial context.", [
    workspace("Brands, products, documents, and imports", "Wrenfield Goods product setup", [
      ["Brands", "Identity, representation relationship, status, and brand context.", "Wrenfield Goods · active representation"],
      ["Products", "SKU, price, category, brand, availability, and product record.", "WGF-TP-MOS · Travel Pouch · $28 wholesale"],
      ["Documents", "Line sheets, immutable originals, scan state, and supporting evidence.", "Wrenfield SS27 line sheet · original preserved"],
      ["Data Transfer", "Map and validate structured data before import.", "CSV columns mapped: Product name → name; SKU → SKU; Wholesale → wholesale price; MSRP → retail price; Category → category"]
    ]),
    { type: "callout", title: "Field-mapping practice", text: "A mock CSV uses Product name, SKU, Wholesale price, MSRP, and Category. Map each source column to the corresponding Ryva product field, then validate types before importing." }
  ], [
    single("csv-sku", "Which Ryva field should receive the source column labeled SKU?", ["Product description", "SKU", "Retailer", "Document status"], 1, "A source SKU maps to the structured SKU field."),
    multi("validate-import", "What should be validated before importing product data?", ["Required identifiers", "Numeric price fields", "Category mapping", "Duplicate SKUs", "The buyer's follower count"], [0,1,2,3], "Validation should catch missing identifiers, invalid price types, unmapped categories, and duplicate SKUs before records are created.")
  ], 13),
  activity("module-2", "module-2-field-mapping", "map-product-data", "Module 2 Guided Practice — Map Product Data", "Map a mock CSV into Ryva's product structure before import.", 15, [
    { id: "mapping", title: "Map the source fields", context: "Use the mock Wrenfield CSV and Ryva destination-field reference above.", prompt: "Choose the corresponding Ryva destination for every source field.", required: true, fields: [{ id: "fields", type: "mapping", label: "CSV field mapping", required: true, left: [option("Product name", "product-name"), option("SKU", "sku"), option("Wholesale price", "wholesale"), option("MSRP", "msrp"), option("Category", "category")], right: [option("Name", "name"), option("SKU", "sku"), option("Wholesale price", "wholesale-price"), option("Retail price", "retail-price"), option("Category", "category")] }] },
    { id: "validation", title: "Review validation", context: "Apply the import rules to the four sample rows. More than one issue may require review.", prompt: "Which issues would stop or flag the import?", required: true, fields: [{ id: "checks", type: "multi_select", label: "Validation checks", required: true, minSelections: 3, options: [option("Missing SKU"), option("Non-numeric price"), option("Duplicate SKU"), option("Unmapped category"), option("Short product name")] }], considerations: ["Mapping defines where source values belong; validation checks whether they can be trusted as structured records.", "The sample contains a missing SKU, a non-numeric wholesale price, a duplicate SKU, and an unmapped category.", "A short but meaningful product name is not automatically invalid.", "Original files should remain available as evidence after import."] }
  ], [
    { type: "data_table", caption: "Mock Wrenfield Goods CSV", columns: ["Product name", "SKU", "Wholesale price", "MSRP", "Category"], rows: [
      ["Travel Pouch · Moss", "WG-TP-MOS", "28", "62", "Travel Accessories"],
      ["Card Case · Sand", "", "18", "42", "Small Leather Goods"],
      ["Woven Scarf · Ink", "WG-SC-INK", "thirty-six", "78", "Scarves"],
      ["Gift Kit", "WG-TP-MOS", "34", "76", "Gift Sets"]
    ] },
    { type: "callout", title: "Ryva import rules", text: "Name and SKU are required. SKU values must be unique. Wholesale and retail prices must be numeric and greater than zero. Category must map to an existing Ryva category or be resolved before import. Preserve the original CSV as supporting evidence." }
  ]),
  activity("module-2", "module-2-opening-assortment", "build-an-opening-assortment", "Module 2 Guided Exercise — Build an Opening Assortment", "Create a feasible Wrenfield Goods edit for Juniper & Finch.", 16, [
    { id: "assortment", title: "Select the opening edit", context: "Budget: $2,500. Gifts should generally retail below $80. Shelf space is limited. The account is interested in travel accessories. Choose 5–8 SKUs and respect the case packs shown.", prompt: "Choose the products that create the strongest opening edit.", required: true, fields: [{ id: "skus", type: "option_selection", label: "Opening assortment focus", required: true, options: [option("Travel pouches and card cases"), option("Travel pouches, card cases, and one scarf"), option("Scarves and weekender only"), option("All twelve SKUs equally")] }] },
    { id: "build", title: "Build and calculate", prompt: "Set case-pack quantities. The builder calculates the wholesale commitment as you work.", required: true, fields: [{ id: "skus", type: "assortment_builder", label: "Wrenfield Goods opening assortment", required: true, minSkus: 5, maxSkus: 8, budget: 2500, openingMinimum: 1500, products: [
      { id: "wg-cc-sand", label: "Card Case · Sand", wholesale: 18, msrp: 42, casePack: 4 },
      { id: "wg-cc-moss", label: "Card Case · Moss", wholesale: 18, msrp: 42, casePack: 4 },
      { id: "wg-cc-ink", label: "Card Case · Ink", wholesale: 18, msrp: 42, casePack: 4 },
      { id: "wg-cc-clay", label: "Card Case · Clay", wholesale: 18, msrp: 42, casePack: 4 },
      { id: "wg-tp-moss", label: "Travel Pouch · Moss", wholesale: 28, msrp: 62, casePack: 4 },
      { id: "wg-tp-ink", label: "Travel Pouch · Ink", wholesale: 28, msrp: 62, casePack: 4 },
      { id: "wg-tp-clay", label: "Travel Pouch · Clay", wholesale: 28, msrp: 62, casePack: 4 },
      { id: "wg-sc-natural", label: "Woven Scarf · Natural", wholesale: 36, msrp: 78, casePack: 2 },
      { id: "wg-sc-ink", label: "Woven Scarf · Ink", wholesale: 36, msrp: 78, casePack: 2 },
      { id: "wg-wk-sand", label: "Weekender · Sand", wholesale: 74, msrp: 168, casePack: 2 },
      { id: "wg-wk-moss", label: "Weekender · Moss", wholesale: 74, msrp: 168, casePack: 2 },
      { id: "wg-kit", label: "Travel Gift Kit", wholesale: 34, msrp: 76, casePack: 4 }
    ] }] },
    { id: "reasoning", title: "Explain the edit", prompt: "Explain why the selected SKUs fit and what information you would still want.", required: true, fields: [{ id: "reasoning", type: "written_response", label: "Your reasoning", required: true, maxLength: 1400 }], considerations: ["A coherent edit can be stronger than maximum assortment breadth.", "Budget, case packs, shelf space, price range, and customer fit all affect feasibility.", "Missing availability or minimum information should remain visible rather than assumed."] }
  ], [{ type: "data_table", caption: "Juniper & Finch brief", columns: ["Constraint", "Requirement"], rows: [["Opening budget", "$2,500"], ["Retail preference", "Gifts below $80"], ["Space", "Limited"], ["Category interest", "Travel accessories"], ["Assortment", "5–8 SKUs"]] }])
];

const module3: ProgramLearningItem[] = [
  ...section("module-3", "3.1", "Types of Retail Accounts", "Compare account formats without treating size as a proxy for quality.", [
    { type: "paragraph", text: "Retail accounts can include independent boutiques, specialty and multi-location retailers, department stores, e-commerce retailers, concept stores, gift shops, beauty specialists, home stores, pet specialists, and hospitality-related retail." },
    { type: "callout", title: "Account quality is contextual", text: "Account type can change the buying process, assortment, order size, timing, operational requirements, and customer profile. The largest retailer is not automatically the strongest placement." }
  ], [
    single("account-type", "Why should account type influence placement strategy?", ["It fixes the commission rate", "It can affect assortment, buying process, order size, timing, requirements, and customer", "It guarantees category fit", "It replaces retailer research"], 1, "The format of the account shapes both commercial fit and operational expectations."),
    truth("largest-best", "The largest retailer is always the best placement.", false, "Fit, repeat potential, operational feasibility, positioning, and relationship quality matter alongside size.")
  ], 1),
  ...section("module-3", "3.2", "Who Is the Buyer?", "Identify assortment responsibility even when titles vary.", [
    { type: "paragraph", text: "The person responsible for assortment may be called a buyer, owner-buyer, merchant, category manager, assistant buyer, or founder/operator. In smaller businesses, one person may handle both ownership and buying." },
    { type: "pull_quote", text: "Responsibility and influence matter more than the exact title." }
  ], [
    single("buyer-title", "Why should you not assume every store has a person titled Buyer?", ["Buying is automated", "Small businesses may have owners or operators handling buying", "Titles are confidential", "Only department stores buy products"], 1, "The buying function exists even when the title differs."),
    single("buyer-role", "What matters more than the exact title?", ["The person's follower count", "Who has responsibility or influence over assortment decisions", "The length of the email signature", "The store's age"], 1, "Research should identify the decision responsibility, not search only for one title.")
  ], 3),
  ...section("module-3", "3.3", "What Buyers Consider", "Read buyer interest alongside assortment and inventory realities.", [
    { type: "list", items: ["Customer and assortment gap", "Price, margin, and inventory commitment", "Differentiation and category performance", "Minimums, delivery, and reliability", "Visual presentation and competitive overlap", "Sell-through potential, product story, and reorder availability"] },
    { type: "callout", title: "Forma Beauty", text: "Forma likes Lumen Ritual's story but already carries five facial oils. The issue may be category saturation or lack of an assortment need—not a weak product story." }
  ], [
    single("category-saturation", "Forma Beauty likes Lumen Ritual's story but already carries five facial oils. What issue may matter most?", ["The brand lacks a logo", "Category saturation or lack of assortment need", "The retailer has no customer", "The buyer cannot read a line sheet"], 1, "A strong story does not automatically create space in a saturated category.")
  ], 5),
  ...section("module-3", "3.4", "Researching an Account", "Find commercial signals rather than substituting audience size for fit.", [
    { type: "list", items: ["Categories carried and visible gaps", "Price bands and brand mix", "Number of locations and store format", "Visual point of view and customer", "Regional relevance and geography", "E-commerce presence, new openings, and current assortment"] },
    { type: "paragraph", text: "Social follower count may describe an audience but does not establish buying need, customer purchasing behavior, category fit, operational capacity, or the commercial ability to support an order." }
  ], [
    multi("fit-signals", "Which are useful account-fit signals?", ["Category", "Price architecture", "Customer", "Brand mix", "Geography", "Assortment need", "Follower count alone"], [0,1,2,3,4,5], "Fit research uses category, price, customer, brand mix, geography, format, and assortment needs together."),
    single("followers", "Why is follower count insufficient?", ["It is never public", "It does not establish buying need, purchasing behavior, category fit, or capacity", "It always understates sales", "It calculates margin"], 1, "Audience size is not a substitute for commercial research.")
  ], 7),
  ...section("module-3", "3.5", "Account Fit Matrix", "Use a visible framework without pretending the inputs are objective truth.", [
    { type: "paragraph", text: "An educational fit matrix scores customer fit, category fit, price fit, brand-positioning fit, timing, and order feasibility from 1–5. Its purpose is to expose assumptions and improve comparison." },
    { type: "callout", title: "Northline Home × Alder & Vale", text: "Customer 5 · Category 5 · Price 4 · Positioning 5 · Timing 3 · Order feasibility 4 = 26/30. The total creates structure; it does not replace judgment or missing information." }
  ], [
    single("fit-objective", "Why should a fit score not be treated as objective truth?", ["Totals cannot exceed 20", "Inputs involve judgment and incomplete information", "Only buyers can use numbers", "Scores never compare accounts"], 1, "The scoring framework makes judgments visible; it does not remove uncertainty."),
    single("fit-purpose", "What is the purpose of a fit matrix?", ["To guarantee an order", "To make assumptions visible and compare opportunities consistently", "To replace buyer research", "To determine legal territory"], 1, "The matrix structures comparison while keeping judgment explicit.")
  ], 9),
  ...section("module-3", "3.6", "Retailer Economics in Context", "Connect product-level margin with the retailer's inventory commitment.", [
    { type: "callout", title: "Inventory productivity example", text: "24 units × $30 wholesale = $720 invested. At $60 MSRP, full-price sales could total $1,440 and product gross profit dollars could total $720 before operating expenses. Markdowns on eight units would change that result." },
    { type: "paragraph", text: "The purpose is not to calculate the retailer's full profitability. It is to understand why a buyer may limit an opening order while testing customer demand." }
  ], [
    number("investment", "20 units at $28 wholesale require what inventory investment?", 560, "$", "20 × $28 = $560."),
    number("gross-sales", "If MSRP is $56 and all 20 units sell at full price, what are gross retail sales?", 1120, "$", "20 × $56 = $1,120."),
    single("smaller-opening", "Why might a retailer prefer a smaller opening order?", ["To eliminate product records", "To reduce inventory risk while testing demand", "To avoid knowing the wholesale price", "To increase case-pack size"], 1, "A smaller test can limit committed inventory while producing evidence about demand.")
  ], 11),
  ...section("module-3", "3.7", "Ryva Workspace Preview — Businesses, Buyers & Accounts", "See the distinction between a counterparty, a person, a prospect, and an established account.", [
    workspace("Businesses, buyers, and accounts", "Paws & Pine retailer research", [
      ["Businesses & Buyers", "Potential and existing commercial counterparties and the people connected to them.", "Canopy Pet Co. · buyer: Elise Morgan"],
      ["Placements", "A potential brand-to-retailer opportunity before purchase.", "Paws & Pine × Canopy Pet Co. · research"],
      ["Accounts", "The established retail relationship after commercial activity begins.", "Field House Mercantile · active account"],
      ["Activity", "Orders, reorders, notes, context, and communication across the relationship.", "Last order · next follow-up · current context"]
    ])
  ], [
    single("account-prospect", "Which record represents a potential brand-to-retailer opportunity before an established account exists?", ["Commission", "Placement", "Report", "Session"], 1, "A placement holds the potential opportunity; an account represents an established commercial relationship.")
  ], 13),
  activity("module-3", "module-3-retailer-fit", "which-retailer-fits", "Module 3 Guided Practice — Which Retailer Fits?", "Compare four fictional retailers for Paws & Pine.", 15, [
    { id: "score", title: "Make the fit assumptions visible", context: "Start with Canopy Pet Co. Use the retailer briefing above. The score is a comparison aid, not objective truth.", prompt: "Score each fit dimension from 1–5 and review the visible total.", required: true, fields: [{ id: "matrix", type: "score_matrix", label: "Canopy Pet Co. fit matrix", required: true, maxScore: 5, rows: [option("Customer fit"), option("Category fit"), option("Price fit"), option("Positioning fit"), option("Timing"), option("Order feasibility")] }] },
    { id: "rank", title: "Rank the accounts", context: "Compare the four retailer briefings using customer, category, price, positioning, timing, and order feasibility.", prompt: "Place the four accounts in investigation order.", required: true, fields: [{ id: "ranking", type: "ordering", label: "Investigation order", required: true, options: [option("Canopy Pet Co."), option("Field House Mercantile"), option("Juniper & Finch"), option("Regional pet chain")] }] },
    { id: "reason", title: "Explain tradeoffs", prompt: "Explain the top two, one account you would deprioritize, and why.", required: true, fields: [{ id: "reasoning", type: "written_response", label: "Your reasoning", required: true, maxLength: 1400 }] },
    { id: "missing", title: "Identify missing information", context: "Use the proposed opening assortment above. Show the wholesale inventory commitment, then identify what you would still need to verify before recommending an account.", prompt: "State what is missing and calculate the inventory commitment for the proposed opening assortment.", required: true, fields: [{ id: "unknowns", type: "written_response", label: "Unknowns and calculation", required: true, maxLength: 1000 }], considerations: ["Fit scores structure judgment; they do not make it objective.", "A large account can still be operationally or strategically weak.", "The proposed assortment requires an $848 wholesale inventory commitment.", "Inventory commitment should be considered alongside customer and category fit."] }
  ], [
    { type: "heading", level: 2, text: "Retailer briefing" },
    { type: "comparison", columns: [
      { id: "canopy", title: "Canopy Pet Co.", body: "Two-store premium pet specialist for design-conscious customers. Core retail range: $20–$150. The full Paws & Pine category fits, but the buyer wants a focused edit. Reviewing brands this month; can support an $800–$1,200 opening order, subject to availability and lead times." },
      { id: "field-house", title: "Field House Mercantile", body: "Seven-store regional lifestyle retailer with a small, growing pet-gift category. Most gifts retail below $75, making smaller Paws & Pine items the clearest fit. Holiday review begins in six weeks; multi-store testing requires reliable replenishment, product data, and sufficient inventory." },
      { id: "juniper", title: "Juniper & Finch", body: "Single-location gift and lifestyle boutique with limited shelf space and no permanent pet department. Most gifts retail below $80. A narrow leash, bowl, and toy-set story could work quickly, but dedicated space and post-season category plans remain unconfirmed." },
      { id: "regional-chain", title: "Regional pet chain", body: "Eighteen-store pet retailer with high category relevance and the largest order potential. Its mix spans value through premium. The next reset is four months away; a 50% retail margin, promotional participation, electronic product data, insurance, and proven fulfillment are required." }
    ] },
    { type: "data_table", caption: "Proposed Paws & Pine opening assortment", columns: ["Product", "Units", "Wholesale per unit", "MSRP"], rows: [
      ["Everyday Leash", "12", "$18", "$42"],
      ["Stoneware Bowl", "8", "$24", "$56"],
      ["Enrichment Toy Set", "12", "$16", "$38"],
      ["Woven Pet Bed", "4", "$62", "$148"]
    ] }
  ])
];

const module4: ProgramLearningItem[] = [
  ...section("module-4", "4.1", "What Makes a Placement Strategic?", "Look beyond immediate order size to the role an account can play.", [
    { type: "list", items: ["Customer fit and geographic relevance", "Brand credibility and category expansion", "Repeat potential and adjacent account opportunity", "Portfolio balance and long-term relationship"] },
    { type: "paragraph", text: "A smaller retailer can be strategically important when it has strong fit, repeat potential, regional influence, or meaningful category positioning." }
  ], [single("smaller-strategic", "Why can a smaller retailer be strategically important?", ["Small orders always have higher margins", "Strong fit, repeat potential, influence, relevance, or useful positioning", "It avoids all operational work", "It guarantees exclusivity"], 1, "Strategic value can come from fit, continuity, influence, geography, and portfolio role—not only order size.")], 1),
  ...section("module-4", "4.2", "Prioritization: Important vs. Urgent vs. Attractive", "Separate fit, probability, and commercial potential.", [
    { type: "comparison", columns: [{ id: "fit", title: "Fit", body: "How credible is the brand-account relationship?" }, { id: "probability", title: "Probability", body: "How ready or likely is movement now?" }, { id: "potential", title: "Commercial potential", body: "What could the relationship support?" }] },
    { type: "paragraph", text: "A 1–5 score for fit, readiness, and potential can organize attention, but it should not imply mathematical precision." }
  ], [single("future-opportunity", "A retailer has high fit but no budget until next quarter. Should it disappear from the pipeline?", ["Yes, immediately", "Not necessarily; it may remain a strong future opportunity with different timing", "Only if it has one location", "Only after a discount"], 1, "Fit can remain strong while present probability is limited by timing.")], 3),
  ...section("module-4", "4.3", "Territory Thinking", "Check the commercial authority around an opportunity before outreach.", [
    { type: "list", items: ["Geographic territory", "Named accounts", "Channel territory", "Exclusivity and overlap", "Account ownership"] },
    { type: "callout", title: "Agreements vary", text: "Territory may be geographic, account-based, channel-based, or otherwise defined. This lesson teaches why the context matters; it does not provide contract advice." }
  ], [
    single("territory-before-outreach", "Why does territory information matter before outreach?", ["It selects a font", "Another representative or agreement may govern the account or geography", "It guarantees buyer response", "It sets MSRP"], 1, "Authority and ownership context should be understood before contacting the account."),
    truth("territories-geographic", "All territories are geographic.", false, "Territories can also be defined by named account, channel, or other agreed scope.")
  ], 5),
  ...section("module-4", "4.4", "Channel Conflict and Placement Density", "Recognize when distribution can weaken differentiation or create retailer concern.", [
    { type: "list", items: ["Stores positioned too close together", "Directly competing retailers", "Inconsistent pricing", "Marketplace conflict", "Luxury or specialty positioning diluted by inappropriate channels"] },
    { type: "paragraph", text: "More placement is not automatically better placement. Density and channel choice affect how differentiated and commercially attractive the line remains." }
  ], [single("nearby-competitors", "What might a retailer ask if nearby competitors already carry the same brand?", ["Whether the SKU can be alphabetized", "Whether the product remains differentiated or commercially attractive locally", "Whether the buyer can become a representative", "Whether margin equals markup"], 1, "Local density can change differentiation and the retailer's reason to invest.")], 7),
  ...section("module-4", "4.5", "Timing the Opportunity", "Treat future timing as commercial information rather than automatic rejection.", [
    { type: "list", items: ["New store openings", "Seasonal buys and category resets", "Market periods and launches", "Budgets and planning calendars", "Sell-through cycles and reorder timing"] },
    { type: "pull_quote", text: "Follow up in September can be a meaningful next state, not a polite disappearance." }
  ], [single("september", "Why can “follow up in September” be commercially meaningful?", ["September always has more budget", "The buyer may be planning around a future budget, season, category review, or calendar", "It guarantees an order", "It removes the need to record the opportunity"], 1, "Timing can be a real constraint with a credible future review point.")], 9),
  ...section("module-4", "4.6", "Simple Pipeline Math", "Calculate conversion context without turning small samples into identity.", [
    { type: "callout", title: "Pipeline example", text: "40 researched · 20 contacted · 8 meaningful responses · 4 buyer conversations · 2 opening orders. Response rate = 8 ÷ 20 = 40%. Conversation-to-order = 2 ÷ 4 = 50%. Contacted-to-order = 2 ÷ 20 = 10%." },
    { type: "formula", title: "Pipeline conversion", formula: "Meaningful outcomes ÷ eligible prior-stage records", example: "8 meaningful responses ÷ 20 contacted accounts", result: "40% response rate", note: "Always name the numerator, denominator, and sample size." },
    { type: "paragraph", text: "Small samples can produce volatile percentages. Pipeline metrics provide context; they do not define a person's value or prove future performance." }
  ], [
    number("response-rate", "30 accounts are contacted and 6 provide meaningful replies. What is the response rate?", 20, "%", "6 ÷ 30 = 20%."),
    number("conversation-rate", "Six buyer conversations produce two opening orders. What is the conversation-to-order rate?", 33.3, "%", "2 ÷ 6 = 33.3%.", 0.1)
  ], 11),
  ...section("module-4", "4.7", "Ryva Workspace Preview — Representation, Placements & Tasks", "Keep relationship authority, opportunity, and next action distinct.", [
    workspace("Representation, placements, and tasks", "Alder & Vale territory review", [
      ["Representation", "The brand relationship, authority, territory, and status.", "Alder & Vale · Northeast specialty retail"],
      ["Placements", "Potential brand-to-retailer opportunities and their stage.", "Northline Home · follow up in September"],
      ["Tasks", "Concrete actions that need to happen.", "Confirm fall budget review · due Aug 28"]
    ]),
    { type: "callout", title: "Why records stay distinct", text: "A placement describes the commercial opportunity. A task describes an action. Representation supplies the relationship and authority context around both." }
  ], [single("placement-task", "Which statement is accurate?", ["A task and placement are the same record", "A placement is the opportunity; a task is an action that needs to happen", "Representation is a buyer email", "A task is an order"], 1, "Separating the opportunity from the next action preserves clearer commercial context.")], 13),
  activity("module-4", "module-4-prioritize-territory", "prioritize-a-territory", "Module 4 Guided Practice — Prioritize a Territory", "Allocate a limited weekly attention budget across ten accounts.", 15, [
    { id: "group", title: "Allocate the territory", context: "You represent Alder & Vale for Northeast specialty retail. Using the opportunity briefs above, you can actively prioritize three accounts, nurture three, and keep four at lower priority this week.", prompt: "Assign every account to an attention group.", required: true, fields: [{ id: "classification", type: "classification", label: "Territory prioritization", required: true, items: [option("Northline Home"), option("Juniper & Finch"), option("Forma Beauty"), option("Field House Mercantile"), option("Canopy Pet Co."), option("Still House"), option("Paper & Field"), option("Hearthline"), option("Edit No. 4"), option("Harbor Pet Supply")], categories: [{ ...option("Priority"), requiredCount: 3 }, { ...option("Nurture"), requiredCount: 3 }, { ...option("Lower priority"), requiredCount: 4 }] }] },
    { id: "rationale", title: "Explain the allocation", prompt: "Explain how fit, timing, probability, commercial potential, territory, and missing information shaped the groups.", required: true, fields: [{ id: "reasoning", type: "written_response", label: "Your reasoning", required: true, maxLength: 1800 }], considerations: ["Urgency, attractiveness, fit, probability, and potential are different dimensions.", "A nurture decision can preserve a strong future opportunity.", "Territory and channel constraints should be checked before effort is spent."] }
  ], [
    { type: "callout", title: "Your representation context", text: "You represent Alder & Vale for Northeast specialty retail. The brand offers design-forward home fragrance and decorative objects at $28–$96 retail. You have one focused workweek: three accounts can receive active attention, three can be nurtured, and four must remain lower priority for now." },
    { type: "heading", level: 2, text: "Territory opportunity briefing" },
    { type: "comparison", columns: [
      { id: "northline", title: "Northline Home", body: "Boston · design-led home specialist · inside territory. Strong customer, category, price, and positioning fit. The buyer reviewed the line sheet and requested a tighter ceramic edit before Friday's budget meeting. Estimated opening potential: $2,400. Need: confirm fall availability." },
      { id: "juniper", title: "Juniper & Finch", body: "Providence · independent gift and lifestyle boutique · inside territory. Giftability and price fit are strong, but shelf space is limited. The owner-buyer asked for samples and closes holiday buying in ten days. Estimated opening potential: $900. Need: confirm category space and minimum flexibility." },
      { id: "forma", title: "Forma Beauty", body: "New York · independent beauty specialist · inside geography, but home fragrance is not currently an approved category. No buyer conversation; only a general inbox is known. Estimated potential is unclear. Need: identify whether the retailer is expanding into home fragrance before outreach." },
      { id: "field-house", title: "Field House Mercantile", body: "Six Northeast locations · regional lifestyle retailer · inside territory. Strong home and gift relevance with meaningful multi-store potential. The buyer likes the ceramic series but will not review new vendors until next quarter. Estimated test potential: $5,000. Need: vendor requirements and replenishment capacity." },
      { id: "canopy", title: "Canopy Pet Co.", body: "Brooklyn and Montclair · premium pet specialist · inside territory. Design sensibility aligns, but there is no established home-fragrance category and open-flame products may be unsuitable near animals. A buyer relationship exists through Paws & Pine. Need: confirm category policy and interest before presenting Alder & Vale." },
      { id: "still-house", title: "Still House", body: "Cambridge · single-location modern home store · inside territory. Excellent brand and price fit; the buyer follows Alder & Vale but has not replied. It sits two miles from an active Northline Home location under review. Estimated opening potential: $1,600. Need: assess placement density before pursuing both." },
      { id: "paper-field", title: "Paper & Field", body: "Philadelphia · stationery, objects, and design gifts · inside territory. Incense holders and small vessels fit the assortment; candles are less certain. The buyer requested wholesale terms yesterday and is filling an immediate display gap. Estimated opening potential: $1,400. Need: recommend a focused non-candle edit." },
      { id: "hearthline", title: "Hearthline", body: "Toronto · three-store home retailer · outside the Northeast United States territory. Category and commercial fit appear strong, with estimated potential of $4,500. Another representative may hold Canadian authority. Need: verify ownership before any contact; potential alone does not authorize outreach." },
      { id: "edit-four", title: "Edit No. 4", body: "National online design marketplace · customer and price fit are strong. The account offers high reach but requests marketplace exclusivity and promotional discounts. E-commerce marketplace authority is not defined in the current representation agreement. Need: resolve channel authority and brand-positioning impact." },
      { id: "harbor-pet", title: "Harbor Pet Supply", body: "Portland, Maine · value-oriented pet retailer · inside geography but weak category, price, and positioning fit. No buyer engagement and no home category are visible. Estimated potential is low. Need: evidence of a relevant category expansion before allocating active attention." }
    ] }
  ])
];

const module5: ProgramLearningItem[] = [
  ...section("module-5", "5.1", "Have a Reason to Reach Out", "Ground outreach in relevant commercial context.", [
    { type: "comparison", columns: [{ id: "noise", title: "Generic persistence", body: "Just checking in.", points: ["Adds no new information", "Makes the message count the strategy"] }, { id: "context", title: "Relevant context", body: "The assortment now includes X, which appears relevant to Y category in your store.", points: ["Explains why now", "Connects the line to the account"] }] },
    { type: "list", items: ["New line or category", "Product launch", "Account-specific fit", "Market appointment", "Restock or new ship window", "Seasonal relevance", "Buyer request or prior conversation"] }
  ], [single("reason", "Which is stronger?", ["Generic persistence", "Relevant commercial context", "Invented urgency", "Daily message volume"], 1, "Strong outreach gives the retailer a credible reason for the message now.")], 1),
  ...section("module-5", "5.2", "The Introduction Email", "Build a concise introduction around retailer relevance and a reasonable next action.", [
    { type: "list", items: ["Why this retailer", "What the brand is", "What may be relevant", "A clear next action", "Easy access to supporting material"] },
    { type: "callout", title: "Alder & Vale for Northline Home", text: "The example connects Northline's warm-modern home mix with Alder & Vale's ceramic fragrance and objects, provides a $48–$96 retail range, points to the ceramic series, links the line sheet, and offers either a tighter edit or short introduction." },
    { type: "paragraph", text: "This is stronger than inflated claims because the message is specific, supportable, and easy for the buyer to evaluate." }
  ], [multi("specific-elements", "Which elements make the example account-specific?", ["It names Northline", "It references Northline's merchandising context", "It identifies a relevant product/category", "It claims to be the world's fastest-growing brand", "It demands an immediate response"], [0,1,2], "The message names the account, connects to its context, and identifies the part of the line that may be relevant.")], 3),
  ...section("module-5", "5.3", "Follow-Up Without Noise", "Use follow-up to add clarity, context, or timing.", [
    { type: "list", items: ["New or requested information", "Approaching market appointment", "New ship window", "Seasonal relevance", "Meaningful line update"] },
    { type: "callout", title: "Avoid noise", text: "Daily chasing, invented urgency, guilt, false prior contact, or misleading scarcity increase message count without improving commercial context." }
  ], [truth("fifth-message", "A follow-up is stronger simply because it is the fifth message.", false, "A useful follow-up adds relevant information, context, or timing.")], 5),
  ...section("module-5", "5.4", "Preparing for a Buyer Conversation", "Prepare facts, account context, and boundaries before a conversation.", [
    { type: "list", items: ["Know the retailer and relevant assortment", "Know prices, minimums, and availability", "Anticipate likely questions", "Explain why the line may belong there", "Know what you do not know"] },
    { type: "pull_quote", text: "Accurate follow-through is stronger than a confident guess." }
  ], [single("unknown-answer", "What is better than guessing when a buyer asks for information you do not have?", ["Change the subject", "Say you will confirm and follow up accurately", "Invent a likely answer", "Promise the most favorable option"], 1, "Make the unknown visible, then confirm it accurately.")], 7),
  ...section("module-5", "5.5", "Presenting an Assortment", "Lead with the relevant edit instead of narrating every product equally.", [
    { type: "list", items: ["Brand context", "Relevant category", "Hero products", "Price architecture", "Account-specific edit", "Commercial information", "Questions and buyer input"] },
    { type: "paragraph", text: "A shorter, more relevant presentation can reduce noise and make it easier for the buyer to evaluate how the line could work in the store." }
  ], [single("fewer-products", "Why can showing fewer, more relevant products be stronger than showing the entire line?", ["It hides wholesale prices", "It reduces noise and connects the edit to likely needs", "It guarantees acceptance", "It removes buyer input"], 1, "Relevance and cohesion can be more useful than exhaustive breadth.")], 9),
  ...section("module-5", "5.6", "Objections and Commercial Boundaries", "Treat objections as information about fit rather than hurdles to overpower.", [
    { type: "list", items: ["Price or margin concern", "Minimum or timing mismatch", "Category overlap or lack of space", "Uncertainty about customer demand"] },
    { type: "paragraph", text: "The goal is not to overcome every objection. Some concerns expose real incompatibility. Clarify whether a legitimate alternative exists without inventing terms or pressuring the buyer." }
  ], [single("minimum-pressure", "A retailer cannot support the brand's minimum. Is pressure the best response?", ["Yes", "No; clarify whether a legitimate alternative exists, otherwise acknowledge the mismatch", "Only after five emails", "Only for a large retailer"], 1, "A real commercial mismatch should remain visible rather than being pressured away.")], 11),
  ...section("module-5", "5.7", "Ryva Workspace Preview — Outreach & Activity", "Follow the record from reason for contact through the next action.", [workspace("Outreach and activity", "Lumen Ritual × Forma Beauty", [
    ["Outreach", "Who was contacted, why, when, and what happened.", "Introduction · ceramic facial oil tester support"],
    ["Businesses & Buyers", "The retailer and responsible commercial contact.", "Forma Beauty · category buyer"],
    ["Placements", "The opportunity that gives the outreach context.", "Lumen Ritual × Forma Beauty · buyer review"],
    ["Tasks", "The concrete next action.", "Confirm opening minimum and tester policy"]
  ])], [single("outreach-record", "Which set of questions should an outreach record answer?", ["Who, why, when, what happened, and what happens next", "Only how many emails were sent", "Only the subject line", "Only the buyer's title"], 0, "A useful record preserves actor, reason, timing, outcome, and next action.")], 13),
  activity("module-5", "module-5-write-outreach", "write-the-outreach", "Module 5 Guided Exercise — Write the Outreach", "Write a relevant introduction for Lumen Ritual and Forma Beauty.", 15, [
    { id: "message", title: "Write the introduction", context: "Use only the confirmed Lumen Ritual and Forma Beauty facts above. Do not invent performance claims, buyer interest, or flexible terms.", prompt: "Write a subject, a 90–150 word introduction, and one clear next step.", required: true, fields: [{ id: "subject", type: "written_response", label: "Subject", required: true, maxLength: 120 }, { id: "body", type: "written_response", label: "Introduction", required: true, maxLength: 1200 }, { id: "next", type: "written_response", label: "Next step", required: true, maxLength: 240 }], considerations: ["Relevance: does the message explain why this retailer?", "Specificity: does it name a useful product or category connection?", "Clarity and accuracy: are the claims supportable?", "Next action: is the request reasonable and easy to understand?"] }
  ], [
    { type: "heading", level: 2, text: "Outreach brief" },
    { type: "comparison", columns: [
      { id: "lumen", title: "Lumen Ritual", body: "Minimal botanical skincare with clean shelf presentation. Hero categories are facial oil, cleansing balm, and body serum. Retail prices run $46–$64. The opening minimum is $750, standard case packs are six, and available inventory can ship in approximately three weeks." },
      { id: "forma", title: "Forma Beauty", body: "Independent beauty retailer serving ingredient-conscious customers. It carries selective premium facial care and is reviewing the category next month. Its assortment already includes five facial oils, while cleansing and body-treatment breadth is narrower. No buyer interest has yet been recorded." }
    ] },
    { type: "data_table", caption: "Confirmed products available for outreach", columns: ["Product", "Wholesale", "MSRP", "Case pack", "Availability"], rows: [
      ["Botanical Facial Oil", "$28", "$64", "6", "Available · ships in 3 weeks"],
      ["Cleansing Balm", "$20", "$46", "6", "Available · ships in 3 weeks"],
      ["Body Serum", "$26", "$58", "6", "Available · ships in 3 weeks"]
    ], note: "A current line sheet and ingredient overview are available. A reasonable next action is to offer the material, a focused edit, or a short introductory conversation." }
  ]),
  activity("module-5", "module-5-buyer-meeting", "buyer-meeting", "Module 5 Guided Practice — Buyer Meeting", "Respond to interest, minimum questions, overlap, and a request for three hero SKUs.", 16, [
    { id: "minimum", title: "Clarify the minimum", context: "Mara says the line feels relevant but asks whether the $750 opening minimum can be reduced to fit a $600 test budget. No exception has been approved.", prompt: "What do you know, what must be confirmed, and what should you avoid promising?", required: true, fields: [{ id: "response", type: "written_response", label: "Your response", required: true, maxLength: 900 }] },
    { id: "overlap", title: "Address category overlap", context: "Forma already carries five facial oils from $52–$92. Mara says the category is crowded but cleansing and body treatment have fewer options.", prompt: "How would you explore whether there is a genuine assortment gap?", required: true, fields: [{ id: "response", type: "written_response", label: "Questions and reasoning", required: true, maxLength: 900 }] },
    { id: "heroes", title: "Present three hero SKUs", context: "Mara asks for three products that express the brand, fit Forma's customer, and can ship for next month's review.", prompt: "Choose a focused edit and state the next step.", required: true, fields: [{ id: "response", type: "written_response", label: "Edit and next step", required: true, maxLength: 900 }], considerations: ["Buyer interest is not permission to invent terms.", "The confirmed opening minimum is $750; a $600 exception would require brand approval.", "Category overlap may reveal a real mismatch or a more specific gap.", "A focused edit should connect product, price, customer, and availability."] }
  ], [
    { type: "heading", level: 2, text: "Meeting facts" },
    { type: "callout", title: "Buyer and commercial context", text: "Mara Chen buys facial care and body treatment for Forma Beauty. Forma serves ingredient-conscious customers, reviews the category next month, and can test approximately $600 initially. Lumen Ritual's confirmed opening minimum is $750; no reduced minimum has been approved. Available products ship in three weeks in case packs of six." },
    { type: "data_table", caption: "Lumen Ritual meeting line", columns: ["SKU / product", "Role in line", "Wholesale", "MSRP", "Availability"], rows: [
      ["LR-FO-01 · Botanical Facial Oil", "Signature facial treatment; strongest overlap", "$28", "$64", "Available · 3 weeks"],
      ["LR-CB-01 · Cleansing Balm", "Daily cleanser; fewer comparable Forma products", "$20", "$46", "Available · 3 weeks"],
      ["LR-BS-01 · Body Serum", "Body treatment; expands beyond facial care", "$26", "$58", "Available · 3 weeks"],
      ["LR-FM-01 · Botanical Face Mist", "Entry-price facial support product", "$16", "$36", "Available · 5 weeks"]
    ], note: "Tester support and any minimum exception still require confirmation. Do not promise either during the meeting." }
  ])
];

const module6: ProgramLearningItem[] = [
  ...section("module-6", "6.1", "Anatomy of an Order", "Read the people, dates, lines, values, and terms in an order.", [
    { type: "list", items: ["Buyer/account, PO number, and order date", "Requested ship date", "SKU, units, wholesale price, and line extension", "Discount, freight, terms, and order total", "Notes and supporting context"] },
    { type: "callout", title: "Line extension", text: "The line extension is units multiplied by the applicable unit price for that line." }
  ], [single("line-extension", "What does line extension mean?", ["The date an order ships", "Units multiplied by the applicable unit price", "The buyer's credit period", "A replacement SKU"], 1, "Each line extension is quantity × unit price.")], 1),
  ...section("module-6", "6.2", "Order Math", "Calculate lines, totals, and discounts.", [
    { type: "callout", title: "Alder & Vale example", text: "12 × $34 = $408; 12 × $34 = $408; 6 × $48 = $288; 10 × $22 = $220. Order value = $1,324. With a 5% discount: $1,324 × .95 = $1,257.80." }
  ], [
    number("line-value", "15 units × $28 equals what line value?", 420, "$", "15 × $28 = $420."),
    number("discount", "What is the value of a $2,400 order after a 10% discount?", 2160, "$", "$2,400 × .90 = $2,160."),
    number("order-total", "Three lines are $450, $610, and $325. What is the order value?", 1385, "$", "$450 + $610 + $325 = $1,385.")
  ], 3),
  ...section("module-6", "6.3", "Terms, Deposits, Freight & Ship Windows", "Interpret common order context without treating labels as universal agreements.", [
    { type: "list", items: ["Prepaid or credit card", "Deposit and balance", "Net 30", "Freight terms", "Requested ship date and ship window", "Backorder"] },
    { type: "paragraph", text: "These terms describe common commercial concepts. Their actual meaning and application depend on the applicable agreement or invoice; this lesson is not credit or contract advice." }
  ], [single("net-30", "What does Net 30 commonly indicate?", ["A 30% discount", "Payment is due within 30 days under the applicable terms", "Thirty units per case", "A 30-day ship window"], 1, "Net 30 commonly describes payment timing, subject to the actual terms.")], 5),
  ...section("module-6", "6.4", "Verifying an Order", "Check structured records against the commercial document and context.", [
    { type: "list", items: ["Buyer and account identity", "Correct SKU, quantity, and price", "Discount and terms", "Shipping context", "Duplicate entry", "Line extensions and totals"] },
    { type: "paragraph", text: "A PO is supporting evidence, but it can still contain ambiguity or errors, and a structured record can introduce new entry or interpretation errors." }
  ], [single("verify-po", "Why is order verification important even when a PO exists?", ["POs never contain totals", "Records can contain entry, pricing, quantity, duplication, or interpretation errors", "Verification changes the buyer", "It guarantees payment"], 1, "The source and the structured record must be checked against each other and the known terms.")], 7),
  ...section("module-6", "6.5", "Changes, Cancellations, Returns & Credits", "Track how later events change value and interpretation.", [
    { type: "list", items: ["Partial cancellation", "Quantity reduction", "Unavailable SKU", "Return or credit", "Damaged-goods adjustment"] },
    { type: "paragraph", text: "These changes can affect order value, account analysis, and commissionable value. The original record and the later adjustment should both remain understandable." }
  ], [number("revised-value", "An $8,000 order loses $1,200 in canceled units. What is the revised order value?", 6800, "$", "$8,000 − $1,200 = $6,800.")], 9),
  ...section("module-6", "6.6", "Reorders", "Distinguish the first purchase from continued purchasing evidence.", [
    { type: "list", items: ["Replenishing strong sellers", "Expanding assortment", "Adding variants", "Seasonal continuation"] },
    { type: "paragraph", text: "A reorder is useful evidence of continued purchasing, but it still needs timing, product, quantity, and account context." }
  ], [single("opening-reorder", "What is the difference between an opening order and a reorder?", ["Only the payment method", "An opening order begins purchasing; a reorder is subsequent purchasing activity", "A reorder never has line items", "An opening order cannot be adjusted"], 1, "The reorder adds later purchasing evidence to the account history.")], 11),
  ...section("module-6", "6.7", "Reorder & Sell-Through Math", "Connect units sold with continued account purchases.", [
    { type: "callout", title: "Eight-week example", text: "48 received and 30 sold = 62.5% sell-through. A $2,800 opening order plus a $1,650 reorder = $4,450 total purchases so far." }
    ,{ type: "formula", title: "Sell-through", formula: "Units sold ÷ units received", example: "30 ÷ 48", result: "62.5% sell-through", note: "Pair the result with its eight-week period." }
  ], [
    number("sell-through", "A retailer received 36 units and sold 27. What is sell-through?", 75, "%", "27 ÷ 36 = 75%."),
    number("total-purchases", "Opening order $3,200 plus reorder $2,100 equals what total purchases?", 5300, "$", "$3,200 + $2,100 = $5,300.")
  ], 13),
  ...section("module-6", "6.8", "Ryva Workspace Preview — Orders, Verification, Reorders & Documents", "See the order as a connected commercial record rather than one number.", [workspace("Orders, verification, reorders, and documents", "Alder & Vale opening order", [
    ["Orders", "Overview, buyer/account, dates, line items, and value.", "PO NH-1048 · $1,324 gross"],
    ["Verification", "Compare structured values with supporting evidence.", "Price, quantity, discount, terms, and total reviewed"],
    ["Reorders", "Subsequent purchases connected to the established account.", "Northline reorder · replenishment"],
    ["Documents", "Preserve the original PO and related commercial evidence.", "NH-1048.pdf · original preserved"],
    ["Commissions", "Connect eligible value with expected compensation.", "Pending order verification"]
  ])], [single("original-document", "Why preserve the original PO with the structured order?", ["To avoid line items", "To retain supporting evidence and reduce ambiguity", "To expose it publicly", "To guarantee the order total"], 1, "The original document helps explain what information was received and supports later verification.")], 15),
  activity("module-6", "module-6-verify-po", "verify-the-purchase-order", "Module 6 Guided Exercise — Verify the Purchase Order", "Review a fictional PO as one commercial document.", 17, [
    { id: "issues", title: "Identify the discrepancies", context: "Compare the document with the approved Alder & Vale line data: candles are $34 wholesale; AV-VSL-01 has a case pack of 6.", prompt: "Select every issue that requires review.", required: true, fields: [{ id: "findings", type: "multi_select", label: "PO findings", required: true, minSelections: 4, maxSelections: 4, options: [option("AV-CND-02 uses the wrong wholesale price"), option("AV-VSL-01 quantity breaks the case pack"), option("AV-CND-01 is duplicated"), option("The displayed total becomes invalid after correction"), option("The PO number is missing"), option("Every line needs a different MSRP")] }] },
    { id: "recalculate", title: "Recalculate the verified order", prompt: "After correcting AV-CND-02 to $34, changing AV-VSL-01 to 6 units, and removing the duplicate line, enter the corrected total.", required: true, fields: [{ id: "total", type: "numeric_response", label: "Corrected order total", required: true, unitLabel: "USD" }, { id: "calculation", type: "written_response", label: "Show the line extensions", required: true, maxLength: 900 }] },
    { id: "next", title: "Preserve the next action", prompt: "What should be clarified with the buyer or brand before the order is treated as verified?", required: true, fields: [{ id: "response", type: "written_response", label: "Clarifications", required: true, maxLength: 900 }], considerations: ["Compare your findings: AV-CND-02 is priced at $38 instead of $34; AV-VSL-01 uses 5 units despite a case pack of 6; AV-CND-01 is duplicated; the displayed $1,308 total does not remain valid after correction.", "With AV-CND-02 corrected to $34, AV-VSL-01 changed to 6 units, and the duplicate removed, the line values are $408 + $408 + $288 = $1,104.", "The original PO and the corrected structured record should both remain available."] }
  ], [{ type: "data_table", caption: "Fictional purchase order · PO NH-1048", columns: ["SKU", "Units", "Wholesale", "Line value"], rows: [["AV-CND-01", "12", "$34", "$408"], ["AV-CND-02", "12", "$38", "$456"], ["AV-VSL-01", "5", "$48", "$240"], ["AV-CND-01", "6", "$34", "$204"], ["Displayed total", "", "", "$1,308"]], note: "Review the source as one commercial document. The displayed arithmetic is internally consistent, but the underlying lines are not verified." }])
];

const module7: ProgramLearningItem[] = [
  ...section("module-7", "7.1", "What Happens After Placement", "Treat the opening order as the beginning of account history.", [
    { type: "list", items: ["Did inventory arrive and launch?", "What sold and what did not?", "Was there a reorder or assortment expansion?", "Did communication and payment remain healthy?", "Is the retailer still a credible fit?"] }
  ], [single("order-insufficient", "Why is “order placed” insufficient for evaluating the relationship?", ["Orders have no value", "It omits fulfillment, sell-through, reorders, payment, development, and ongoing fit", "Only commissions matter", "An order always closes the account"], 1, "The relationship continues through delivery, performance, communication, and later purchasing.")], 1),
  ...section("module-7", "7.2", "Sell-Through as Context", "Pair a sell-through percentage with time and operating context.", [
    { type: "callout", title: "Product A 80% · Product B 35%", text: "Product B should not automatically be removed. Ask how long it has been available, initial quantity, season, store placement, price, markdown, local customer, and whether replenishment was possible." },
    { type: "paragraph", text: "Sell-through = units sold ÷ units received. A percentage without its period can be deeply misleading." }
    ,{ type: "formula", title: "Sell-through", formula: "Units sold ÷ units received", example: "35 sold ÷ 50 received", result: "70% sell-through", note: "The period, starting quantity, availability, season, and placement still shape interpretation." }
  ], [single("time-period", "Why should sell-through always be paired with a time period?", ["The formula changes monthly", "Selling 50% in two weeks differs from selling 50% in twelve months", "Time determines MSRP", "It removes the denominator"], 1, "The same percentage can represent very different performance depending on elapsed selling time.")], 3),
  ...section("module-7", "7.3", "Reorder Rate", "Use an eligible denominator when interpreting continued purchasing.", [
    { type: "callout", title: "Denominator discipline", text: "If 20 active accounts have reached a reasonable reorder window and 12 reordered, reorder rate = 12 ÷ 20 = 60%. Do not count accounts that have not had a realistic opportunity to reorder." }
    ,{ type: "formula", title: "Reorder rate", formula: "Accounts that reordered ÷ eligible accounts", example: "12 ÷ 20", result: "60% reorder rate", note: "Eligibility belongs in the denominator definition." }
  ], [number("reorder-rate", "Eight of ten eligible accounts reorder. What is the reorder rate?", 80, "%", "8 ÷ 10 = 80%.")], 5),
  ...section("module-7", "7.4", "Average Order Value", "Calculate the average while watching for distortion.", [
    { type: "callout", title: "AOV example", text: "$2,500 + $4,000 + $3,500 + $6,000 = $16,000. Across four orders, AOV = $4,000." },
    { type: "formula", title: "Average order value", formula: "Total order value ÷ number of orders", example: "$16,000 ÷ 4", result: "$4,000 AOV", note: "Inspect the order distribution; one large order can distort an average." },
    { type: "paragraph", text: "AOV can rise for good or bad reasons, and one unusually large order can distort the average. Always inspect the underlying order mix." }
  ], [number("aov", "Five orders total $27,500. What is AOV?", 5500, "$", "$27,500 ÷ 5 = $5,500.")], 7),
  ...section("module-7", "7.5", "Account Growth", "Calculate period change without labeling direction automatically healthy or unhealthy.", [
    { type: "callout", title: "Growth formula", text: "(Current − prior) ÷ prior. $15,600 current versus $12,000 prior = 30% growth. A negative result needs context such as season, assortment, closures, timing, or a prior one-time order." }
    ,{ type: "formula", title: "Account growth", formula: "(Current period − prior period) ÷ prior period", example: "($15,600 − $12,000) ÷ $12,000", result: "30% growth", note: "Direction alone does not establish account health." }
  ], [number("negative-growth", "Prior purchases were $20,000 and current purchases are $17,000. What is growth?", -15, "%", "($17,000 − $20,000) ÷ $20,000 = −15%. The result describes change; context is needed to interpret health.")], 9),
  ...section("module-7", "7.6", "Portfolio Concentration", "See how much activity depends on one account.", [
    { type: "callout", title: "Concentration example", text: "$60,000 from the largest account ÷ $150,000 total portfolio purchases = 40%. The question is not whether 40% is universally unsafe, but what the portfolio would look like if that account disappeared." }
    ,{ type: "formula", title: "Portfolio concentration", formula: "Largest account purchases ÷ total portfolio purchases", example: "$60,000 ÷ $150,000", result: "40% concentration", note: "There is no universal safe percentage." }
  ], [number("concentration", "The largest account contributes $25,000 of a $100,000 portfolio. What is concentration?", 25, "%", "$25,000 ÷ $100,000 = 25%.")], 11),
  ...section("module-7", "7.7", "Account Health", "Interpret several signals rather than relying on one universal score.", [
    { type: "list", items: ["Recent order and reorder pattern", "Sell-through when available", "Communication and operational issues", "Payment context where known", "Assortment breadth and trend", "Unresolved problems"] },
    { type: "pull_quote", text: "Account health is a reasoned interpretation, not one universal score." }
  ], [multi("health-signals", "Which signals can contribute to an account-health interpretation?", ["Recent orders", "Reorder pattern", "Sell-through with a period", "Communication", "Operational issues", "Assortment trend", "One isolated follower count"], [0,1,2,3,4,5], "Account health combines purchasing, performance, communication, operations, and trend context.")], 13),
  ...section("module-7", "7.8", "Ryva Workspace Preview — Accounts, Analytics & Reports", "Move from relationship records to patterns and exportable review.", [
    workspace("Accounts, analytics, and reports", "Four-account performance review", [
      ["Accounts", "The accumulated commercial relationship record.", "Orders, reorders, communication, and current attention"],
      ["Analytics", "Patterns across products, brands, buyers, pipeline, commercial activity, and portfolio.", "AOV · reorder rate · account growth · concentration"],
      ["Reports", "Structured exportable views for deeper review.", "Account performance by period"]
    ]),
    { type: "pull_quote", text: "A dashboard tells you what happened. Commercial reasoning asks what it might mean." }
  ], [single("dashboard-reasoning", "Which statement best describes the distinction?", ["A dashboard proves why an event happened", "A dashboard shows patterns; reasoning investigates what they may mean", "Reports replace account records", "Analytics makes missing data irrelevant"], 1, "Metrics reveal patterns, but interpretation still needs time, account, product, and operating context.")], 15),
  activity("module-7", "module-7-account-attention", "which-account-needs-attention", "Module 7 Guided Practice — Which Account Needs Attention?", "Compare a large declining account, a small fast-growing account, a new opening order, and a strong reorder account with lower AOV.", 17, [
    { id: "rank", title: "Rank attention", context: "Use the same 90-day review period for all four account briefs. Attention may mean investigation, support, or opportunity—not only poor performance.", prompt: "Rank the four accounts by the attention they need now.", required: true, fields: [{ id: "ranking", type: "ordering", label: "Attention order", required: true, options: [option("Large but declining"), option("Small and fast-growing"), option("New opening order"), option("Strong reorders with lower AOV")] }] },
    { id: "explain", title: "Explain the interpretation", prompt: "Explain the signals, risks, opportunities, and assumptions behind your ranking.", required: true, fields: [{ id: "reasoning", type: "written_response", label: "Your reasoning", required: true, maxLength: 1400 }] },
    { id: "data", title: "Ask for context", prompt: "What additional data would materially change your interpretation?", required: true, fields: [{ id: "missing", type: "written_response", label: "Additional data", required: true, maxLength: 900 }], considerations: ["Attention can mean support, investigation, or opportunity—not only poor performance.", "AOV, growth, reorders, and sell-through each need a denominator or time context.", "No one metric should decide account health alone."] }
  ], [
    { type: "heading", level: 2, text: "Ninety-day account briefing" },
    { type: "comparison", columns: [
      { id: "large-declining", title: "Large but declining · Field House", body: "Purchases fell from $32,000 to $24,000 versus the prior comparable 90 days (−25%), but it remains the portfolio's largest account. Two of six locations have not reordered, one shipment arrived twelve days late, and the buyer has not explained the decline. Current sell-through data is unavailable." },
      { id: "small-growing", title: "Small and fast-growing · Juniper & Finch", body: "Purchases rose from $4,000 to $8,000 (+100%) across three orders. Eight-week sell-through is 78% on the core edit, and the buyer has requested two new SKUs. Growth is strong from a small base; available inventory and the store's capacity for a larger commitment are not yet confirmed." },
      { id: "new-opening", title: "New opening order · Paper & Field", body: "A $5,400 opening order shipped two weeks ago. The retailer has not launched the products because display fixtures arrived late. There is no meaningful sell-through or reorder window yet. The immediate question is whether the account needs launch support and whether the revised floor date is known." },
      { id: "strong-reorders", title: "Strong reorders, lower AOV · Northline Home", body: "Six reorders were placed this period versus four previously. AOV declined from $3,200 to $2,100, while total reorder value remained nearly level at $12,600 versus $12,800. Orders are more frequent and concentrated in two ceramic SKUs; stockouts, assortment narrowing, and deliberate smaller replenishment are possible explanations." }
    ] },
    { type: "callout", title: "Do not collapse the signals", text: "Field House combines scale with decline and an unresolved operating issue. Juniper combines rapid growth with a small base and capacity questions. Paper & Field is too new for performance conclusions but may need launch support. Northline's lower AOV appears alongside more frequent reorders and stable total value." }
  ])
];

const module8: ProgramLearningItem[] = [
  ...section("module-8", "8.1", "How Commission Structures Work", "Understand variation without assuming one universal compensation model.", [
    { type: "list", items: ["Percentage of commissionable sales", "Different rates by brand or account/order type", "Split commissions", "Adjustments", "Payment only after specified commercial conditions"] }
  ], [truth("same-rate-time", "Every representative earns commission at the same rate and time.", false, "Rates, bases, splits, adjustments, and payment conditions vary by arrangement.")], 1),
  ...section("module-8", "8.2", "Commission Math", "Calculate expected commission from commissionable sales and rate.", [
    { type: "callout", title: "Expected commission", text: "$8,400 commissionable sales × 12% = $1,008 expected commission." },
    { type: "formula", title: "Expected commission", formula: "Commissionable sales × commission rate", example: "$8,400 × .12", result: "$1,008 expected commission", note: "Expected is not identical to approved or paid." }
  ], [
    number("commission-1", "$5,500 at 10% equals what expected commission?", 550, "$", "$5,500 × .10 = $550."),
    number("commission-2", "$9,250 at 12% equals what expected commission?", 1110, "$", "$9,250 × .12 = $1,110."),
    number("commission-3", "$14,000 at 8% equals what expected commission?", 1120, "$", "$14,000 × .08 = $1,120.")
  ], 3),
  ...section("module-8", "8.3", "Gross Order Value vs. Commissionable Value", "Use the eligible base after cancellations or adjustments.", [
    { type: "callout", title: "Adjusted base", text: "$10,000 gross order value − $1,000 non-commissionable adjustment = $9,000 commissionable value. At 12%, expected commission is $1,080—not $1,200." }
  ], [
    number("commissionable-value", "A $7,500 order has $500 of non-commissionable value. What is the commissionable value?", 7000, "$", "$7,500 − $500 = $7,000."),
    number("adjusted-commission", "What is expected commission on that $7,000 value at 10%?", 700, "$", "$7,000 × .10 = $700.")
  ], 5),
  ...section("module-8", "8.4", "Split Commissions", "Separate the gross commission pool from each participant's share.", [
    { type: "callout", title: "Split example", text: "$6,000 commissionable sales × 12% = $720 gross commission pool. An even split is $360 each. Actual agreements vary." }
  ], [
    number("split-60", "$10,000 commissionable sales at 10% creates a $1,000 pool. What is the 60% share?", 600, "$", "$1,000 × .60 = $600."),
    number("split-40", "What is the remaining 40% share?", 400, "$", "$1,000 × .40 = $400.")
  ], 7),
  ...section("module-8", "8.5", "Expected, Approved & Paid", "Keep calculated, confirmed, and received states distinct.", [
    { type: "comparison", columns: [{ id: "expected", title: "Expected", body: "Calculated from current information." }, { id: "approved", title: "Approved", body: "Confirmed under the applicable arrangement." }, { id: "paid", title: "Paid", body: "Actually received." }] },
    { type: "paragraph", text: "Cancellations, returns, credits, timing, adjustments, disputes, and corrections can create legitimate differences between these states." }
  ], [single("expected-cash", "Why is expected commission not identical to cash received?", ["Expected commission has no formula", "Underlying orders and payment conditions may change before approval or payment", "Paid commission is always larger", "Commission cannot be adjusted"], 1, "Expected, approved, and paid represent different commercial states.")], 9),
  ...section("module-8", "8.6", "Record Accuracy, Confidentiality & Commercial Judgment", "Protect factual integrity and distinguish evidence from assumption.", [
    { type: "list", items: ["Do not invent buyer interactions or misstate orders", "Do not manipulate records", "Respect confidential business information", "Distinguish fact from assumption", "Verify before acting", "Document meaningful changes", "Avoid misleading urgency or claims"] },
    { type: "paragraph", text: "This is commercial integrity and sound recordkeeping. Program completion does not promise employment, income, or occupational status." }
  ], [truth("buyer-interested", "If a buyer has not replied, the record should say buyer interested.", false, "Interest should only be recorded when actual evidence supports that characterization.")], 11),
  ...section("module-8", "8.7", "Working in Ryva — End-to-End Commercial Workflow", "Connect the complete fictional journey across the operating map.", [
    workspace("The end-to-end Ryva commercial workflow", "Alder & Vale × Northline Home", [
      ["Representation", "Brand relationship, territory, and authority.", "Alder & Vale · active"], ["Products", "Assortment, SKU, prices, category, availability.", "Ceramic candle · AV-CND-01"], ["Businesses & Buyers", "Retailer and Mara Chen.", "Northline Home · Mara Chen"], ["Placements", "Potential relationship.", "Northline opportunity"], ["Outreach", "Introduction and buyer response.", "Ceramic series introduction"], ["Tasks", "Follow-up action.", "Send tighter product edit"], ["Orders", "Opening purchase and line values.", "PO NH-1048"], ["Documents", "Verification evidence.", "Original PO preserved"], ["Accounts", "Established relationship.", "Northline Home account"], ["Reorders", "Continued purchasing.", "Ceramic candle replenishment"], ["Commissions", "Expected and approved compensation.", "12% · approval pending"], ["Analytics", "Product, account, brand, and portfolio context.", "Sell-through and reorder patterns"], ["Reports", "Structured exportable review.", "Quarterly commercial view"], ["Data Transfer", "Validated import and export.", "Product mapping complete"], ["Settings", "Identity, preferences, sessions, access, and controls.", "Learner preview · read only"]
    ])
  ], [single("whole-workflow", "Where does a potential brand-to-retailer opportunity belong?", ["Orders", "Placements", "Commissions", "Sessions"], 1, "Placements organize potential brand-to-retailer opportunities before or alongside later commercial activity.")], 13),
  ...section("module-8", "8.8", "Interpreting the Whole System", "Separate known facts, unknowns, and differences that need explanation.", [
    { type: "callout", title: "Commercial snapshot", text: "14 active placements · 5 recent buyer conversations · 3 opening orders · 2 reorders · one large account declining · one new account growing · $4,200 expected commission · $3,650 approved · $3,100 paid." },
    { type: "list", items: ["What is known?", "What is not known?", "What would you investigate first?", "Which difference requires explanation?", "Which metric should not be interpreted alone?"] }
  ], [truth("gap-error", "The gap between expected and paid commission proves an error occurred.", false, "Timing, approval status, adjustments, and payment conditions may explain the difference. The gap deserves investigation, not a predetermined conclusion.")], 15),
  activity("module-8", "module-8-commercial-snapshot", "commercial-snapshot", "Module 8 Guided Practice — Read the Commercial Snapshot", "Interpret the whole system without collapsing it into one metric.", 17, [
    { id: "known", title: "Separate facts from unknowns", context: "Use the 90-day commercial and commission records above. A recorded count or status is a fact; the reason behind it may still be unknown.", prompt: "List what the snapshot establishes and what remains unknown.", required: true, fields: [{ id: "response", type: "written_response", label: "Known and unknown", required: true, maxLength: 1200 }] },
    { id: "investigate", title: "Choose the next investigation", context: "Consider commercial impact, time sensitivity, and which missing fact could change the next action.", prompt: "What would you investigate first, and why?", required: true, fields: [{ id: "response", type: "written_response", label: "Your reasoning", required: true, maxLength: 1000 }] },
    { id: "difference", title: "Explain the commission states", context: "Reconcile the account-level rows with the $4,200 expected, $3,650 approved, and $3,100 paid totals.", prompt: "What could explain the differences among expected, approved, and paid?", required: true, fields: [{ id: "response", type: "written_response", label: "Possible explanations", required: true, maxLength: 900 }], considerations: ["A difference is a prompt for investigation, not proof of error.", "Northline is fully paid. Field House includes a return review and an approval after the payment cutoff. Juniper includes an approved amount scheduled for the next payment cycle. Paper & Field remains partly unapproved and unpaid.", "Placement volume, order volume, account performance, and commission states answer different questions.", "The next useful action depends on which missing information could change the decision."] }
  ], [
    { type: "heading", level: 2, text: "Ninety-day commercial snapshot" },
    { type: "data_table", caption: "Pipeline and purchasing activity", columns: ["Signal", "Recorded value", "Known context"], rows: [
      ["Active placements", "14", "4 research · 3 introduction sent · 5 buyer conversation · 2 awaiting PO"],
      ["Recent buyer conversations", "5", "Three advanced to opening orders; two require a recorded follow-up"],
      ["Opening orders", "3", "$18,400 combined verified value; fulfillment status differs by account"],
      ["Reorders", "2", "$7,600 combined value; both belong to previously established accounts"],
      ["Large account", "Field House · purchases down 25%", "Shipment delay recorded; sell-through and buyer explanation are missing"],
      ["New growing account", "Juniper & Finch · purchases up 100%", "Growth is from a small base; inventory capacity is not confirmed"]
    ] },
    { type: "data_table", caption: "Commission reconciliation", columns: ["Account", "Expected", "Approved", "Paid", "Recorded status"], rows: [
      ["Northline Home", "$1,500", "$1,500", "$1,500", "Approved and paid"],
      ["Field House Mercantile", "$1,200", "$950", "$800", "$250 return review; $150 approved after payment cutoff"],
      ["Juniper & Finch", "$900", "$900", "$800", "$100 scheduled for next payment cycle"],
      ["Paper & Field", "$600", "$300", "$0", "$300 approved; $300 awaiting order adjustment review"],
      ["Total", "$4,200", "$3,650", "$3,100", "Expected, approved, and paid are distinct states"]
    ] },
    { type: "callout", title: "Questions the snapshot does not answer", text: "The records do not establish why Field House declined, whether its shipment delay caused the change, whether Juniper can sustain growth, which two conversations need the most urgent follow-up, or when unresolved commission adjustments will be decided." }
  ])
];

export const remainderModuleItems: Partial<Record<ModuleId, ProgramLearningItem[]>> = {
  "module-2": module2,
  "module-3": module3,
  "module-4": module4,
  "module-5": module5,
  "module-6": module6,
  "module-7": module7,
  "module-8": module8
};

export const finalSimulation: ProgramLearningItem = {
  id: "final-simulation", slug: "final-simulation", moduleId: "final-simulation", title: "Final Brand Placement Simulation",
  description: "Follow Cedar Row Studio from account prioritization through assortment, outreach, order, account follow-through, reorder, commission, and next-step reasoning.",
  position: 1, type: "final_simulation", status: "published", required: true, estimatedMinutes: 85, contentVersion: 1, progressVersion: 1,
  blocks: [
    { type: "heading", level: 2, text: "Cedar Row Studio" },
    { type: "paragraph", text: "Cedar Row Studio makes contemporary natural-material products for modern gifting and home environments. Its priority is to build a small group of aligned specialty accounts that can explain the materials and support replenishment. The brand does not want broad discount distribution or unsupported exclusivity promises." },
    { type: "callout", title: "Case-file rules", text: "Treat every artifact as fictional educational evidence. Facts established in one stage remain relevant later. When the file is incomplete, name the missing information rather than inventing it." },
    { type: "data_table", caption: "Brand and operating brief", columns: ["Area", "Confirmed fact", "Commercial implication"], rows: [
      ["Position", "Modern gifting and home; natural materials; $32–$68 MSRP", "Best fit may combine design sensitivity with accessible gifting"],
      ["Opening minimum", "$1,500", "A buyer's preferred $1,200 test needs discussion, not an assumed exception"],
      ["Lead time", "In-stock items: 10 business days", "Requested dates should allow allocation and fulfillment"],
      ["Replenishment", "Core items reviewed weekly; no guarantee until inventory is confirmed", "Do not promise a reorder ship date before checking"],
      ["Territory", "Northeast specialty accounts; named national accounts excluded", "Check account scope before outreach"],
      ["Commission", "12% of verified commissionable product sales; freight and tax excluded", "Order totals and commissionable base must remain distinct"]
    ] },
    { type: "data_table", caption: "Cedar Row Studio product line", columns: ["SKU / product", "Category", "Wholesale", "MSRP", "Case pack", "Availability"], rows: [
      ["CRS-101 · Stoneware Catchall", "Home / desk", "$22", "$48", "4", "In stock"],
      ["CRS-102 · Linen Desk Pouch", "Accessories", "$28", "$62", "4", "In stock"],
      ["CRS-103 · Sculptural Candle", "Home fragrance", "$26", "$58", "6", "In stock"],
      ["CRS-104 · Brass Bookmark Set", "Gift / stationery", "$14", "$32", "6", "In stock"],
      ["CRS-105 · Travel Tray", "Travel / home", "$31", "$68", "4", "Limited: confirm before order"],
      ["CRS-106 · Mini Gift Set", "Gift", "$24", "$54", "6", "In stock"]
    ], note: "Opening order minimum: $1,500. Case packs cannot be broken without brand approval." },
    { type: "heading", level: 2, text: "Account file" },
    { type: "comparison", columns: [
      { id: "still", title: "Still House", body: "Two high-design home stores; $70–$250 typical; buyer Mara Chen worries the line is too gift-oriented.", points: ["Strong visual fit", "Weak price architecture", "Known buyer"] },
      { id: "paper", title: "Paper & Field", body: "One gift, stationery, and lifestyle store; $20–$65 sweet spot; owner-buyer Jonah Reed; modest opening budgets.", points: ["Strong category and price fit", "Interested in four core products", "Usually tests near $1,200"] },
      { id: "hearth", title: "Hearthline", body: "Seven-store regional home chain; larger potential; buyer team requires dependable replenishment, insurance, and vendor documentation.", points: ["Scale potential", "Longer onboarding", "Operational readiness question"] },
      { id: "edit", title: "Edit No. 4", body: "Fashion and accessories concept; strong environment; minimal home or gift category; buyer contact not confirmed.", points: ["Aesthetic signal", "Weak visible category need", "Decision-maker unknown"] }
    ] },
    { type: "data_table", caption: "Prior contact and placement status", columns: ["Account", "Last evidence", "Current state", "Missing information"], rows: [
      ["Still House", "Sample review six weeks ago", "Buyer likes materials; questions gifting focus", "Whether a home-focused edit changes the view"],
      ["Paper & Field", "Owner-buyer replied yesterday", "Interested; asks about a smaller test", "Authority to change minimum and final SKU quantities"],
      ["Hearthline", "Vendor portal invitation", "Early qualification", "Replenishment capacity and onboarding timeline"],
      ["Edit No. 4", "Store research only", "Uncontacted", "Category plan, buyer, budget, and timing"]
    ] },
    { type: "heading", level: 2, text: "Purchase-order artifact" },
    { type: "paragraph", text: "After clarification, Paper & Field submits fictional PO PF-2048 for an approved four-SKU opening edit. Compare it with the line sheet and the approved conversation notes before accepting it." },
    { type: "data_table", caption: "PO PF-2048 · received from Paper & Field", columns: ["PO line", "SKU / product", "Quantity", "PO wholesale", "PO extension", "Case-file issue"], rows: [
      ["1", "CRS-101 · Stoneware Catchall", "24", "$22", "$528", "Matches line sheet"],
      ["2", "CRS-103 · Sculptural Candle", "22", "$26", "$572", "Quantity is not a multiple of case pack 6"],
      ["3", "CRS-104 · Brass Bookmark Set", "36", "$12", "$432", "Wrong wholesale price; approved price is $14"],
      ["4", "CRS-106 · Mini Gift Set", "24", "$24", "$576", "Product omitted from PO attachment image but present in total worksheet"],
      ["5", "Order discount", "—", "10%", "−$210.80", "Discount was requested but not approved"]
    ], note: "PO requested ship date: five business days from receipt. Standard confirmed lead time is 10 business days. Recalculate only after resolving quantity, price, omitted-line, discount, and timing issues." },
    { type: "callout", title: "Verification path", text: "Do not silently repair the buyer's document. Preserve the original, list each discrepancy, confirm the governing fact and owner, obtain a corrected PO or written resolution, and then record the verified order." },
    { type: "heading", level: 2, text: "Performance and commission file" },
    { type: "data_table", caption: "Eight-week account snapshot", columns: ["SKU", "Received", "Sold", "Visible signal", "Context still needed"], rows: [
      ["CRS-101 Catchall", "24", "18", "75% sell-through", "Stockouts, placement, returns"],
      ["CRS-103 Candle", "24", "17", "70.8% sell-through", "Tester/display, season"],
      ["CRS-104 Bookmark", "36", "30", "83.3% sell-through", "Gift timing, on-hand accuracy"],
      ["CRS-106 Gift Set", "24", "11", "45.8% sell-through", "Placement, promotion, remaining selling window"]
    ] },
    { type: "data_table", caption: "Verified reorder and commission inputs", columns: ["Record", "Confirmed input", "Use later in simulation"], rows: [
      ["Reorder", "16 catchalls × $22; 18 candles × $26; 24 bookmark sets × $14", "Verify the $1,156 reorder total"],
      ["Opening commissionable value", "$1,720", "Use the verified base, not the disputed PO total"],
      ["Total commissionable sales", "$1,720 + $1,156 = $2,876", "Apply the agreed 12% rate"],
      ["Expected commission", "$345.12", "Expected is not the same as approved or paid"]
    ] }
  ],
  activity: {
    introduction: "Complete the connected simulation in sequence. Where the curriculum allows judgment, completion depends on a substantive response—not one predetermined commercial answer.",
    steps: [
      { id: "prioritize", title: "Account prioritization", prompt: "Rank the four retailers and explain customer fit, category fit, price, order feasibility, and unknowns.", required: true, fields: [{ id: "ranking", type: "ordering", label: "Priority order", required: true, options: [option("Still House"), option("Paper & Field"), option("Hearthline"), option("Edit No. 4")] }, { id: "reasoning", type: "written_response", label: "Reasoning and unknowns", required: true, maxLength: 1600 }] },
      { id: "assortment", title: "Build the opening assortment", context: "Paper & Field prefers products below $65 retail, no more than five SKUs, requires case-pack compliance, and must meet the $1,500 minimum.", prompt: "Choose the SKU mix and case-pack quantities. The builder calculates the order value.", required: true, fields: [{ id: "selection", type: "assortment_builder", label: "Cedar Row opening assortment", required: true, minSkus: 3, maxSkus: 5, openingMinimum: 1500, products: [
        { id: "crs-101", label: "CRS-101 · Stoneware Catchall", wholesale: 22, msrp: 48, casePack: 4 },
        { id: "crs-102", label: "CRS-102 · Linen Desk Pouch", wholesale: 28, msrp: 62, casePack: 4 },
        { id: "crs-103", label: "CRS-103 · Sculptural Candle", wholesale: 26, msrp: 58, casePack: 6 },
        { id: "crs-104", label: "CRS-104 · Brass Bookmark Set", wholesale: 14, msrp: 32, casePack: 6 },
        { id: "crs-105", label: "CRS-105 · Travel Tray", wholesale: 31, msrp: 68, casePack: 4 },
        { id: "crs-106", label: "CRS-106 · Mini Gift Set", wholesale: 24, msrp: 54, casePack: 6 }
      ] }, { id: "reasoning", type: "written_response", label: "Why this edit fits", required: true, maxLength: 1000 }] },
      { id: "outreach", title: "Buyer outreach", prompt: "Write a concise introduction with a reason for fit, relevant product context, and a clear next action.", required: true, fields: [{ id: "message", type: "written_response", label: "Introduction email", required: true, maxLength: 1400 }] },
      { id: "response", title: "Buyer response", context: "The line feels relevant. The buyer usually tests near $1,200 and is most interested in the catchall, candle, bookmark set, and mini gift set.", prompt: "What matters, what should be clarified, and what would you avoid promising?", required: true, fields: [{ id: "reasoning", type: "written_response", label: "Your response", required: true, maxLength: 1400 }] },
      { id: "order-review", title: "Order review", context: "The PO includes one wrong wholesale price, one case-pack mismatch, one omitted product, and an unapproved discount.", prompt: "Identify each issue and state the clarification needed.", required: true, fields: [{ id: "issues", type: "written_response", label: "Verification findings", required: true, maxLength: 1400 }] },
      { id: "recalculate", title: "Recalculate", prompt: "Show the corrected line extensions and corrected order value.", required: true, fields: [{ id: "value", type: "written_response", label: "Corrected calculation", required: true, maxLength: 1000 }] },
      { id: "follow-through", title: "Account follow-through", context: "After eight weeks: catchalls 18/24 sold; candles 17/24; bookmarks 30/36; gift sets 11/24.", prompt: "Calculate each sell-through rate, identify the strongest reorder evidence, and name context needed before reducing the gift set.", required: true, fields: [{ id: "analysis", type: "written_response", label: "Sell-through and interpretation", required: true, maxLength: 1500 }] },
      { id: "reorder", title: "Reorder", context: "16 catchalls at $22; 18 candles at $26; 24 bookmark sets at $14.", prompt: "Calculate and record the reorder total.", required: true, fields: [{ id: "calculation", type: "written_response", label: "Reorder calculation", required: true, maxLength: 500 }] },
      { id: "commission", title: "Commission", context: "Verified opening commissionable value: $1,720. Reorder: $1,156. Rate: 12%.", prompt: "Calculate total commissionable sales and expected commission.", required: true, fields: [{ id: "calculation", type: "written_response", label: "Commission calculation", required: true, maxLength: 600 }] },
      { id: "map", title: "Ryva commercial map", prompt: "Map each record to its Ryva area.", required: true, fields: [{ id: "mapping", type: "mapping", label: "Commercial record map", required: true, left: [option("Brand record", "brand"), option("Product / SKU", "product"), option("Buyer", "buyer"), option("Opportunity", "placement"), option("Introduction email", "outreach"), option("Follow-up action", "task"), option("Opening purchase", "order"), option("Subsequent purchase", "reorder"), option("Established retailer", "account"), option("Expected compensation", "commission"), option("Original PO", "document"), option("Sell-through pattern", "analytics")], right: [option("Brands", "brands"), option("Products", "products"), option("Businesses & Buyers", "buyers"), option("Placements", "placements"), option("Outreach", "outreach"), option("Tasks", "tasks"), option("Orders", "orders"), option("Reorders", "reorders"), option("Accounts", "accounts"), option("Commissions", "commissions"), option("Documents", "documents"), option("Analytics", "analytics")] }] },
      { id: "reflection", title: "Final reflection", prompt: "Looking at the entire Cedar Row relationship, what would you pay attention to next, and why?", required: true, fields: [{ id: "response", type: "written_response", label: "Your reflection", required: true, maxLength: 1800 }], considerations: ["A strong next step is grounded in the evidence and unknowns currently available.", "The gift set's lower sell-through needs time, placement, inventory, and customer context before a final conclusion.", "The verified opening order and $1,156 reorder produce $2,876 commissionable sales and $345.12 expected commission at 12%."] }
    ]
  }
};

const assessed = (domain: AssessmentDomain, question: KnowledgeCheckQuestion): AssessmentQuestion => ({ ...question, domain });
const assessmentBank: AssessmentQuestion[] = [
  assessed("foundations", single("fa-01", "Which best describes brand placement?", ["Consumer advertising", "Connecting products with appropriate retail environments and developing the commercial relationship", "Manufacturing", "Social publishing"], 1, "Brand placement connects products, retailers, and the commercial relationship.")),
  assessed("foundations", truth("fa-02", "Buyer interest automatically establishes a placement and an order.", false, "Interest, placement, and order are distinct commercial states.")),
  assessed("foundations", single("fa-03", "Who commonly evaluates whether a product belongs in a retailer's assortment?", ["Freight carrier", "Buyer, merchant, or owner-buyer", "Consumer alone", "Payment processor"], 1, "The responsible buyer or merchant evaluates assortment fit.")),
  assessed("foundations", truth("fa-04", "An opening order alone proves an account is healthy.", false, "Fulfillment, sell-through, reorders, payment, communication, and ongoing fit add context.")),
  assessed("foundations", single("fa-05", "Which comes after an opening order in the commercial map?", ["Prospect research", "Fulfillment and account development", "Brand creation", "Territory definition only"], 1, "The relationship continues through fulfillment and account development.")),
  assessed("foundations", single("fa-06", "Which statement best distinguishes a buyer from an account?", ["They are identical", "The buyer is a person or merchant function; the account is the business relationship", "The account is always an individual", "The buyer is a document"], 1, "Person/function and business relationship are different records.")),
  assessed("foundations", truth("fa-07", "The same product can fit one retailer and not another.", true, "Customer, assortment, price, category, inventory, and priorities change fit.")),
  assessed("foundations", single("fa-08", "Which is evidence of continued purchasing?", ["A compliment", "A reorder", "An opened email", "A product photograph"], 1, "A reorder records subsequent purchasing activity.")),
  assessed("foundations", single("fa-09", "What should remain visible when information is incomplete?", ["Only the most favorable assumption", "The distinction between facts and assumptions", "A guaranteed outcome", "An invented buyer state"], 1, "Sound reasoning distinguishes evidence from assumptions.")),
  assessed("foundations", truth("fa-10", "Program completion guarantees employment or income.", false, "The Program is an educational experience and does not promise employment or income.")),

  assessed("brands_products", single("bp-01", "What is a SKU?", ["A retail account", "A distinct sellable product variation", "A ship window", "A commission rate"], 1, "A SKU identifies a distinct sellable variation.")),
  assessed("brands_products", single("bp-02", "A line has four colors of one card case. Operationally, the colors are usually what?", ["Four accounts", "Distinct SKUs", "Four terms", "One buyer"], 1, "Each sellable color variation generally has its own SKU.")),
  assessed("brands_products", single("bp-03", "Why may a buyer purchase only part of a line?", ["A line must always be complete", "Budget, space, customer, season, category need, and cohesion", "The SKU order is wrong", "The representative's title"], 1, "An opening edit must fit the account's constraints and assortment.")),
  assessed("brands_products", truth("bp-04", "A beautiful brand identity guarantees commercial readiness.", false, "Positioning, assortment, pricing, availability, and retailer fit still matter.")),
  assessed("brands_products", single("bp-05", "Which line-sheet field identifies a distinct variation?", ["Lead time", "SKU", "Terms", "Contact name"], 1, "SKU is the operational variant identifier.")),
  assessed("brands_products", single("bp-06", "Why does lead time matter?", ["It determines logo color", "It indicates whether inventory can arrive for the selling window", "It sets gross margin", "It names the buyer"], 1, "Lead time must align with the retailer's planned selling period.")),
  assessed("brands_products", single("bp-07", "Case pack is 6 and packs cannot be broken. Which quantity is valid?", ["8", "10", "12", "14"], 2, "Twelve is a multiple of six.")),
  assessed("brands_products", single("bp-08", "Which best describes an evergreen product?", ["Only sold in December", "Intended to sell beyond a narrow seasonal window", "Always in stock", "Never discounted"], 1, "Evergreen describes broad seasonal relevance, not guaranteed availability.")),
  assessed("brands_products", truth("bp-09", "A right product at the wrong time can still be a poor opportunity.", true, "Planning windows, budgets, inventory, and delivery can make timing decisive.")),
  assessed("brands_products", single("bp-10", "What is a hero product?", ["The product with the longest SKU", "A product that strongly expresses the brand or drives attention/performance", "Every variant", "A returned item"], 1, "A hero product provides a strong point of focus in the assortment.")),
  assessed("brands_products", single("bp-11", "Which field most directly tells a buyer the required ordering multiple?", ["Case pack", "MSRP", "Description", "Image"], 0, "The case pack states the ordering multiple.")),
  assessed("brands_products", truth("bp-12", "Opening-order minimum and case pack always mean the same thing.", false, "One sets a minimum opening commitment; the other sets a line ordering multiple.")),

  ...[[32,64,50],[25,50,50],[42,84,50],[30,75,60],[18,45,60],[40,80,50],[28,70,60],[36,72,50]].flatMap(([cost, retail, margin], index) => [
    assessed("pricing_math", number(`pm-${index + 1}-margin`, `Wholesale is $${cost} and retail is $${retail}. What is gross margin?`, margin!, "%", `(${retail} − ${cost}) ÷ ${retail} = ${margin}%.`, 0.1)),
    assessed("pricing_math", number(`pm-${index + 1}-markup`, `Wholesale is $${cost} and retail is $${retail}. What is markup?`, ((retail! - cost!) / cost!) * 100, "%", `(${retail} − ${cost}) ÷ ${cost} = ${((retail! - cost!) / cost!) * 100}%.`, 0.1))
  ]),

  assessed("buyers_accounts", single("ba-01", "A premium pet bed at $148 MSRP deserves strongest initial investigation with which retailer?", ["Discount stationery store", "Premium pet and home store", "Convenience store", "Beauty-only retailer"], 1, "Customer, category, and price context point to the premium pet and home store.")),
  assessed("buyers_accounts", truth("ba-02", "The largest retailer is always the best placement.", false, "Fit, feasibility, positioning, and repeat potential matter alongside size.")),
  assessed("buyers_accounts", single("ba-03", "Forma Beauty already carries five facial oils. Which issue deserves attention?", ["Category saturation", "SKU typography", "The retailer's logo", "Commission timing"], 0, "The account may lack an assortment gap in that category.")),
  assessed("buyers_accounts", single("ba-04", "What does a fit matrix primarily do?", ["Guarantees a decision", "Makes assumptions visible for more consistent comparison", "Replaces research", "Calculates commission"], 1, "A matrix structures judgment without making it objective.")),
  assessed("buyers_accounts", truth("ba-05", "Follower count alone establishes account fit and buying capacity.", false, "Commercial research needs customer, category, price, assortment, and operational context.")),
  assessed("buyers_accounts", number("ba-06", "A retailer buys 20 units at $28 wholesale. What is the inventory investment?", 560, "$", "20 × $28 = $560.")),
  assessed("buyers_accounts", number("ba-07", "Twenty units at $56 MSRP all sell at full price. What are gross retail sales?", 1120, "$", "20 × $56 = $1,120.")),
  assessed("buyers_accounts", single("ba-08", "Why might a retailer prefer a smaller opening order?", ["To reduce inventory risk while testing demand", "To hide pricing", "To remove SKUs", "To guarantee a reorder"], 0, "A smaller test reduces inventory exposure while generating demand evidence.")),
  assessed("buyers_accounts", single("ba-09", "In a small store, who may handle buying?", ["Only someone titled Buyer", "The owner or operator", "The freight carrier", "A consumer"], 1, "Titles vary; the owner or operator may hold assortment responsibility.")),
  assessed("buyers_accounts", single("ba-10", "Which information is most useful for account research?", ["Categories, price bands, customer, brand mix, geography, and gaps", "Follower count only", "Email length", "Commission rate only"], 0, "Account research combines several commercial-fit signals.")),
  assessed("buyers_accounts", truth("ba-11", "A 26/30 fit score removes the need for commercial judgment.", false, "The inputs are judgments made with incomplete information.")),
  assessed("buyers_accounts", single("ba-12", "What matters more than the exact buyer title?", ["Who owns or influences assortment decisions", "The title's length", "The email domain", "The store music"], 0, "Responsibility and influence are the useful facts.")),

  assessed("placement_strategy", single("ps-01", "A high-fit retailer has no budget until next quarter. Best interpretation?", ["Delete the opportunity", "Keep it as a future opportunity with different timing", "Offer an unapproved discount", "Record an order"], 1, "Fit can remain high while present readiness is low.")),
  assessed("placement_strategy", truth("ps-02", "All territories are geographic.", false, "Territory can also be defined by account, channel, or other scope.")),
  assessed("placement_strategy", single("ps-03", "Why check territory before outreach?", ["Another representative or agreement may govern the opportunity", "It calculates margin", "It guarantees response", "It replaces account research"], 0, "Authority and overlap should be understood before contact.")),
  assessed("placement_strategy", single("ps-04", "Several nearby competitors carry the same brand. What may concern a retailer?", ["Local differentiation", "The SKU font", "The invoice date only", "The buyer title"], 0, "Placement density can weaken local differentiation.")),
  assessed("placement_strategy", single("ps-05", "Which three dimensions support prioritization?", ["Fit, probability/readiness, commercial potential", "Logo, followers, message count", "Only urgency", "Only order size"], 0, "The dimensions separate credible fit, current probability, and possible commercial value.")),
  assessed("placement_strategy", number("ps-06", "30 contacted accounts produce 6 meaningful replies. What is response rate?", 20, "%", "6 ÷ 30 = 20%.")),
  assessed("placement_strategy", number("ps-07", "Six buyer conversations produce two orders. What is conversation-to-order rate?", 33.3, "%", "2 ÷ 6 = 33.3%.", 0.1)),
  assessed("placement_strategy", truth("ps-08", "Small-sample pipeline percentages should be interpreted as precise forecasts.", false, "Small samples can make rates volatile and misleading.")),
  assessed("placement_strategy", single("ps-09", "Which record describes the opportunity rather than the next action?", ["Task", "Placement", "Session", "Document"], 1, "A placement is the opportunity; a task is an action.")),
  assessed("placement_strategy", single("ps-10", "A smaller account may be strategic because of what?", ["Fit, repeat potential, influence, geography, or category position", "Small accounts never need terms", "Its follower count alone", "It cannot reorder"], 0, "Strategic value extends beyond immediate order size.")),

  assessed("outreach", single("ou-01", "Which introduction is strongest?", ["Just putting this on your radar", "We are the world's best", "The ceramic collection appears relevant to your design-led fragrance and tabletop assortment", "Respond ASAP"], 2, "The strongest message gives specific, supportable retailer relevance.")),
  assessed("outreach", truth("ou-02", "A fifth follow-up is stronger simply because it is the fifth.", false, "Follow-up should add context, information, or timing.")),
  assessed("outreach", single("ou-03", "A buyer asks for information you do not have. Best response?", ["Guess", "Promise the favorable answer", "Say you will confirm and follow up accurately", "Ignore the question"], 2, "Accurate follow-through is stronger than an unsupported answer.")),
  assessed("outreach", single("ou-04", "Why can a focused product edit be stronger?", ["It hides the line", "It reduces noise and connects to account needs", "It removes buyer input", "It changes terms"], 1, "A relevant edit makes the assortment easier to evaluate.")),
  assessed("outreach", single("ou-05", "A retailer cannot support the minimum. Best response?", ["Pressure the buyer", "Clarify legitimate alternatives or acknowledge the mismatch", "Invent a lower minimum", "Record an order"], 1, "Real incompatibility should not be pressured or hidden.")),
  assessed("outreach", multi("ou-06", "Which belong in a useful introduction?", ["Why this retailer", "What the brand is", "Relevant product context", "Clear next action", "Supporting material", "Invented urgency"], [0,1,2,3,4], "A clear introduction combines relevance, context, action, and evidence.")),
  assessed("outreach", multi("ou-07", "Which can make a follow-up useful?", ["Requested material", "New ship window", "Seasonal relevance", "Line update", "Daily chasing"], [0,1,2,3], "A useful follow-up adds commercially relevant information or timing.")),
  assessed("outreach", truth("ou-08", "The purpose of objection handling is to overcome every concern.", false, "Some objections expose legitimate incompatibility.")),
  assessed("outreach", single("ou-09", "Which is a reasonable next action?", ["Demand an order today", "Offer a tighter product edit or short introduction", "Claim false scarcity", "Add the buyer to an order"], 1, "The next action should be proportionate and easy to evaluate.")),
  assessed("outreach", single("ou-10", "What should an outreach record answer?", ["Who, why, when, what happened, and what happens next", "Only subject line", "Only message count", "Only account size"], 0, "The record should preserve context and next action.")),

  ...[[15,28],[12,34],[18,16],[8,44],[24,22],[30,19]].flatMap(([units, price], index) => [
    assessed("orders_reorders", number(`or-${index + 1}-line`, `${units} units at $${price} wholesale equals what line value?`, units! * price!, "$", `${units} × $${price} = $${units! * price!}.`)),
    assessed("orders_reorders", number(`or-${index + 1}-discount`, `A $${units! * price!} line receives a 10% discount. What is the discounted value?`, units! * price! * 0.9, "$", `$${units! * price!} × .90 = $${units! * price! * 0.9}.`))
  ]),

  assessed("account_performance", number("ap-01", "A retailer receives 50 units and sells 35. What is sell-through?", 70, "%", "35 ÷ 50 = 70%.")),
  assessed("account_performance", number("ap-02", "Twelve of sixteen eligible accounts reorder. What is reorder rate?", 75, "%", "12 ÷ 16 = 75%.")),
  assessed("account_performance", number("ap-03", "Five orders total $27,500. What is AOV?", 5500, "$", "$27,500 ÷ 5 = $5,500.")),
  assessed("account_performance", number("ap-04", "Prior purchases are $20,000 and current purchases are $17,000. What is growth?", -15, "%", "($17,000 − $20,000) ÷ $20,000 = −15%.")),
  assessed("account_performance", number("ap-05", "Largest account is $25,000 of a $100,000 portfolio. What is concentration?", 25, "%", "$25,000 ÷ $100,000 = 25%.")),
  assessed("account_performance", truth("ap-06", "A 35% sell-through product should always be removed immediately.", false, "Time, quantity, season, placement, price, markdown, customer, and availability matter.")),
  assessed("account_performance", truth("ap-07", "Accounts without a realistic reorder opportunity belong in the reorder-rate denominator.", false, "Use eligible accounts that reached a reasonable reorder window.")),
  assessed("account_performance", single("ap-08", "A dashboard shows what happened. What does commercial reasoning add?", ["A guaranteed cause", "Investigation of what the pattern may mean", "A promised outcome", "A new SKU"], 1, "Interpretation asks what the pattern may mean and what context is missing.")),
  assessed("account_performance", single("ap-09", "Account A opened at $8,000 with no reorder; B opened at $3,500 and reordered $2,800. Strongest conclusion?", ["A is definitely better", "B shows stronger continued purchasing evidence, but context is still needed", "B is definitely more profitable", "Opening value tells the full story"], 1, "B provides reorder evidence, while complete health still needs more context.")),
  assessed("account_performance", truth("ap-10", "There is one universally safe portfolio-concentration percentage.", false, "Concentration must be interpreted in portfolio and risk context.")),

  ...[[5500,10],[9250,12],[14000,8],[11500,10],[8000,12],[6000,12],[7200,9],[4800,15],[12500,8],[3600,10]].map(([sales, rate], index) =>
    assessed("commissions", number(`co-${index + 1}`, `$${sales} commissionable sales at ${rate}% equals what expected commission?`, sales! * rate! / 100, "$", `$${sales} × .${String(rate).padStart(2, "0")} = $${sales! * rate! / 100}.`))
  ),

  assessed("ryva_workflow", single("rw-01", "Where does a potential brand-to-retailer opportunity belong?", ["Placements", "Orders", "Sessions", "Commissions"], 0, "Placements organize potential opportunities.")),
  assessed("ryva_workflow", single("rw-02", "Where does a subsequent account purchase belong?", ["Representation", "Reorders", "Settings", "Buyer title"], 1, "Reorders hold subsequent purchasing activity.")),
  assessed("ryva_workflow", single("rw-03", "Where are original POs and line sheets preserved?", ["Tasks", "Documents", "Analytics", "Settings"], 1, "Documents preserves original supporting files and evidence.")),
  assessed("ryva_workflow", single("rw-04", "Where is structured product data mapped before import?", ["Data Transfer", "Commissions", "Accounts", "Sessions"], 0, "Data Transfer supports mapping and validation.")),
  assessed("ryva_workflow", single("rw-05", "Which area holds the brand relationship and territory context?", ["Representation", "Reports", "Reorders", "Home"], 0, "Representation holds the brand relationship and authority context.")),
  assessed("ryva_workflow", single("rw-06", "Which area holds concrete follow-up actions?", ["Tasks", "Placements", "Products", "Analytics"], 0, "Tasks records actions that need to happen.")),
  assessed("ryva_workflow", single("rw-07", "Which area shows patterns across products, brands, buyers, pipeline, and portfolio?", ["Analytics", "Documents", "Settings", "Outreach"], 0, "Analytics presents cross-record patterns.")),
  assessed("ryva_workflow", single("rw-08", "Where is buyer communication history organized?", ["Outreach", "Products", "Reorders", "Settings"], 0, "Outreach preserves commercial communication context.")),
  assessed("ryva_workflow", truth("rw-09", "The Program preview writes live commercial records to the operating platform.", false, "The learning preview is simulated and read-only.")),
  assessed("ryva_workflow", single("rw-10", "Why preserve original order records?", ["To retain supporting evidence and reduce ambiguity", "To avoid verification", "To publish buyer information", "To replace structured records"], 0, "Original evidence supports verification and later explanation.") )
];

export const finalAssessment: ProgramLearningItem = {
  id: "final-assessment", slug: "final-assessment", moduleId: "final-assessment", title: "Final Brand Placement Assessment",
  description: "Complete a mixed assessment of concepts, scenarios, calculations, and commercial interpretation. An 80% score is required for Program completion.",
  position: 2, type: "final_assessment", status: "published", required: true, estimatedMinutes: 60, contentVersion: 1, progressVersion: 1,
  blocks: [{ type: "callout", title: "50 questions · approximately 60 minutes", text: "Questions draw from the complete Program. A score below 80% leads to targeted review and a reshuffled attempt; there is no permanent failure state." }],
  knowledgeCheck: { introduction: "Answer every question. Results are shown by learning area without exposing the full live answer bank.", questions: [] },
  assessment: { questionCount: 50, passingPercentage: 80, recommendedMinutes: 60, questions: assessmentBank }
};
