import { moduleOneItems } from "./module1.js";
import { finalAssessment, finalSimulation, remainderModuleItems } from "./programRemainder.js";

export type ProgramContentStatus = "draft" | "published";

export type ProgramItemType =
  | "article"
  | "video"
  | "knowledge_check"
  | "guided_exercise"
  | "guided_practice"
  | "reflection"
  | "final_simulation"
  | "final_assessment";

export type ProgramContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string; level: 2 | 3 }
  | { type: "pull_quote"; text: string }
  | { type: "callout"; title: string; text: string }
  | { type: "list"; items: string[] }
  | { type: "formula"; title: string; formula: string; example: string; result: string; note?: string }
  | { type: "data_table"; caption: string; columns: string[]; rows: string[][]; note?: string }
  | { type: "media"; reference: string; alt: string; caption?: string }
  | {
      type: "relationship_visual";
      centerLabel: string;
      participants: Array<{ id: string; label: string; role: string; perspective?: string }>;
    }
  | {
      type: "commercial_journey";
      steps: Array<{ id: string; label: string; description: string }>;
      note: string;
    }
  | {
      type: "comparison";
      columns: Array<{ id: string; title: string; body: string; points?: string[] }>;
    }
  | {
      type: "workspace_preview";
      eyebrow: string;
      title: string;
      description: string;
      scenario: { title: string; facts: string[] };
      areas: Array<{ id: string; label: string; purpose: string; fictionalRecord: string }>;
      prompts: string[];
    }
  | { type: "divider" };

export type KnowledgeCheckQuestion =
  | {
      id: string;
      type: "single_choice";
      prompt: string;
      options: Array<{ id: string; label: string }>;
      answer: { optionId: string; explanation: string; review: string };
      thingsToNotice?: string[];
    }
  | {
      id: string;
      type: "multiple_select";
      prompt: string;
      options: Array<{ id: string; label: string }>;
      answer: { optionIds: string[]; explanation: string; review: string };
      thingsToNotice?: string[];
    }
  | {
      id: string;
      type: "true_false";
      prompt: string;
      answer: { value: boolean; explanation: string; review: string };
      thingsToNotice?: string[];
    }
  | {
      id: string;
      type: "numeric_calculation";
      prompt: string;
      unitLabel?: string;
      answer: { value: number; tolerance?: number; explanation: string; review: string };
      thingsToNotice?: string[];
    }
  | {
      id: string;
      type: "ordering";
      prompt: string;
      options: Array<{ id: string; label: string }>;
      answer: { optionIds: string[]; explanation: string; review: string };
      thingsToNotice?: string[];
    }
  | {
      id: string;
      type: "matching";
      prompt: string;
      left: Array<{ id: string; label: string }>;
      right: Array<{ id: string; label: string }>;
      answer: { matches: Record<string, string>; explanation: string; review: string };
      thingsToNotice?: string[];
    }
;

export type AssessmentDomain =
  | "foundations"
  | "brands_products"
  | "pricing_math"
  | "buyers_accounts"
  | "placement_strategy"
  | "outreach"
  | "orders_reorders"
  | "account_performance"
  | "commissions"
  | "ryva_workflow";

export type AssessmentQuestion = KnowledgeCheckQuestion & { domain: AssessmentDomain };

export type ActivityField =
  | { id: string; type: "written_response"; label: string; required: boolean; maxLength?: number }
  | { id: string; type: "numeric_response"; label: string; required: boolean; unitLabel?: string }
  | { id: string; type: "multi_select"; label: string; required: boolean; minSelections?: number; maxSelections?: number; options: Array<{ id: string; label: string }> }
  | { id: string; type: "option_selection"; label: string; required: boolean; options: Array<{ id: string; label: string }> }
  | { id: string; type: "comparison"; label: string; required: boolean; options: Array<{ id: string; label: string }> }
  | { id: string; type: "ordering"; label: string; required: boolean; options: Array<{ id: string; label: string }> }
  | { id: string; type: "mapping"; label: string; required: boolean; left: Array<{ id: string; label: string }>; right: Array<{ id: string; label: string }> }
  | { id: string; type: "score_matrix"; label: string; required: boolean; maxScore: number; rows: Array<{ id: string; label: string }> }
  | { id: string; type: "classification"; label: string; required: boolean; items: Array<{ id: string; label: string }>; categories: Array<{ id: string; label: string; requiredCount?: number }> }
  | { id: string; type: "assortment_builder"; label: string; required: boolean; minSkus: number; maxSkus: number; openingMinimum?: number; budget?: number; products: Array<{ id: string; label: string; wholesale: number; msrp: number; casePack: number }> };

