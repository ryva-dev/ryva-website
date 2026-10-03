import type { ProgramDefinition, ProgramLearningItem } from "../packages/program-content/src/index.js";

function item(input: Partial<ProgramLearningItem> & Pick<ProgramLearningItem, "id" | "slug" | "moduleId" | "title" | "position" | "type">): ProgramLearningItem {
  return {
    description: `${input.title} learning item`,
    status: "published",
    required: true,
    estimatedMinutes: 5,
    contentVersion: 1,
    blocks: [{ type: "paragraph", text: `Review ${input.title}.` }],
    ...input
  };
}

export const publishedTestProgram: ProgramDefinition = {
  id: "ryva-program-test",
  slug: "ryva-program-test",
  title: "The Ryva Program",
  version: 7,
  status: "published",
  heading: "Step inside brand placement.",
  description: "Test curriculum",
  modules: [
    {
      id: "test-module-1",
      slug: "inside-brand-placement",
      title: "Inside brand placement",
      description: "Understand the commercial landscape.",
      position: 1,
      status: "published",
      items: [
        item({ id: "test-article-1", slug: "commercial-landscape", moduleId: "test-module-1", title: "The commercial landscape", position: 1, type: "article" }),
        item({
          id: "test-optional-1",
          slug: "optional-reflection",
          moduleId: "test-module-1",
          title: "Optional reflection",
          position: 2,
          type: "reflection",
          required: false,
          activity: {
            steps: [{
              id: "optional-step",
              title: "Notice",
              prompt: "What did you notice?",
              required: true,
              fields: [{ id: "note", type: "written_response", label: "Your note", required: true }]
            }]
          }
        }),
        item({
          id: "test-exercise-1",
          slug: "account-fit-exercise",
          moduleId: "test-module-1",
          title: "Account fit exercise",
          position: 3,
          type: "guided_exercise",
          activity: {
            introduction: "Consider the account context.",
            steps: [{
              id: "fit-step",
              title: "Account context",
              prompt: "What deserves attention?",
              required: true,
              fields: [{ id: "reasoning", type: "written_response", label: "Your reasoning", required: true, maxLength: 2000 }],
              considerations: ["Retail fit depends on context, not one isolated product attribute."]
            }]
          }
        }),
        item({
          id: "test-numeric-check",
          slug: "numeric-check",
          moduleId: "test-module-1",
          title: "Numeric check",
          position: 4,
          type: "knowledge_check",
          required: false,
          knowledgeCheck: {
            introduction: "Check the calculation.",
            questions: [{
              id: "numeric-answer",
              type: "numeric_calculation",
              prompt: "What is the calculated value?",
              unitLabel: "units",
              answer: {
                value: 12.5,
                tolerance: 0.01,
                explanation: "The calculated value is 12.5 units.",
                review: "Recheck the inputs and calculate the value again."
              }
            }]
          }
        }),
        item({
          id: "test-draft-1",
          slug: "draft-item",
          moduleId: "test-module-1",
          title: "Draft item",
          position: 5,
          type: "article",
          status: "draft"
        })
      ]
    },
    {
      id: "test-module-2",
      slug: "brands-products-assortment",
      title: "Brands, products & assortment",
      description: "Consider products in context.",
      position: 2,
      status: "published",
      items: [
        item({ id: "test-article-2", slug: "assortment-context", moduleId: "test-module-2", title: "Assortment context", position: 1, type: "article" })
      ]
    }
  ],
  finalSimulation: item({
    id: "test-final-simulation",
    slug: "final-simulation",
    moduleId: "final-simulation",
    title: "Final Simulation",
    position: 1,
    type: "final_simulation",
    activity: {
      steps: [{
        id: "final-step",
        title: "What comes next",
        context: "A brand, product, account, buyer, placement, communication, and opening order are connected.",
        prompt: "What would you pay attention to next?",
        required: true,
        fields: [{ id: "next", type: "written_response", label: "Your reasoning", required: true, maxLength: 4000 }],
        considerations: ["Account continuity depends on follow-through and changing needs."]
      }]
    }
  }),
  completion: { enabled: true, finalSimulationItemId: "test-final-simulation" }
};

export const draftFinalTestProgram: ProgramDefinition = {
  ...publishedTestProgram,
  finalSimulation: { ...publishedTestProgram.finalSimulation, status: "draft" }
};
