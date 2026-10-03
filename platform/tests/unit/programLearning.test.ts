import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { calculateProgramProgress } from "../../packages/domain/src/programLearning.js";
import { brandPlacementLibrary, publishedItems, ryvaProgram } from "../../packages/program-content/src/index.js";
import { draftFinalTestProgram, publishedTestProgram } from "../programFixture.js";

describe("Program content architecture", () => {
  it("publishes the complete eight-module Program, final simulation, and final assessment", () => {
    assert.equal(ryvaProgram.modules.length, 8);
    assert.deepEqual(ryvaProgram.modules.map((module) => module.title), [
      "Inside Brand Placement",
      "Brands, Products, Assortment & Commercial Readiness",
      "Buyers, Retail Accounts & Commercial Fit",
      "Placement Strategy, Territory & Opportunity Prioritization",
      "Outreach, Buyer Communication & Appointments",
      "Orders, Terms, Fulfillment & Reorders",
      "Account Development, Sell-Through & Commercial Performance",
      "Commissions, Commercial Judgment & Working in Ryva"
    ]);
    const moduleOne = ryvaProgram.modules[0]!;
    const required = moduleOne.items.filter((item) => item.status === "published" && item.required);
    assert.equal(required.length, 13);
    assert.equal(required.filter((item) => item.type === "knowledge_check").length, 6);
    assert.ok(required.some((item) => item.id === "module-1-map-the-relationship"));
    assert.ok(required.some((item) => item.blocks.some((block) => block.type === "workspace_preview")));
    assert.ok(required.some((item) => item.blocks.some((block) => block.type === "relationship_visual")));
    assert.ok(required.some((item) => item.blocks.some((block) => block.type === "commercial_journey")));
    assert.ok(required.filter((item) => item.type === "knowledge_check").every((item) =>
      item.knowledgeCheck?.questions.every((question) => (question as { type: string }).type !== "structured_response")
    ));
    assert.equal(required.filter((item) => item.media?.status === "awaiting_production").length, 0);
    assert.ok(ryvaProgram.modules.slice(1).every((module) =>
      module.items.length > 0 && module.items.every((item) => item.status === "published")
    ));
    assert.equal(ryvaProgram.finalSimulation.status, "published");
    assert.equal(ryvaProgram.finalSimulation.activity?.steps.length, 11);
    assert.equal(ryvaProgram.finalAssessment?.status, "published");
    assert.ok((ryvaProgram.finalAssessment?.assessment?.questions.length ?? 0) >= 100);
    assert.equal(ryvaProgram.finalAssessment?.assessment?.questionCount, 50);
    assert.equal(ryvaProgram.finalAssessment?.assessment?.passingPercentage, 80);
    assert.equal(ryvaProgram.completion.enabled, true);
    assert.equal(publishedItems(ryvaProgram).filter((item) => item.required).length, 128);
    const remainder = ryvaProgram.modules.slice(1).flatMap((module) => module.items);
    assert.ok(remainder.some((item) => item.blocks.some((block) => block.type === "formula")));
    assert.ok(remainder.some((item) => item.blocks.some((block) => block.type === "data_table")));
    const briefings = ryvaProgram.modules.flatMap((module) => module.items)
      .flatMap((item) => item.blocks.filter((block) => block.type === "visual_briefing"));
    assert.equal(briefings.length, 8);
    assert.ok(briefings.every((briefing) => briefing.slides.length >= 12));
    assert.ok(ryvaProgram.modules.every((module) => module.items
      .filter((item) => item.type === "article" && item.required)
      .every((item) => item.blocks.some((block) => block.type === "heading" && block.text === "Field Notes"))));
    assert.ok(brandPlacementLibrary.length >= 20);
    assert.equal(new Set(brandPlacementLibrary.map((resource) => resource.id)).size, brandPlacementLibrary.length);
    const experienceSource = readFileSync("apps/web/src/program/ProgramExperience.tsx", "utf8");
    const programCss = readFileSync("apps/web/src/program/program.css", "utf8");
    assert.match(experienceSource, /event\.key === "ArrowLeft"/);
    assert.match(experienceSource, /event\.key === "ArrowRight"/);
    assert.match(experienceSource, /aria-label={`Slide \$\{activeIndex \+ 1\} of \$\{block\.slides\.length\}`}/);
    assert.match(experienceSource, /\/api\/program\/library/);
    assert.match(programCss, /\.ry-program-briefing-slide[\s\S]*?overflow|\.ry-program-data-table > div[\s\S]*?overflow-x:\s*auto/);
    assert.match(programCss, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(programCss, /@media print/);
    const retailerPractice = ryvaProgram.modules[2]!.items.find((item) => item.id === "module-3-retailer-fit");
    const retailerBriefing = retailerPractice?.blocks.find((block) => block.type === "comparison");
    assert.ok(retailerBriefing?.columns.every((profile) => profile.body.length > 150));
    assert.deepEqual(retailerBriefing?.columns.map((profile) => profile.title), ["Canopy Pet Co.", "Field House Mercantile", "Juniper & Finch", "Regional pet chain"]);
    assert.ok(retailerPractice?.blocks.some((block) => block.type === "data_table" && block.caption === "Proposed Paws & Pine opening assortment"));
    const territoryPractice = ryvaProgram.modules[3]!.items.find((item) => item.id === "module-4-prioritize-territory");
    const territoryBriefing = territoryPractice?.blocks.find((block) => block.type === "comparison");
    assert.equal(territoryBriefing?.columns.length, 10);
    assert.ok(territoryBriefing?.columns.every((profile) => profile.body.length > 180));
    assert.match(JSON.stringify(territoryPractice), /fit|timing|potential|territory|authority|Need:/);
    const guidedPractices = remainder.filter((item) => item.type === "guided_practice" || item.type === "guided_exercise");
    assert.equal(guidedPractices.length, 9);
    assert.ok(guidedPractices.every((item) => item.blocks.length > 1), "every guided practice needs decision-supporting facts beyond the shared reasoning introduction");
    assert.ok(guidedPractices.every((item) => item.blocks.slice(1).some((block) => ["callout", "comparison", "data_table"].includes(block.type))), "every guided practice needs a structured scenario brief or reference data");
    const activityFields = remainder.flatMap((item) => item.activity?.steps.flatMap((step) => step.fields) ?? []);
    for (const interaction of ["assortment_builder", "mapping", "score_matrix", "classification", "numeric_response", "multi_select"]) {
      assert.ok(activityFields.some((field) => field.type === interaction), `missing ${interaction}`);
    }
    assert.doesNotMatch(JSON.stringify(ryvaProgram), /certif|credential|licensed|job-ready|professionally qualified/i);
  });

  it("keeps answer data and Program content out of the public web import graph", () => {
    const moduleOne = ryvaProgram.modules[0]!;
    const check = moduleOne.items.find((item) => item.type === "knowledge_check");
    assert.ok(check?.knowledgeCheck?.questions.every((question) => Boolean(question.answer)));
    for (const filename of [
      "apps/web/src/program/ProgramExperience.tsx",
      "apps/web/src/App.tsx",
      "vite.config.ts"
    ]) {
      const source = readFileSync(filename, "utf8");
      assert.doesNotMatch(source, /packages\/program-content|@ryva\/program-content/);
    }
  });

  it("does not auto-complete an empty, optional-only, or draft-final curriculum", () => {
    const production = calculateProgramProgress(ryvaProgram, new Map());
    assert.equal(production.percentage, 0);
    assert.equal(production.totalRequiredItems, 128);
    assert.equal(production.completionConfigured, true);
    const draftFinal = calculateProgramProgress(draftFinalTestProgram, new Map());
    assert.equal(draftFinal.completionConfigured, false);
  });

  it("counts only published required items", () => {
    const summary = calculateProgramProgress(publishedTestProgram, new Map());
    assert.equal(summary.totalRequiredItems, 4);
    assert.equal(summary.completedRequiredItems, 0);
    assert.equal(summary.percentage, 0);
    assert.equal(summary.completionConfigured, true);
  });
});
