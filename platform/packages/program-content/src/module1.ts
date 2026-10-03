import type {
  KnowledgeCheckQuestion,
  ProgramContentBlock,
  ProgramLearningItem
} from "./index.js";

const moduleId = "module-1";

function lesson(input: {
  id: string;
  slug: string;
  title: string;
  description: string;
  position: number;
  estimatedMinutes: number;
  blocks: ProgramContentBlock[];
  videoPlanned?: boolean;
}): ProgramLearningItem {
  const { videoPlanned: _videoPlanned, ...item } = input;
  void _videoPlanned;
  return {
    ...item,
    moduleId,
    type: "article",
    status: "published",
    required: true,
    contentVersion: 1,
    progressVersion: 1
  };
}

function knowledgeCheck(input: {
  id: string;
  slug: string;
  title: string;
  description: string;
  position: number;
  questions: KnowledgeCheckQuestion[];
}): ProgramLearningItem {
  const { questions, ...item } = input;
  return {
    ...item,
    moduleId,
    type: "knowledge_check",
    status: "published",
    required: true,
    estimatedMinutes: 4,
    contentVersion: 1,
    progressVersion: 1,
    blocks: [{
      type: "callout",
      title: "Review, then compare",
      text: "This check reinforces the section. There is no minimum score: submit every response, review the explanations, and retry whenever it would be useful."
    }],
    knowledgeCheck: {
      introduction: "Use the information available, then compare your reasoning with the section's commercial context.",
      questions
    }
  };
}