export type ActivityStep = {
  id: string;
  title: string;
  context?: string;
  prompt: string;
  fields: ActivityField[];
  followUpContext?: string;
  considerations?: string[];
  required: boolean;
};

export type ProgramLearningItem = {
  id: string;
  slug: string;
  moduleId: string;
  title: string;
  description: string;
  position: number;
  type: ProgramItemType;
  status: ProgramContentStatus;
  required: boolean;
  estimatedMinutes?: number;
  contentVersion: number;
  /** Stable across equivalent written/video delivery changes so existing progress remains valid. */
  progressVersion?: number;
  blocks: ProgramContentBlock[];
  media?:
    | {
        status: "awaiting_production";
        intendedRole: "primary_explanation";
        writtenEdition: "substantive";
      }
    | {
        status: "available";
        intendedRole: "primary_explanation";
        writtenEdition: "field_notes";
        reference: string;
        posterReference?: string;
        transcript?: ProgramContentBlock[];
      }
    | {
        status: "available";
        intendedRole: "supporting";
        writtenEdition: "substantive" | "field_notes";
        reference: string;
        posterReference?: string;
        transcript?: ProgramContentBlock[];
      };
  knowledgeCheck?: {
    introduction: string;
    questions: KnowledgeCheckQuestion[];
  };
  assessment?: {
    questionCount: 50;
    passingPercentage: 80;
    recommendedMinutes: 60;
    questions: AssessmentQuestion[];
  };
  activity?: {
    introduction?: string;
    steps: ActivityStep[];
  };
};

export function itemProgressVersion(item: ProgramLearningItem): number {
  return item.progressVersion ?? item.contentVersion;
}

export type ProgramModule = {
  id: string;
  slug: string;
  title: string;
  description: string;
  position: number;
  status: ProgramContentStatus;
  items: ProgramLearningItem[];
};

export type ProgramDefinition = {
  id: string;
  slug: string;
  title: string;
  version: number;
  status: ProgramContentStatus;
  heading: string;
  description: string;
  modules: ProgramModule[];
  finalSimulation: ProgramLearningItem;
  finalAssessment?: ProgramLearningItem;
  completion: {
    enabled: boolean;
    finalSimulationItemId: string;
    finalAssessmentItemId?: string;
  };
};

const moduleDefinitions = [
  {
    id: "module-1",
    slug: "inside-brand-placement",
    title: "Inside Brand Placement",
    description: "Build a complete beginner's mental model of brand placement and the connected commercial relationship.",
    topics: ["Brands, representatives, retailers, and buyers", "Commercial relationships", "Brand placement and retail"]
  },
  {
    id: "module-2",
    slug: "brands-products-assortment",
    title: "Brands, Products, Assortment & Commercial Readiness",
    description: "See how products are considered in context rather than isolation.",
    topics: ["Product positioning and assortment", "Pricing, identity, and seasonality", "Retailer fit and line presentation"]
  },
  {
    id: "module-3",
    slug: "buyers-retail-accounts",
    title: "Buyers, Retail Accounts & Commercial Fit",
    description: "Understand the people and businesses on the other side of the relationship.",
    topics: ["Retail account types and buyer roles", "Assortment needs and account context", "Why product fit differs between retailers"]
  },
  {
    id: "module-4",
    slug: "placement-strategy",
    title: "Placement Strategy, Territory & Opportunity Prioritization",
    description: "Explore how potential accounts and placement opportunities are considered.",
    topics: ["Retail fit and placement opportunities", "Territory thinking", "Account prioritization and commercial considerations"]
  },
  {
    id: "module-5",
    slug: "brand-outreach",
    title: "Outreach, Buyer Communication & Appointments",
    description: "Explore how commercial relationships begin and develop through communication.",
    topics: ["Introductions and buyer communication", "Follow-up and appointment preparation", "A commercial reason to reach out"]
  },
  {
    id: "module-6",
    slug: "orders-reorders",
    title: "Orders, Terms, Fulfillment & Reorders",
    description: "Understand what happens when a retailer buys and how the relationship continues.",
    topics: ["Opening orders and order value", "Fulfillment context", "Reorders and account continuity"]
  },
  {
    id: "module-7",
    slug: "commercial-relationships",
    title: "Account Development, Sell-Through & Commercial Performance",
    description: "See brand placement as a continuing commercial relationship rather than one transaction.",
    topics: ["Account development and continuity", "Follow-through", "Changing needs and commercial judgment"]
  },
  {
    id: "module-8",
    slug: "commission-structure",
    title: "Commissions, Commercial Judgment & Working in Ryva",
    description: "Explore how representatives may be compensated within wholesale and brand-placement relationships.",
    topics: ["Commission structures and rates", "Commissionable value and payment timing", "Adjustments and differences from order value"]
  }
] as const;