export const moduleOneItems: ProgramLearningItem[] = [
  lesson({
    id: "module-1-what-brand-placement-is",
    slug: "what-brand-placement-is",
    title: "1.1 What Brand Placement Is",
    description: "Define brand placement and see why retail fit changes the commercial question.",
    position: 1,
    estimatedMinutes: 8,
    videoPlanned: true,
    blocks: [
      { type: "heading", level: 2, text: "A commercial relationship, not only a product" },
      { type: "paragraph", text: "Brand placement is the commercial process of getting a brand's products into appropriate retail environments and developing the relationships that allow those products to remain commercially relevant there." },
      { type: "paragraph", text: "A brand can sell directly to consumers through its own site or store. Brand placement introduces another relationship: the brand sells products to a retailer, and the retailer then offers those products to its own customer." },
      { type: "pull_quote", text: "Brand placement sits between brand storytelling and commercial decision-making." },
      { type: "heading", level: 2, text: "What changes when a retailer enters the relationship" },
      { type: "paragraph", text: "A retailer is not simply deciding whether a product is attractive. It is deciding whether that product deserves space, inventory dollars, and attention within an existing assortment." },
      { type: "list", items: [
        "Whether the product fits the store and its customer",
        "Whether the price architecture makes sense",
        "Whether customers are likely to understand it",
        "How it works with the existing assortment",
        "How much inventory must be purchased and whether there is enough margin",
        "When it can ship and whether the brand can support reorders",
        "How the relationship may develop over time"
      ] },
      { type: "heading", level: 2, text: "In context: one candle, two retailers" },
      { type: "paragraph", text: "A $68 candle may look beautiful online. Northline Home may see it as a natural fit because its customer expects premium decorative objects. Juniper & Finch may like the product but determine that its typical customer prefers gifts below $50." },
      { type: "callout", title: "What changed?", text: "The product did not change. The placement context did. Commercial fit depends on the product, the brand, the retailer, the buyer, and the customer being considered together." }
    ]
  }),
  knowledgeCheck({
    id: "module-1-check-1-1",
    slug: "knowledge-check-1-1",
    title: "Knowledge Check 1.1",
    description: "Review the definition of brand placement and the role of retail fit.",
    position: 2,
    questions: [
      {
        id: "brand-placement-definition",
        type: "single_choice",
        prompt: "Which best describes brand placement?",
        options: [
          { id: "consumer-advertising", label: "Advertising a product directly to consumers" },
          { id: "commercial-relationship", label: "Connecting products with appropriate retail environments and developing the commercial relationship" },
          { id: "manufacturing", label: "Manufacturing products for a retailer" },
          { id: "social-strategy", label: "Setting a brand's social-media strategy" }
        ],
        answer: {
          optionId: "commercial-relationship",
          explanation: "Brand placement connects products with appropriate retail environments and develops the commercial relationship around that placement.",
          review: "Return to the distinction between direct consumer activity and the brand-to-retailer relationship."
        }
      },
      {
        id: "retailer-fit",
        type: "multiple_select",
        prompt: "Which factors can cause the same product to fit one retailer better than another?",
        options: [
          { id: "customer-profile", label: "Customer profile" },
          { id: "assortment", label: "Existing assortment" },
          { id: "price-architecture", label: "Price architecture" },
          { id: "category-needs", label: "Category needs" },
          { id: "inventory-strategy", label: "Inventory strategy" },
          { id: "commercial-priorities", label: "Commercial priorities" },
          { id: "commission-rate", label: "The representative's commission rate" },
          { id: "prospect-list-order", label: "The order in which accounts were added to a prospect list" }
        ],
        answer: {
          optionIds: ["customer-profile", "assortment", "price-architecture", "category-needs", "inventory-strategy", "commercial-priorities"],
          explanation: "Retail fit depends on the retailer's customer, assortment, price architecture, category needs, inventory strategy, and commercial priorities.",
          review: "Focus on the retailer context: customer, assortment, price architecture, category needs, inventory strategy, and commercial priorities."
        },
        thingsToNotice: ["Retail fit is contextual rather than a permanent quality of the product."]
      },
      {
        id: "appearance-equals-placement",
        type: "true_false",
        prompt: "If a product is attractive, it is automatically a strong retail placement.",
        answer: {
          value: false,
          explanation: "Visual appeal is only one part of commercial fit.",
          review: "Consider the retailer's customer, assortment, price architecture, inventory commitment, margin, timing, and ability to reorder."
        }
      }
    ]
  }),
  lesson({
    id: "module-1-people-in-the-relationship",
    slug: "people-in-the-relationship",
    title: "1.2 The People in the Relationship",
    description: "See how each participant views the same commercial relationship from a different perspective.",
    position: 3,
    estimatedMinutes: 8,
    videoPlanned: true,
    blocks: [
      { type: "paragraph", text: "The same product can mean something different to each participant in a placement relationship. Understanding those perspectives helps a learner interpret what each person needs to know." },
      {
        type: "relationship_visual",
        centerLabel: "The commercial relationship",
        participants: [
          { id: "brand", label: "Brand", role: "Creates and owns the product and commercial identity.", perspective: "Does this placement support how we want the brand to grow?" },
          { id: "representative", label: "Representative", role: "May build retailer relationships, communicate product information, support ordering, and maintain continuity.", perspective: "Is there a credible reason this brand and account belong together?" },
          { id: "buyer", label: "Buyer", role: "Evaluates products and makes or influences assortment decisions.", perspective: "Does this deserve space, inventory dollars, and attention?" },
          { id: "retailer", label: "Retailer / Account", role: "Purchases products for resale to its customers.", perspective: "Can this product perform with our customer?" },
          { id: "consumer", label: "Consumer", role: "Ultimately purchases the product from the retailer." }
        ]
      },
      { type: "heading", level: 2, text: "One product, different questions" },
      { type: "paragraph", text: "A brand may focus on long-term positioning. A representative considers the logic and continuity of the relationship. A buyer looks at assortment fit and inventory commitment. A retailer considers performance with its customer. The consumer encounters the product in the context the retailer created." },
      { type: "callout", title: "A useful distinction", text: "The buyer is a person or merchant function. The retailer or account is the business relationship. In a small store, an owner may perform both roles." }
    ]
  }),
  knowledgeCheck({
    id: "module-1-check-1-2",
    slug: "knowledge-check-1-2",
    title: "Knowledge Check 1.2",
    description: "Connect each participant with the perspective they commonly bring to the relationship.",
    position: 4,
    questions: [
      {
        id: "assortment-evaluator",
        type: "single_choice",
        prompt: "Who typically evaluates whether a product belongs in a retailer's assortment?",
        options: [
          { id: "consumer", label: "The consumer" },
          { id: "buyer", label: "A buyer or merchant responsible for the category" },
          { id: "manufacturer", label: "The product manufacturer alone" },
          { id: "carrier", label: "The freight carrier" }
        ],
        answer: {
          optionId: "buyer",
          explanation: "A buyer or other merchant responsible for the category commonly evaluates assortment fit.",
          review: "Distinguish the person making or influencing the assortment decision from the retailer as a business."
        }
      },
      {
        id: "decline-account",
        type: "multiple_select",
        prompt: "Which factors could give a representative a legitimate reason not to pursue an interested retailer?",
        options: [
          { id: "positioning-conflict", label: "The placement conflicts with brand positioning" },
          { id: "territory-conflict", label: "The account conflicts with territory strategy" },
          { id: "channel-conflict", label: "The retailer does not fit the brand's channel strategy" },
          { id: "exclusivity-conflict", label: "An exclusivity commitment creates a conflict" },
          { id: "pricing-conflict", label: "The retailer's pricing approach conflicts with the brand strategy" },
          { id: "long-term-fit", label: "The account does not support long-term commercial fit" },
          { id: "prompt-reply", label: "The buyer replied promptly to the introduction" },
          { id: "packaging-compliment", label: "The buyer complimented the product packaging" }
        ],
        answer: {
          optionIds: ["positioning-conflict", "territory-conflict", "channel-conflict", "exclusivity-conflict", "pricing-conflict", "long-term-fit"],
          explanation: "Interest alone does not resolve conflicts involving positioning, territory, channel, exclusivity, pricing, or long-term commercial fit.",
          review: "Look for strategic or agreement-related conflicts rather than positive signs of buyer interest."
        }
      },
      {
        id: "participant-concerns",
        type: "matching",
        prompt: "Match each participant with the concern most closely associated with its perspective.",
        left: [
          { id: "brand", label: "Brand" },
          { id: "buyer", label: "Buyer" },
          { id: "retailer", label: "Retailer" },
          { id: "representative", label: "Representative" }
        ],
        right: [
          { id: "positioning", label: "Long-term positioning" },
          { id: "assortment", label: "Assortment fit" },
          { id: "customer", label: "Customer performance" },
          { id: "strategy", label: "Relationship and placement strategy" }
        ],
        answer: {
          matches: { brand: "positioning", buyer: "assortment", retailer: "customer", representative: "strategy" },
          explanation: "Each participant sees the same relationship through a distinct commercial responsibility.",
          review: "Review the questions each participant asks in the relationship visual."
        }
      }
    ]
  }),
  lesson({
    id: "module-1-how-a-product-moves",
    slug: "how-a-product-moves",
    title: "1.3 How a Product Moves",
    description: "Follow a product from brand context through placement, order, reorder, and an ongoing account relationship.",
    position: 5,
    estimatedMinutes: 8,
    videoPlanned: true,
    blocks: [
      { type: "paragraph", text: "A commercial action makes more sense when it is placed within the larger journey. The journey provides a map, but real opportunities can pause, repeat, branch, or end at any point." },
      {
        type: "commercial_journey",
        steps: [
          { id: "brand", label: "Brand", description: "The commercial identity and relationship being represented." },
          { id: "product", label: "Product", description: "The item, SKU, assortment, price, and availability being considered." },
          { id: "prospect", label: "Prospect", description: "A retailer that may have a credible reason to consider the brand." },
          { id: "buyer", label: "Buyer", description: "The person or merchant function evaluating the opportunity." },
          { id: "placement", label: "Placement", description: "The active potential relationship between brand and retailer." },
          { id: "opening-order", label: "Opening Order", description: "The retailer's first purchase in the relationship." },
          { id: "fulfillment", label: "Fulfillment", description: "The work of confirming, shipping, and delivering what was purchased." },
          { id: "account", label: "Account", description: "The established retail relationship and its accumulated context." },
          { id: "reorder", label: "Reorder", description: "A subsequent purchase that adds evidence of continued demand." },
          { id: "ongoing", label: "Ongoing Relationship", description: "Continued communication, performance, development, and changing needs." }
        ],
        note: "This is a commercial map, not a promise of a perfectly linear path."
      },
      { type: "heading", level: 2, text: "The journey can pause or change" },
      { type: "paragraph", text: "A prospect may decline. A buyer may request more information, like the brand but wait for another season, or decide that the assortment is currently full. An opening order may perform well and reorder, or it may underperform." },
      { type: "callout", title: "Why the map matters", text: "Buyer interest is not yet a placement. A placement is not yet an order. An opening order is not yet evidence of a healthy ongoing account. Each state carries different information and a different next question." }
    ]
  }),
  knowledgeCheck({
    id: "module-1-check-1-3",
    slug: "knowledge-check-1-3",
    title: "Knowledge Check 1.3",
    description: "Review the stages and the distinctions between interest, purchase, and account health.",
    position: 6,
    questions: [
      {
        id: "interest-is-placement",
        type: "true_false",
        prompt: "Buyer interest automatically equals a placement.",
        answer: {
          value: false,
          explanation: "Interest can be meaningful, but it does not by itself establish a placement or purchase.",
          review: "Look again at the distinct prospect, buyer, placement, and opening-order stages."
        }
      },
      {
        id: "opening-order-health",
        type: "true_false",
        prompt: "An opening order automatically means an account is commercially healthy.",
        answer: {
          value: false,
          explanation: "Reorders, sell-through, communication, payment, fulfillment, and ongoing fit add important context.",
          review: "An opening order begins account history; it does not tell the entire story."
        }
      },
      {
        id: "journey-order",
        type: "ordering",
        prompt: "Put these events in a plausible commercial sequence.",
        options: [
          { id: "buyer-conversation", label: "Buyer conversation" },
          { id: "opening-order", label: "Opening order" },
          { id: "fulfillment", label: "Fulfillment" },
          { id: "reorder", label: "Reorder" }
        ],
        answer: {
          optionIds: ["buyer-conversation", "opening-order", "fulfillment", "reorder"],
          explanation: "A plausible sequence is buyer conversation, opening order, fulfillment, then reorder.",
          review: "A subsequent purchase follows the initial purchase and its fulfillment."
        }
      }
    ]
  }),
  lesson({
    id: "module-1-representation-models",
    slug: "ways-brands-are-represented",
    title: "1.4 Ways Brands Are Represented",
    description: "Compare common representation structures without treating one model as universal.",
    position: 7,
    estimatedMinutes: 8,
    videoPlanned: true,
    blocks: [
      { type: "paragraph", text: "Brands reach retail accounts through different commercial structures. The structure affects who holds relationships, who carries inventory, how responsibilities are divided, and how compensation may work." },
      {
        type: "comparison",
        columns: [
          { id: "independent", title: "Independent representative", body: "May represent one or more non-competing brands within a category, geography, or account group.", points: ["Often works across a defined portfolio", "Scope depends on the applicable agreement"] },
          { id: "agency", title: "Agency or showroom", body: "A business representing multiple brands with shared sales infrastructure or market presence.", points: ["May provide a team or common market setting", "Brand and account responsibilities vary"] },
          { id: "in-house", title: "In-house team", body: "Employees working directly for one brand.", points: ["Works within the brand organization", "Roles may still vary by territory, channel, or account"] },
          { id: "distributor", title: "Distributor", body: "Purchases or controls inventory and resells it through its own commercial relationships, depending on the model.", points: ["Inventory and resale distinguish many distributor models", "The exact arrangement still depends on the agreement"] }
        ]
      },
      { type: "heading", level: 2, text: "There is no universal structure" },
      { type: "paragraph", text: "Agreements, territories, responsibilities, compensation, and account ownership vary. Two independent representatives may work under meaningfully different commercial arrangements; two agencies may divide responsibilities differently." },
      { type: "callout", title: "Program scope", text: "The Ryva Program teaches recurring commercial concepts, not one universal employment or representation model. It does not replace review of the actual agreement governing a relationship." }
    ]
  }),
  knowledgeCheck({
    id: "module-1-check-1-4",
    slug: "knowledge-check-1-4",
    title: "Knowledge Check 1.4",
    description: "Review common representation structures and the variables that distinguish them.",
    position: 8,
    questions: [
      {
        id: "employees-model",
        type: "single_choice",
        prompt: "Which representation model involves employees working directly for a brand?",
        options: [
          { id: "independent", label: "Independent representative" },
          { id: "agency", label: "Agency or showroom" },
          { id: "in-house", label: "In-house team" },
          { id: "distributor", label: "Distributor" }
        ],
        answer: {
          optionId: "in-house",
          explanation: "An in-house team consists of employees working directly for the brand.",
          review: "Review who employs or contains the people performing the work in each structure."
        }
      },
      {
        id: "same-commission",
        type: "true_false",
        prompt: "Every independent representative uses the same commission structure.",
        answer: {
          value: false,
          explanation: "Commission structures and other commercial responsibilities vary by agreement.",
          review: "No single compensation or responsibility model applies to every independent representative."
        }
      },
      {
        id: "multiple-models",
        type: "single_choice",
        prompt: "Why is it useful to understand multiple representation models?",
        options: [
          { id: "varying-structure", label: "Responsibilities, account relationships, compensation, territory, and commercial processes can vary" },
          { id: "universal-model", label: "Every brand eventually adopts the same representation structure" },
          { id: "product-quality", label: "The representation model determines whether a product is high quality" },
          { id: "retailer-size", label: "Only large retailers need to understand who represents a brand" }
        ],
        answer: {
          optionId: "varying-structure",
          explanation: "Knowing the structure helps a learner understand who is responsible for what and which assumptions require verification.",
          review: "Representation structures can change responsibilities, account relationships, compensation, territory, and commercial processes."
        }
      }
    ]
  }),
  lesson({
    id: "module-1-relationship-not-transaction",
    slug: "placement-is-a-relationship",
    title: "1.5 Placement Is a Relationship, Not a Transaction",
    description: "Compare two account histories and see why one opening-order number cannot tell the whole commercial story.",
    position: 9,
    estimatedMinutes: 8,
    blocks: [
      { type: "paragraph", text: "The opening order matters, but it is only the first transaction in a potential account history. A larger first order does not automatically create the stronger relationship." },
      {
        type: "comparison",
        columns: [
          { id: "case-a", title: "Case A", body: "A retailer places a $9,000 opening order but never reorders.", points: ["Larger first transaction", "Reason for no reorder is unknown", "Remaining inventory and sell-through are unknown"] },
          { id: "case-b", title: "Case B", body: "A retailer places a $3,800 opening order, reorders $2,700 three months later, then adds two additional SKUs the following season.", points: ["Smaller opening transaction", "Evidence of continued purchasing", "Assortment expands over time"] }
        ]
      },
      { type: "heading", level: 2, text: "Which is the better account?" },
      { type: "paragraph", text: "The answer cannot be determined from opening-order size alone. Case A produced a larger first transaction. Case B provides evidence of continued demand and account development. More context is still needed before making a complete judgment about either account." },
      { type: "pull_quote", text: "Avoid using one number as the entire commercial story." },
      { type: "list", items: [
        "Sell-through and customer response",
        "Timing and the expected reorder window",
        "Inventory remaining",
        "Returns, cancellations, or operational issues",
        "Communication and reasons a reorder did or did not occur",
        "Whether the assortment or relationship expanded"
      ] }
    ]
  }),
  knowledgeCheck({
    id: "module-1-check-1-5",
    slug: "knowledge-check-1-5",
    title: "Knowledge Check 1.5",
    description: "Review how reorders and missing context change the interpretation of an account.",
    position: 10,
    questions: [
      {
        id: "smaller-opening-order",
        type: "multiple_select",
        prompt: "Which developments can make an account with a smaller opening order commercially important over time?",
        options: [
          { id: "sell-through", label: "Strong sell-through" },
          { id: "reorders", label: "Continued reorders" },
          { id: "assortment-expansion", label: "Assortment expansion" },
          { id: "durable-relationship", label: "A durable account relationship" },
          { id: "automatic-commission", label: "An automatically higher commission rate" },
          { id: "permanent-fit", label: "A permanent guarantee of retail fit" }
        ],
        answer: {
          optionIds: ["sell-through", "reorders", "assortment-expansion", "durable-relationship"],
          explanation: "The opening value is one point in a longer account history; sell-through, reorders, assortment expansion, and relationship durability add important context.",
          review: "Consider what can happen after the opening order rather than treating its value as the whole account story."
        }
      },
      {
        id: "case-a-context",
        type: "multiple_select",
        prompt: "Which missing information would help evaluate Case A?",
        options: [
          { id: "sell-through", label: "Sell-through" },
          { id: "customer-response", label: "Customer response" },
          { id: "returns-cancellations", label: "Returns or cancellation history" },
          { id: "reorder-timing", label: "Timing and the expected reorder window" },
          { id: "inventory-remaining", label: "Inventory remaining" },
          { id: "communication", label: "Communication and the reason no reorder occurred" },
          { id: "entry-sequence", label: "The sequence in which the order's SKUs were entered into the system" },
          { id: "po-format", label: "Whether Case B used the same purchase-order number format" }
        ],
        answer: {
          optionIds: ["sell-through", "customer-response", "returns-cancellations", "reorder-timing", "inventory-remaining", "communication"],
          explanation: "Sell-through, customer response, returns or cancellations, timing, remaining inventory, and communication can explain why no reorder occurred.",
          review: "Choose commercial context that helps explain account performance, not unrelated record-entry details."
        }
      },
      {
        id: "reorder-evidence",
        type: "single_choice",
        prompt: "What does a reorder provide evidence of?",
        options: [
          { id: "guaranteed-profit", label: "Guaranteed retailer profitability" },
          { id: "continued-demand", label: "Continued retailer demand or confidence, interpreted in context" },
          { id: "permanent-fit", label: "Permanent account fit" },
          { id: "no-more-work", label: "The relationship no longer requires attention" }
        ],
        answer: {
          optionId: "continued-demand",
          explanation: "A reorder provides evidence of continued retailer demand or confidence, although its meaning still depends on context.",
          review: "A reorder is useful evidence, not a guarantee about every aspect of account health."
        }
      }
    ]
  }),
  lesson({
    id: "module-1-ryva-commercial-map",
    slug: "ryva-workspace-preview-commercial-map",
    title: "1.6 Ryva Workspace Preview — The Commercial Map",
    description: "Explore a fictional, read-only Ryva workspace and connect each commercial record to its place in the system.",
    position: 11,
    estimatedMinutes: 12,
    blocks: [
      { type: "paragraph", text: "Ryva organizes the same commercial relationships introduced throughout this module. This preview is educational simulation content only: it uses fictional records and cannot create, edit, or expose operating-platform data." },
      {
        type: "workspace_preview",
        eyebrow: "Read-only Program simulation",
        title: "Alder & Vale × Northline Home",
        description: "A simulated commercial map showing where information belongs before any live operating access is available.",
        scenario: {
          title: "The buyer asked for updated pricing",
          facts: [
            "Alder & Vale is represented in the Northeast.",
            "Northline Home has shown interest in three products.",
            "The buyer asked for updated pricing.",
            "No opening order has been placed."
          ]
        },
        areas: [
          { id: "representation", label: "Representation", purpose: "Which brand relationship is being represented?", fictionalRecord: "Alder & Vale · Northeast representation" },
          { id: "brands", label: "Brands", purpose: "Which business owns the products?", fictionalRecord: "Alder & Vale" },
          { id: "products", label: "Products", purpose: "What is being placed?", fictionalRecord: "Ceramic candle · Incense holder · Decorative vessel" },
          { id: "businesses-buyers", label: "Businesses & Buyers", purpose: "Who may buy?", fictionalRecord: "Northline Home · Buyer record" },
          { id: "placements", label: "Placements", purpose: "Where is the active potential opportunity?", fictionalRecord: "Alder & Vale × Northline Home · Buyer reviewing" },
          { id: "outreach", label: "Outreach", purpose: "What communication has occurred?", fictionalRecord: "Pricing update requested" },
          { id: "accounts", label: "Accounts", purpose: "Which established retail relationships exist?", fictionalRecord: "No established account yet" },
          { id: "orders", label: "Orders", purpose: "What has been purchased?", fictionalRecord: "No opening order yet" },
          { id: "reorders", label: "Reorders", purpose: "What continued purchasing occurred?", fictionalRecord: "Not applicable before an opening order" },
          { id: "commissions", label: "Commissions", purpose: "What compensation may result?", fictionalRecord: "No expected commission before commissionable activity" },
          { id: "tasks", label: "Tasks", purpose: "What requires attention?", fictionalRecord: "Send updated pricing to buyer" },
          { id: "analytics", label: "Analytics & Reports", purpose: "What patterns can be seen?", fictionalRecord: "Fictional activity only; no live portfolio data" },
          { id: "documents", label: "Documents", purpose: "What supporting material exists?", fictionalRecord: "Alder & Vale line sheet · Pricing sheet" },
          { id: "transfer", label: "Data Transfer", purpose: "How can structured records move into or out of Ryva?", fictionalRecord: "Preview of mapped, validated fields" },
          { id: "settings", label: "Settings & Security", purpose: "Where are identity, preferences, sessions, and access managed?", fictionalRecord: "Program simulation · operating access locked" }
        ],
        prompts: [
          "Where would you look for the brand?",
          "Where would you look for the buyer?",
          "Where would the potential retail opportunity belong?",
          "Where would a follow-up task belong?"
        ]
      },
      { type: "callout", title: "Simulation boundary", text: "Nothing in this preview writes to Brands, Buyers, Placements, Tasks, Orders, or any other operating record. It is a reusable learning view built only from protected fictional Program content." }
    ]
  }),
  knowledgeCheck({
    id: "module-1-check-1-6",
    slug: "knowledge-check-1-6",
    title: "Knowledge Check 1.6",
    description: "Connect potential opportunities, purchases, and compensation to the appropriate Ryva areas.",
    position: 12,
    questions: [
      {
        id: "potential-opportunity",
        type: "single_choice",
        prompt: "Which Ryva area represents a potential brand-to-retailer opportunity?",
        options: [
          { id: "placements", label: "Placements" },
          { id: "orders", label: "Orders" },
          { id: "commissions", label: "Commissions" },
          { id: "settings", label: "Settings & Security" }
        ],
        answer: {
          optionId: "placements",
          explanation: "Placements represent potential brand-to-retailer opportunities.",
          review: "A potential opportunity is distinct from a completed purchase or an established account."
        }
      },
      {
        id: "completed-purchase",
        type: "single_choice",
        prompt: "Where would a completed purchase belong?",
        options: [
          { id: "outreach", label: "Outreach" },
          { id: "orders", label: "Orders" },
          { id: "tasks", label: "Tasks" },
          { id: "representation", label: "Representation" }
        ],
        answer: {
          optionId: "orders",
          explanation: "Orders hold completed purchases and their commercial detail.",
          review: "Outreach records communication; a task records an action; an order records what was purchased."
        }
      },
      {
        id: "representative-compensation",
        type: "single_choice",
        prompt: "Where would expected representative compensation belong?",
        options: [
          { id: "products", label: "Products" },
          { id: "accounts", label: "Accounts" },
          { id: "commissions", label: "Commissions" },
          { id: "documents", label: "Documents" }
        ],
        answer: {
          optionId: "commissions",
          explanation: "Expected, approved, paid, and adjusted representative compensation belongs in Commissions.",
          review: "The commission record connects compensation context to underlying commercial activity."
        }
      }
    ]
  }),
  {
    id: "module-1-map-the-relationship",
    slug: "map-the-relationship",
    moduleId,
    title: "Module 1 Guided Exercise — Map the Relationship",
    description: "Use the Lumen Ritual and Forma Beauty scenario to identify the participants, current stage, and missing information.",
    position: 13,
    type: "guided_exercise",
    status: "published",
    required: true,
    estimatedMinutes: 10,
    contentVersion: 1,
    progressVersion: 1,
    blocks: [
      { type: "heading", level: 2, text: "The scenario" },
      { type: "paragraph", text: "Lumen Ritual is a minimal botanical skincare brand represented by an independent representative. Forma Beauty's buyer is reviewing the facial oil after an introduction and has asked for updated information about testers, opening minimums, and replenishment. No purchase order has been issued." },
      { type: "callout", title: "Your task", text: "Map what is known, separate interest from an order, and identify the next information that would help you understand the opportunity." }
    ],
    activity: {
      introduction: "This is guided interpretation, not a professional-performance test. Submit your map to reveal the curriculum's Things to Notice.",
      steps: [
        {
          id: "relationship-map",
          title: "Map the relationship",
          context: "Use only the information supplied in the scenario. If something is unknown, do not invent it.",
          prompt: "Identify each part of the relationship, then explain what you would want to know next.",
          required: true,
          fields: [
            { id: "brand", type: "option_selection", label: "Brand", required: true, options: [
              { id: "lumen-ritual", label: "Lumen Ritual" }, { id: "forma-beauty", label: "Forma Beauty" }, { id: "alder-vale", label: "Alder & Vale" }
            ] },
            { id: "representative", type: "option_selection", label: "Representative", required: true, options: [
              { id: "independent-representative", label: "The independent representative for Lumen Ritual" }, { id: "forma-buyer", label: "Forma Beauty's buyer" }, { id: "consumer", label: "A consumer" }
            ] },
            { id: "retailer", type: "option_selection", label: "Retailer", required: true, options: [
              { id: "forma-beauty", label: "Forma Beauty" }, { id: "lumen-ritual", label: "Lumen Ritual" }, { id: "northline", label: "Northline Home" }
            ] },
            { id: "buyer", type: "option_selection", label: "Buyer", required: true, options: [
              { id: "forma-buyer", label: "Forma Beauty's buyer" }, { id: "representative", label: "Lumen Ritual's representative" }, { id: "brand", label: "Lumen Ritual" }
            ] },
            { id: "product", type: "option_selection", label: "Product", required: true, options: [
              { id: "facial-oil", label: "Lumen Ritual facial oil" }, { id: "ceramic-candle", label: "Alder & Vale ceramic candle" }, { id: "pet-bed", label: "Paws & Pine pet bed" }
            ] },
            { id: "stage", type: "option_selection", label: "Current stage of the relationship", required: true, options: [
              { id: "buyer-review", label: "Buyer review and information request; no order yet" }, { id: "opening-order", label: "Opening order confirmed" }, { id: "reorder", label: "Reorder underway" }
            ] },
            { id: "next-information", type: "written_response", label: "What information would you want next, and why?", required: true, maxLength: 2000 }
          ],
          considerations: [
            "A buyer request is not yet an order.",
            "Product interest and account fit are related but different.",
            "The representative needs both brand context and retailer context.",
            "The next useful action depends on what information is missing."
          ]
        }
      ]
    }
  }
];