function draftItems(moduleId: string, topics: readonly string[]): ProgramLearningItem[] {
  return topics.map((topic, index) => ({
    id: `${moduleId}-draft-${index + 1}`,
    slug: `draft-${index + 1}`,
    moduleId,
    title: `Draft: ${topic}`,
    description: "Editorial lesson content is awaiting review.",
    position: index + 1,
    type: index === topics.length - 1 ? "reflection" : "article",
    status: "draft",
    required: true,
    estimatedMinutes: 8,
    contentVersion: 1,
    blocks: []
  }));
}

const modules: ProgramModule[] = moduleDefinitions.map((module, index) => ({
  id: module.id,
  slug: module.slug,
  title: module.title,
  description: module.description,
  position: index + 1,
  status: "published",
  items: [
    ...(index === 0 ? [{
      id: "program-introduction",
      slug: "program-introduction",
      moduleId: module.id,
      title: "Welcome to The Ryva Program",
      description: "A short orientation to the learning journey and the perspective it develops.",
      position: 0,
      type: "article" as const,
      status: "published" as const,
      required: false,
      estimatedMinutes: 3,
      contentVersion: 1,
      blocks: [
        {
          type: "paragraph" as const,
          text: "The Ryva Program explores how brands, products, buyers, retail accounts, communication, orders, and continuing commercial relationships connect inside brand placement."
        },
        {
          type: "callout" as const,
          title: "A learning experience",
          text: "The Ryva Program is an independent industry education and guided-practice experience in brand placement."
        },
        {
          type: "paragraph" as const,
          text: "As you move through the Program, return to one question: what would you pay attention to next?"
        }
      ]
    }] : []),
    ...(index === 0 ? moduleOneItems : remainderModuleItems[module.id as keyof typeof remainderModuleItems] ?? draftItems(module.id, module.topics))
  ]
}));

export const ryvaProgram: ProgramDefinition = {
  id: "ryva-program",
  slug: "the-ryva-program",
  title: "The Ryva Program",
  version: 1,
  status: "published",
  heading: "Step inside brand placement.",
  description: "Learn the system, see it in context, and work through the decisions.",
  modules,
  finalSimulation,
  finalAssessment,
  completion: {
    enabled: true,
    finalSimulationItemId: "final-simulation",
    finalAssessmentItemId: "final-assessment"
  }
};

export function publishedItems(program: ProgramDefinition): ProgramLearningItem[] {
  const moduleItems = program.modules
    .filter((module) => module.status === "published")
    .flatMap((module) => module.items.filter((item) => item.status === "published"));
  return [...moduleItems, program.finalSimulation, ...(program.finalAssessment ? [program.finalAssessment] : [])]
    .filter((item) => item.status === "published");
}

export function findProgramModule(program: ProgramDefinition, identifier: string): ProgramModule | undefined {
  return program.modules.find((module) => module.id === identifier || module.slug === identifier);
}

export function findProgramItem(program: ProgramDefinition, identifier: string): ProgramLearningItem | undefined {
  return [...program.modules.flatMap((module) => module.items), program.finalSimulation, ...(program.finalAssessment ? [program.finalAssessment] : [])]
    .find((item) => item.id === identifier || item.slug === identifier);
}
