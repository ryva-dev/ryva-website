import type { AppConfig } from "../../config/src/index.js";
import type { Database, Transaction } from "../../database/src/index.js";
import { oneOrNone, withTransaction } from "../../database/src/index.js";
import {
  findProgramItem,
  findProgramModule,
  itemProgressVersion,
  publishedItems,
  type ActivityField,
  type AssessmentDomain,
  type AssessmentQuestion,
  type KnowledgeCheckQuestion,
  type ProgramDefinition,
  type ProgramLearningItem,
  type ProgramModule
} from "../../program-content/src/index.js";
import { AppError, newId } from "../../shared/src/index.js";
import { recordAudit } from "./audit.js";
import { completeProgramInTransaction } from "./productAccess.js";

type ProgressRow = {
  learning_item_id: string;
  content_version: number;
  started_at: Date | null;
  completed_at: Date | null;
  last_viewed_at: Date;
};

export type ProgramItemProgress = {
  itemId: string;
  contentVersion: number;
  startedAt: string | null;
  completedAt: string | null;
  lastViewedAt: string;
};

export type ProgramItemSummary = {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: ProgramLearningItem["type"];
  required: boolean;
  estimatedMinutes: number | null;
  contentVersion: number;
  completed: boolean;
  started: boolean;
};

export type ProgramModuleSummary = {
  id: string;
  slug: string;
  title: string;
  description: string;
  position: number;
  state: "available" | "current" | "completed" | "locked" | "preparing";
  requiredItems: number;
  completedRequiredItems: number;
  estimatedMinutes: number;
  items: ProgramItemSummary[];
};

export type ProgramProgressSummary = {
  completedRequiredItems: number;
  totalRequiredItems: number;
  percentage: number;
  completionConfigured: boolean;
  finalSimulationPublished: boolean;
};

export type ProgramDashboard = {
  program: {
    id: string;
    title: string;
    heading: string;
    description: string;
    version: number;
  };
  progress: ProgramProgressSummary;
  modules: ProgramModuleSummary[];
  finalSimulation: ProgramItemSummary & { state: "available" | "completed" | "locked" | "draft" };
  finalAssessment: (ProgramItemSummary & { state: "available" | "completed" | "locked" | "draft" }) | null;
  continueTo: { moduleSlug: string; itemSlug: string } | null;
  learnerState: { lastModuleId: string | null; lastItemId: string | null };
  programCompletedAt: string | null;
};

export type ProgramActivityResponse = {
  steps: Record<string, Record<string, unknown>>;
  assessmentResult?: FinalAssessmentResult;
};

export type KnowledgeCheckFeedback = {
  questions: Array<{
    questionId: string;
    outcome: "aligned" | "review" | "compare";
    heading: "Correct" | "Not quite";
    explanation: string;
    referenceAnswer?: string;
    thingsToNotice: string[];
  }>;
};

export type FinalAssessmentResult = {
  attemptNumber: number;
  score: number;
  passingPercentage: number;
  correctAnswers: number;
  totalQuestions: number;
  passed: boolean;
  heading: "The Ryva Program: Assessment complete" | "Review recommended before your next attempt.";
  performance: Array<{ domain: AssessmentDomain; correct: number; total: number; percentage: number }>;
};

type ProgramMutationContext = {
  userId: string;
  workspaceId: string;
  requestId: string;
};

function toProgress(row: ProgressRow): ProgramItemProgress {
  return {
    itemId: row.learning_item_id,
    contentVersion: row.content_version,
    startedAt: row.started_at?.toISOString() ?? null,
    completedAt: row.completed_at?.toISOString() ?? null,
    lastViewedAt: row.last_viewed_at.toISOString()
  };
}

function itemKey(item: ProgramLearningItem): string {
  return `${item.id}:${itemProgressVersion(item)}`;
}

function publicKnowledgeQuestion(question: KnowledgeCheckQuestion) {
  if (question.type === "single_choice" || question.type === "multiple_select") return {
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    options: question.options
  };
  if (question.type === "true_false") return {
    id: question.id,
    type: question.type,
    prompt: question.prompt
  };
  if (question.type === "numeric_calculation") return {
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    unitLabel: question.unitLabel
  };
  if (question.type === "ordering") return {
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    options: question.options
  };
  return {
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    left: question.left,
    right: question.right
  };
}

function publicLearningItem(item: ProgramLearningItem) {
  return {
    ...item,
    knowledgeCheck: item.knowledgeCheck ? {
      introduction: item.knowledgeCheck.introduction,
      questions: item.knowledgeCheck.questions.map(publicKnowledgeQuestion)
    } : undefined,
    assessment: item.assessment ? {
      questionCount: item.assessment.questionCount,
      passingPercentage: item.assessment.passingPercentage,
      recommendedMinutes: item.assessment.recommendedMinutes
    } : undefined
  };
}

const assessmentWeights: Record<AssessmentDomain, number> = {
  foundations: 5,
  brands_products: 6,
  pricing_math: 8,
  buyers_accounts: 6,
  placement_strategy: 5,
  outreach: 5,
  orders_reorders: 6,
  account_performance: 4,
  commissions: 3,
  ryva_workflow: 2
};

function assessmentQuestions(item: ProgramLearningItem, attemptNumber: number): AssessmentQuestion[] {
  if (!item.assessment) return [];
  return (Object.entries(assessmentWeights) as Array<[AssessmentDomain, number]>).flatMap(([domain, count]) => {
    const available = item.assessment!.questions.filter((question) => question.domain === domain);
    if (available.length < count) throw new AppError(500, "assessment_bank_incomplete", "The assessment question bank is incomplete.");
    const offset = ((attemptNumber - 1) * count) % available.length;
    return Array.from({ length: count }, (_, index) => available[(offset + index) % available.length]!);
  });
}

function publicAssessmentQuestion(question: AssessmentQuestion) {
  return { ...publicKnowledgeQuestion(question), domain: question.domain };
}

function knowledgeResponses(response: ProgramActivityResponse): Record<string, unknown> {
  return response.steps["knowledge-check"] ?? {};
}

function orderedValuesEqual(value: unknown, expected: string[]): boolean {
  return Array.isArray(value) && value.length === expected.length &&
    value.every((entry, index) => entry === expected[index]);
}

function selectedValuesEqual(value: unknown, expected: string[]): boolean {
  if (!Array.isArray(value) || value.length !== expected.length || new Set(value).size !== value.length) return false;
  const supplied = new Set(value);
  return expected.every((entry) => supplied.has(entry));
}

function matchesEqual(value: unknown, expected: Record<string, string>): boolean {
  if (!Array.isArray(value) || value.length !== Object.keys(expected).length) return false;
  const supplied = new Map(value.flatMap((entry) => {
    if (typeof entry !== "string") return [];
    const separator = entry.indexOf(":");
    return separator > 0 ? [[entry.slice(0, separator), entry.slice(separator + 1)] as const] : [];
  }));
  return Object.entries(expected).every(([left, right]) => supplied.get(left) === right);
}

function responseAligns(question: KnowledgeCheckQuestion, value: unknown): boolean {
  if (question.type === "single_choice") return value === question.answer.optionId;
  if (question.type === "multiple_select") return selectedValuesEqual(value, question.answer.optionIds);
  if (question.type === "true_false") return value === String(question.answer.value);
  if (question.type === "numeric_calculation") {
    const supplied = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
    return Number.isFinite(supplied) && Math.abs(supplied - question.answer.value) <= (question.answer.tolerance ?? 0);
  }
  if (question.type === "ordering") return orderedValuesEqual(value, question.answer.optionIds);
  return matchesEqual(value, question.answer.matches);
}

function evaluateKnowledgeCheck(
  item: ProgramLearningItem,
  response: ProgramActivityResponse
): KnowledgeCheckFeedback {
  const responses = knowledgeResponses(response);
  return {
    questions: (item.knowledgeCheck?.questions ?? []).map((question) => {
      const aligned = responseAligns(question, responses[question.id]);
      return {
        questionId: question.id,
        outcome: aligned ? "aligned" as const : "review" as const,
        heading: aligned ? "Correct" as const : "Not quite" as const,
        explanation: aligned ? question.answer.explanation : question.answer.review,
        thingsToNotice: question.thingsToNotice ?? []
      };
    })
  };
}

async function progressRows(
  database: Database | Transaction,
  userId: string
): Promise<Map<string, ProgressRow>> {
  const result = await database.query<ProgressRow>(
    `SELECT learning_item_id,content_version,started_at,completed_at,last_viewed_at
       FROM program_item_progress WHERE user_id=$1`,
    [userId]
  );
  return new Map(result.rows.map((row) => [`${row.learning_item_id}:${row.content_version}`, row]));
}

function publishedModuleItems(module: ProgramModule): ProgramLearningItem[] {
  return module.items
    .filter((item) => item.status === "published")
    .sort((left, right) => left.position - right.position);
}

function requiredModuleItems(module: ProgramModule): ProgramLearningItem[] {
  return publishedModuleItems(module).filter((item) => item.required);
}

function isComplete(item: ProgramLearningItem, progress: Map<string, ProgressRow>): boolean {
  return Boolean(progress.get(itemKey(item))?.completed_at);
}

function prerequisiteModulesComplete(
  modules: ProgramModule[],
  moduleIndex: number,
  progress: Map<string, ProgressRow>
): boolean {
  return modules.slice(0, moduleIndex).every((module) => {
    const required = requiredModuleItems(module);
    return required.length > 0 && required.every((item) => isComplete(item, progress));
  });
}

function itemSummary(item: ProgramLearningItem, progress: Map<string, ProgressRow>): ProgramItemSummary {
  const state = progress.get(itemKey(item));
  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    description: item.description,
    type: item.type,
    required: item.required,
    estimatedMinutes: item.estimatedMinutes ?? null,
    contentVersion: item.contentVersion,
    completed: Boolean(state?.completed_at),
    started: Boolean(state?.started_at)
  };
}

function moduleSummaries(
  program: ProgramDefinition,
  progress: Map<string, ProgressRow>
): ProgramModuleSummary[] {
  const modules = program.modules
    .filter((module) => module.status === "published")
    .sort((left, right) => left.position - right.position);
  let currentAssigned = false;
  return modules.map((module, index) => {
    const items = publishedModuleItems(module);
    const required = items.filter((item) => item.required);
    const completedRequiredItems = required.filter((item) => isComplete(item, progress)).length;
    const prerequisitesComplete = index === 0 || prerequisiteModulesComplete(modules, index, progress);
    const completed = required.length > 0 && completedRequiredItems === required.length;
    let state: ProgramModuleSummary["state"];
    if (!items.length) state = "preparing";
    else if (!prerequisitesComplete) state = "locked";
    else if (completed) state = "completed";
    else if (!currentAssigned) {
      state = "current";
      currentAssigned = true;
    } else state = "available";
    return {
      id: module.id,
      slug: module.slug,
      title: module.title,
      description: module.description,
      position: module.position,
      state,
      requiredItems: required.length,
      completedRequiredItems,
      estimatedMinutes: items.reduce((total, item) => total + (item.estimatedMinutes ?? 0), 0),
      items: items.map((item) => itemSummary(item, progress))
    };
  });
}

export function calculateProgramProgress(
  program: ProgramDefinition,
  progress: Map<string, ProgressRow>
): ProgramProgressSummary {
  const required = publishedItems(program).filter((item) => item.required);
  const completedRequiredItems = required.filter((item) => isComplete(item, progress)).length;
  const finalSimulationPublished = program.finalSimulation.status === "published";
  const completionConfigured = Boolean(
    program.status === "published" &&
    program.completion.enabled &&
    finalSimulationPublished &&
    program.finalSimulation.required &&
    program.finalSimulation.id === program.completion.finalSimulationItemId &&
    (!program.finalAssessment || (
      program.finalAssessment.status === "published" &&
      program.finalAssessment.required &&
      program.finalAssessment.id === program.completion.finalAssessmentItemId
    )) &&
    required.length > 0
  );
  return {
    completedRequiredItems,
    totalRequiredItems: required.length,
    percentage: required.length ? Math.round((completedRequiredItems / required.length) * 100) : 0,
    completionConfigured,
    finalSimulationPublished
  };
}

function finalSimulationAvailable(
  program: ProgramDefinition,
  progress: Map<string, ProgressRow>
): boolean {
  const modules = program.modules.filter((module) => module.status === "published");
  return modules.length > 0 && modules.every((module) => {
    const required = requiredModuleItems(module);
    return required.length > 0 && required.every((item) => isComplete(item, progress));
  });
}

function finalAssessmentAvailable(program: ProgramDefinition, progress: Map<string, ProgressRow>): boolean {
  return program.finalSimulation.status === "published" && isComplete(program.finalSimulation, progress);
}

async function learnerState(database: Database | Transaction, userId: string) {
  const state = await oneOrNone<{ last_module_id: string | null; last_learning_item_id: string | null }>(
    database,
    "SELECT last_module_id,last_learning_item_id FROM program_learner_state WHERE user_id=$1",
    [userId]
  );
  return {
    lastModuleId: state?.last_module_id ?? null,
    lastItemId: state?.last_learning_item_id ?? null
  };
}

export async function getProgramDashboard(
  database: Database | Transaction,
  program: ProgramDefinition,
  userId: string
): Promise<ProgramDashboard> {
  const [progress, state, entitlement] = await Promise.all([
    progressRows(database, userId),
    learnerState(database, userId),
    oneOrNone<{ completed_at: Date | null }>(
      database,
      "SELECT completed_at FROM program_entitlements WHERE user_id=$1 AND status='active'",
      [userId]
    )
  ]);
  const modules = moduleSummaries(program, progress);
  const progressSummary = calculateProgramProgress(program, progress);
  const finalPublished = program.finalSimulation.status === "published";
  const finalCompleted = finalPublished && isComplete(program.finalSimulation, progress);
  const finalState = !finalPublished
    ? "draft" as const
    : finalCompleted
      ? "completed" as const
      : finalSimulationAvailable(program, progress)
        ? "available" as const
        : "locked" as const;
  const assessment = program.finalAssessment;
  const assessmentState = !assessment || assessment.status !== "published"
    ? "draft" as const
    : isComplete(assessment, progress)
      ? "completed" as const
      : finalAssessmentAvailable(program, progress)
        ? "available" as const
        : "locked" as const;
  const accessibleItems = modules
    .filter((module) => module.state !== "locked" && module.state !== "preparing")
    .flatMap((module) => module.items.map((item) => ({ moduleSlug: module.slug, item })));
  const last = accessibleItems.find(({ item }) => item.id === state.lastItemId);
  const nextModuleItem = last && !last.item.completed
    ? last
    : accessibleItems.find(({ item }) => !item.completed) ?? null;
  const continueTo = nextModuleItem
    ? { moduleSlug: nextModuleItem.moduleSlug, itemSlug: nextModuleItem.item.slug }
    : finalState === "available"
      ? { moduleSlug: "final-simulation", itemSlug: program.finalSimulation.slug }
      : assessment && assessmentState === "available"
        ? { moduleSlug: "final-assessment", itemSlug: assessment.slug }
        : null;
  return {
    program: {
      id: program.id,
      title: program.title,
      heading: program.heading,
      description: program.description,
      version: program.version
    },
    progress: progressSummary,
    modules,
    finalSimulation: {
      ...itemSummary(program.finalSimulation, progress),
      state: finalState
    },
    finalAssessment: assessment ? { ...itemSummary(assessment, progress), state: assessmentState } : null,
    continueTo,
    learnerState: state,
    programCompletedAt: entitlement?.completed_at?.toISOString() ?? null
  };
}

function requirePublishedModule(program: ProgramDefinition, identifier: string): ProgramModule {
  const module = findProgramModule(program, identifier);
  if (!module || module.status !== "published") {
    throw new AppError(404, "program_module_not_found", "Program module not found.");
  }
  return module;
}

function requirePublishedItem(program: ProgramDefinition, identifier: string): ProgramLearningItem {
  const item = findProgramItem(program, identifier);
  if (!item || item.status !== "published") {
    throw new AppError(404, "program_item_not_found", "Program item not found.");
  }
  return item;
}

function assertModuleAvailable(
  program: ProgramDefinition,
  module: ProgramModule,
  progress: Map<string, ProgressRow>
): void {
  const modules = program.modules
    .filter((entry) => entry.status === "published")
    .sort((left, right) => left.position - right.position);
  const index = modules.findIndex((entry) => entry.id === module.id);
  if (index < 0 || (index > 0 && !prerequisiteModulesComplete(modules, index, progress))) {
    throw new AppError(403, "program_module_locked", "Complete the preceding module before continuing.");
  }
}

export async function getProgramModule(
  database: Database | Transaction,
  program: ProgramDefinition,
  userId: string,
  moduleIdentifier: string
) {
  const module = requirePublishedModule(program, moduleIdentifier);
  if (!publishedModuleItems(module).length) {
    throw new AppError(403, "program_module_preparing", "This module is still in preparation.");
  }
  const progress = await progressRows(database, userId);
  assertModuleAvailable(program, module, progress);
  const summary = moduleSummaries(program, progress).find((entry) => entry.id === module.id);
  if (!summary) throw new AppError(404, "program_module_not_found", "Program module not found.");
  return { module: summary };
}

export async function getProgramItem(
  database: Database | Transaction,
  program: ProgramDefinition,
  userId: string,
  itemIdentifier: string
) {
  const item = requirePublishedItem(program, itemIdentifier);
  const progress = await progressRows(database, userId);
  if (item.id === program.finalSimulation.id) {
    if (!finalSimulationAvailable(program, progress)) {
      throw new AppError(403, "final_simulation_locked", "Complete the Program modules before continuing.");
    }
  } else if (item.id === program.finalAssessment?.id) {
    if (!finalAssessmentAvailable(program, progress)) {
      throw new AppError(403, "final_assessment_locked", "Complete the Final Brand Placement Simulation before beginning the assessment.");
    }
  } else {
    const module = requirePublishedModule(program, item.moduleId);
    assertModuleAvailable(program, module, progress);
  }
  const allPublished = publishedItems(program);
  const position = allPublished.findIndex((entry) => entry.id === item.id);
  const module = item.id === program.finalSimulation.id || item.id === program.finalAssessment?.id ? null : requirePublishedModule(program, item.moduleId);
  const navigationTarget = (entry: ProgramLearningItem | undefined) => {
    if (!entry) return null;
    if (entry.id === program.finalSimulation.id) {
      return { id: entry.id, slug: entry.slug, moduleSlug: "final-simulation" };
    }
    if (entry.id === program.finalAssessment?.id) {
      return { id: entry.id, slug: entry.slug, moduleSlug: "final-assessment" };
    }
    return {
      id: entry.id,
      slug: entry.slug,
      moduleSlug: requirePublishedModule(program, entry.moduleId).slug
    };
  };
  const latestSubmission = await oneOrNone<{
    id: string;
    response_json: ProgramActivityResponse;
    submitted_at: Date;
  }>(
    database,
    `SELECT id,response_json,submitted_at FROM program_activity_submissions
      WHERE user_id=$1 AND learning_item_id=$2 AND content_version=$3
      ORDER BY submitted_at DESC,created_at DESC LIMIT 1`,
    [userId, item.id, itemProgressVersion(item)]
  );
  const attemptCountResult = item.type === "final_assessment" ? await database.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM program_activity_submissions
      WHERE user_id=$1 AND learning_item_id=$2 AND content_version=$3`,
    [userId, item.id, itemProgressVersion(item)]
  ) : null;
  const attemptNumber = (attemptCountResult?.rows[0]?.count ?? 0) + 1;
  const publicItem = publicLearningItem(item);
  if (item.type === "final_assessment") {
    publicItem.knowledgeCheck = {
      introduction: item.knowledgeCheck?.introduction ?? "Complete the assessment.",
      questions: assessmentQuestions(item, attemptNumber).map(publicAssessmentQuestion)
    };
  }
  return {
    item: publicItem,
    progress: progress.get(itemKey(item)) ? toProgress(progress.get(itemKey(item))!) : null,
    submission: latestSubmission ? {
      id: latestSubmission.id,
      submittedAt: latestSubmission.submitted_at.toISOString(),
      considerations: item.type === "knowledge_check"
        ? []
        : item.activity?.steps.flatMap((step) => step.considerations ?? []) ?? [],
      knowledgeFeedback: item.type === "knowledge_check"
        ? evaluateKnowledgeCheck(item, latestSubmission.response_json)
        : null,
      response: item.type === "final_assessment" ? null : latestSubmission.response_json,
      assessmentResult: item.type === "final_assessment" ? latestSubmission.response_json.assessmentResult ?? null : null
    } : null,
    module: module ? {
      id: module.id,
      slug: module.slug,
      title: module.title,
      position: module.position,
      items: publishedModuleItems(module).map((entry) => itemSummary(entry, progress))
    } : null,
    navigation: {
      previous: navigationTarget(position > 0 ? allPublished[position - 1] : undefined),
      next: navigationTarget(position >= 0 && position < allPublished.length - 1 ? allPublished[position + 1] : undefined)
    }
  };
}

async function touchLearnerState(
  transaction: Transaction,
  userId: string,
  item: ProgramLearningItem
): Promise<void> {
  await transaction.query(
    `INSERT INTO program_learner_state (user_id,last_module_id,last_learning_item_id)
     VALUES ($1,$2,$3)
     ON CONFLICT (user_id) DO UPDATE SET
       last_module_id=excluded.last_module_id,
       last_learning_item_id=excluded.last_learning_item_id,
       updated_at=clock_timestamp()`,
    [userId, item.moduleId, item.id]
  );
}

async function assertItemAvailable(
  transaction: Transaction,
  program: ProgramDefinition,
  userId: string,
  item: ProgramLearningItem
): Promise<void> {
  const progress = await progressRows(transaction, userId);
  if (item.id === program.finalSimulation.id) {
    if (!finalSimulationAvailable(program, progress)) {
      throw new AppError(403, "final_simulation_locked", "Complete the Program modules before continuing.");
    }
    return;
  }
  if (item.id === program.finalAssessment?.id) {
    if (!finalAssessmentAvailable(program, progress)) {
      throw new AppError(403, "final_assessment_locked", "Complete the Final Brand Placement Simulation before beginning the assessment.");
    }
    return;
  }
  assertModuleAvailable(program, requirePublishedModule(program, item.moduleId), progress);
}

export async function startProgramItem(
  database: Database,
  program: ProgramDefinition,
  context: ProgramMutationContext,
  itemIdentifier: string
): Promise<ProgramItemProgress> {
  const item = requirePublishedItem(program, itemIdentifier);
  return withTransaction(database, async (transaction) => {
    await assertItemAvailable(transaction, program, context.userId, item);
    const result = await transaction.query<ProgressRow>(
      `INSERT INTO program_item_progress
        (id,user_id,learning_item_id,content_version,started_at,last_viewed_at)
       VALUES ($1,$2,$3,$4,clock_timestamp(),clock_timestamp())
       ON CONFLICT (user_id,learning_item_id,content_version) DO UPDATE SET
         started_at=coalesce(program_item_progress.started_at,clock_timestamp()),
         last_viewed_at=clock_timestamp(),updated_at=clock_timestamp()
       RETURNING learning_item_id,content_version,started_at,completed_at,last_viewed_at`,
      [newId(), context.userId, item.id, itemProgressVersion(item)]
    );
    await touchLearnerState(transaction, context.userId, item);
    return toProgress(result.rows[0]!);
  });
}

function isActivity(item: ProgramLearningItem): boolean {
  return ["knowledge_check", "guided_exercise", "guided_practice", "reflection", "final_simulation", "final_assessment"].includes(item.type);
}

async function evaluateProgramCompletion(
  database: Transaction,
  configuration: AppConfig,
  program: ProgramDefinition,
  context: ProgramMutationContext
) {
  const progress = await progressRows(database, context.userId);
  const summary = calculateProgramProgress(program, progress);
  const required = publishedItems(program).filter((item) => item.required);
  if (
    !summary.completionConfigured ||
    summary.completedRequiredItems !== summary.totalRequiredItems ||
    !required.some((item) => item.id === program.completion.finalSimulationItemId) ||
    (Boolean(program.finalAssessment) && !required.some((item) => item.id === program.completion.finalAssessmentItemId))
  ) return null;
  return completeProgramInTransaction(database, configuration, context);
}

export async function completeProgramItem(
  database: Database,
  configuration: AppConfig,
  program: ProgramDefinition,
  context: ProgramMutationContext,
  itemIdentifier: string
) {
  const item = requirePublishedItem(program, itemIdentifier);
  if (isActivity(item)) {
    throw new AppError(409, "program_submission_required", "Submit this learning activity before completing it.");
  }
  const result = await withTransaction(database, async (transaction) => {
    await assertItemAvailable(transaction, program, context.userId, item);
    const result = await transaction.query<ProgressRow>(
      `INSERT INTO program_item_progress
        (id,user_id,learning_item_id,content_version,started_at,completed_at,last_viewed_at)
       VALUES ($1,$2,$3,$4,clock_timestamp(),clock_timestamp(),clock_timestamp())
       ON CONFLICT (user_id,learning_item_id,content_version) DO UPDATE SET
         started_at=coalesce(program_item_progress.started_at,clock_timestamp()),
         completed_at=coalesce(program_item_progress.completed_at,clock_timestamp()),
         last_viewed_at=clock_timestamp(),updated_at=clock_timestamp()
       RETURNING learning_item_id,content_version,started_at,completed_at,last_viewed_at`,
      [newId(), context.userId, item.id, itemProgressVersion(item)]
    );
    await touchLearnerState(transaction, context.userId, item);
    const current = result.rows[0]!;
    const alreadyAudited = await oneOrNone<{ id: string }>(
      transaction,
      `SELECT id FROM audit_events
        WHERE actor_user_id=$1 AND action='program.item_completed'
          AND target_type='program_item' AND target_id=$2 LIMIT 1`,
      [context.userId, item.id]
    );
    if (!alreadyAudited) {
      await recordAudit(transaction, {
        workspaceId: context.workspaceId,
        actorUserId: context.userId,
        actorType: "user",
        action: "program.item_completed",
        targetType: "program_item",
        targetId: item.id,
        origin: "api",
        requestId: context.requestId,
        outcome: "succeeded",
        metadata: { contentVersion: item.contentVersion, progressVersion: itemProgressVersion(item), itemType: item.type }
      });
    }
    const programCompletion = await evaluateProgramCompletion(transaction, configuration, program, context);
    return { progress: toProgress(current), programCompletion };
  });
  return result;
}

function fieldHasResponse(field: ActivityField, value: unknown): boolean {
  if (field.type === "written_response") return typeof value === "string" && value.trim().length > 0;
  if (field.type === "numeric_response") return typeof value === "string" && value.trim().length > 0 && Number.isFinite(Number(value));
  if (field.type === "multi_select") return Array.isArray(value) && value.length >= (field.minSelections ?? 1) && value.length <= (field.maxSelections ?? field.options.length) && new Set(value).size === value.length && value.every((entry) => field.options.some((option) => option.id === entry));
  if (field.type === "ordering") {
    return Array.isArray(value) && value.length === field.options.length && new Set(value).size === field.options.length;
  }
  if (field.type === "mapping") {
    if (!structuredFieldComplete(value, field.left.map((entry) => entry.id), field.right.map((entry) => entry.id))) return false;
    return new Set((value as string[]).map((entry) => entry.split(":")[1])).size === field.left.length;
  }
  if (field.type === "score_matrix") return structuredFieldComplete(value, field.rows.map((entry) => entry.id), Array.from({ length: field.maxScore }, (_, index) => String(index + 1)));
  if (field.type === "classification") {
    if (!structuredFieldComplete(value, field.items.map((entry) => entry.id), field.categories.map((entry) => entry.id))) return false;
    const selected = value as string[];
    return field.categories.every((category) => category.requiredCount === undefined || selected.filter((entry) => entry.endsWith(`:${category.id}`)).length === category.requiredCount);
  }
  if (field.type === "assortment_builder") {
    if (!Array.isArray(value) || value.length < field.minSkus || value.length > field.maxSkus) return false;
    const valid = value.every((entry) => {
      if (typeof entry !== "string") return false;
      const [id, rawQuantity, extra] = entry.split(":");
      const product = field.products.find((candidate) => candidate.id === id);
      const quantity = Number(rawQuantity);
      return !extra && product && Number.isInteger(quantity) && quantity > 0 && quantity % product.casePack === 0;
    });
    if (!valid) return false;
    const selections = value as string[];
    const total = selections.reduce((sum, entry) => {
      const [id, rawQuantity] = entry.split(":");
      const product = field.products.find((candidate) => candidate.id === id)!;
      return sum + product.wholesale * Number(rawQuantity);
    }, 0);
    return (field.budget === undefined || total <= field.budget) && (field.openingMinimum === undefined || total >= field.openingMinimum);
  }
  return typeof value === "string" && field.options.some((option) => option.id === value);
}

function structuredFieldComplete(value: unknown, leftIds: string[], rightIds: string[]): boolean {
  if (!Array.isArray(value) || value.length !== leftIds.length) return false;
  const mapped = new Map(value.flatMap((entry) => {
    if (typeof entry !== "string") return [];
    const [left, right, extra] = entry.split(":");
    return !extra && left && right ? [[left, right] as const] : [];
  }));
  return mapped.size === leftIds.length && leftIds.every((id) => rightIds.includes(mapped.get(id) ?? ""));
}

function validateActivityResponse(item: ProgramLearningItem, response: ProgramActivityResponse): void {
  if (item.type === "knowledge_check") {
    const questions = item.knowledgeCheck?.questions ?? [];
    if (!questions.length) {
      throw new AppError(409, "program_activity_unconfigured", "This knowledge check is not ready for submission.");
    }
    const responses = knowledgeResponses(response);
    for (const question of questions) {
      const value = responses[question.id];
      if (question.type === "multiple_select") {
        if (!Array.isArray(value) || value.length === 0 || new Set(value).size !== value.length ||
          !value.every((entry) => typeof entry === "string" && question.options.some((option) => option.id === entry))) {
          throw new AppError(422, "program_response_required", "Respond to every knowledge-check question.");
        }
      } else if (question.type === "single_choice") {
        if (typeof value !== "string" || !question.options.some((option) => option.id === value)) {
          throw new AppError(422, "program_response_required", "Respond to every knowledge-check question.");
        }
      } else if (question.type === "true_false") {
        if (value !== "true" && value !== "false") {
          throw new AppError(422, "program_response_required", "Respond to every knowledge-check question.");
        }
      } else if (question.type === "numeric_calculation") {
        const supplied = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
        if (!Number.isFinite(supplied)) {
          throw new AppError(422, "program_response_required", "Enter a valid number for every calculation.");
        }
      } else if (question.type === "ordering") {
        if (!Array.isArray(value) || value.length !== question.options.length || new Set(value).size !== question.options.length ||
          !value.every((entry) => question.options.some((option) => option.id === entry))) {
          throw new AppError(422, "program_response_required", "Complete every knowledge-check ordering response.");
        }
      } else {
        const leftIds = new Set(question.left.map((entry) => entry.id));
        const rightIds = new Set(question.right.map((entry) => entry.id));
        if (!Array.isArray(value) || value.length !== question.left.length || !value.every((entry) => {
          if (typeof entry !== "string") return false;
          const [left, right, extra] = entry.split(":");
          return !extra && Boolean(left) && Boolean(right) && leftIds.has(left!) && rightIds.has(right!);
        })) {
          throw new AppError(422, "program_response_required", "Complete every knowledge-check matching response.");
        }
      }
    }
    return;
  }
  if (!item.activity?.steps.length) {
    throw new AppError(409, "program_activity_unconfigured", "This learning activity is not ready for submission.");
  }
  for (const step of item.activity.steps.filter((entry) => entry.required)) {
    const stepResponse = response.steps[step.id];
    if (!stepResponse) throw new AppError(422, "program_response_required", "Complete every required activity step.");
    for (const field of step.fields.filter((entry) => entry.required)) {
      if (!fieldHasResponse(field, stepResponse[field.id])) {
        throw new AppError(422, "program_response_required", "Complete every required activity response.");
      }
    }
  }
}

function validateAssessmentResponses(questions: AssessmentQuestion[], response: ProgramActivityResponse): void {
  questions.forEach((question, index) => {
    const temporaryItem: ProgramLearningItem = {
      id: "assessment-validation",
      slug: "assessment-validation",
      moduleId: "final-assessment",
      title: "Assessment validation",
      description: "Assessment validation",
      position: 1,
      type: "knowledge_check",
      status: "published",
      required: true,
      contentVersion: 1,
      blocks: [],
      knowledgeCheck: { introduction: "", questions: [question] }
    };
    try {
      validateActivityResponse(temporaryItem, response);
    } catch (caught) {
      if (caught instanceof AppError && caught.type === "program_response_required") {
        throw new AppError(422, "program_response_required", `Question ${index + 1} needs a complete answer.`);
      }
      throw caught;
    }
  });
}

function gradeAssessment(questions: AssessmentQuestion[], response: ProgramActivityResponse, attemptNumber: number, passingPercentage: number): FinalAssessmentResult {
  const answers = knowledgeResponses(response);
  const performance = (Object.keys(assessmentWeights) as AssessmentDomain[]).map((domain) => {
    const domainQuestions = questions.filter((question) => question.domain === domain);
    const correct = domainQuestions.filter((question) => responseAligns(question, answers[question.id])).length;
    return { domain, correct, total: domainQuestions.length, percentage: Math.round((correct / domainQuestions.length) * 100) };
  });
  const correctAnswers = performance.reduce((total, domain) => total + domain.correct, 0);
  const score = Math.round((correctAnswers / questions.length) * 100);
  const passed = score >= passingPercentage;
  return {
    attemptNumber,
    score,
    passingPercentage,
    correctAnswers,
    totalQuestions: questions.length,
    passed,
    heading: passed ? "The Ryva Program: Assessment complete" : "Review recommended before your next attempt.",
    performance
  };
}

async function submitFinalAssessment(
  database: Database,
  configuration: AppConfig,
  program: ProgramDefinition,
  context: ProgramMutationContext,
  item: ProgramLearningItem,
  response: ProgramActivityResponse
) {
  if (!item.assessment) throw new AppError(409, "program_activity_unconfigured", "The assessment is not ready.");
  const assessment = item.assessment;
  return withTransaction(database, async (transaction) => {
    await assertItemAvailable(transaction, program, context.userId, item);
    const attempts = await transaction.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM program_activity_submissions
        WHERE user_id=$1 AND learning_item_id=$2 AND content_version=$3`,
      [context.userId, item.id, itemProgressVersion(item)]
    );
    const attemptNumber = attempts.rows[0]!.count + 1;
    const questions = assessmentQuestions(item, attemptNumber);
    validateAssessmentResponses(questions, response);
    const assessmentResult = gradeAssessment(questions, response, attemptNumber, assessment.passingPercentage);
    const storedResponse: ProgramActivityResponse = { steps: response.steps, assessmentResult };
    const submissionId = newId();
    await transaction.query(
      `INSERT INTO program_activity_submissions
        (id,user_id,learning_item_id,content_version,response_json,completion_state,submitted_at)
       VALUES ($1,$2,$3,$4,$5,$6,clock_timestamp())`,
      [submissionId, context.userId, item.id, itemProgressVersion(item), storedResponse, assessmentResult.passed ? "completed" : "submitted"]
    );
    const progressResult = await transaction.query<ProgressRow>(
      `INSERT INTO program_item_progress
        (id,user_id,learning_item_id,content_version,started_at,completed_at,last_viewed_at,progress_metadata)
       VALUES ($1,$2,$3,$4,clock_timestamp(),$5,clock_timestamp(),$6)
       ON CONFLICT (user_id,learning_item_id,content_version) DO UPDATE SET
         started_at=coalesce(program_item_progress.started_at,clock_timestamp()),
         completed_at=CASE WHEN $5::timestamptz IS NOT NULL THEN coalesce(program_item_progress.completed_at,$5::timestamptz) ELSE program_item_progress.completed_at END,
         last_viewed_at=clock_timestamp(),progress_metadata=$6,updated_at=clock_timestamp()
       RETURNING learning_item_id,content_version,started_at,completed_at,last_viewed_at`,
      [newId(), context.userId, item.id, itemProgressVersion(item), assessmentResult.passed ? new Date() : null, assessmentResult]
    );
    await touchLearnerState(transaction, context.userId, item);
    await recordAudit(transaction, {
      workspaceId: context.workspaceId,
      actorUserId: context.userId,
      actorType: "user",
      action: "program.assessment_submitted",
      targetType: "program_item",
      targetId: item.id,
      origin: "api",
      requestId: context.requestId,
      outcome: "succeeded",
      metadata: { attemptNumber, score: assessmentResult.score, passed: assessmentResult.passed }
    });
    const programCompletion = assessmentResult.passed
      ? await evaluateProgramCompletion(transaction, configuration, program, context)
      : null;
    return { submissionId, progress: toProgress(progressResult.rows[0]!), assessmentResult, programCompletion };
  });
}

export async function submitProgramActivity(
  database: Database,
  configuration: AppConfig,
  program: ProgramDefinition,
  context: ProgramMutationContext,
  itemIdentifier: string,
  response: ProgramActivityResponse
) {
  const item = requirePublishedItem(program, itemIdentifier);
  if (!isActivity(item)) {
    throw new AppError(409, "program_activity_not_supported", "This Program item does not accept a submission.");
  }
  if (item.type === "final_assessment") {
    return submitFinalAssessment(database, configuration, program, context, item, response);
  }
  validateActivityResponse(item, response);
  return withTransaction(database, async (transaction) => {
    await assertItemAvailable(transaction, program, context.userId, item);
    const submissionId = newId();
    await transaction.query(
      `INSERT INTO program_activity_submissions
        (id,user_id,learning_item_id,content_version,response_json,completion_state,submitted_at)
       VALUES ($1,$2,$3,$4,$5,'completed',clock_timestamp())`,
      [submissionId, context.userId, item.id, itemProgressVersion(item), response]
    );
    const progress = await transaction.query<ProgressRow>(
      `INSERT INTO program_item_progress
        (id,user_id,learning_item_id,content_version,started_at,completed_at,last_viewed_at)
       VALUES ($1,$2,$3,$4,clock_timestamp(),clock_timestamp(),clock_timestamp())
       ON CONFLICT (user_id,learning_item_id,content_version) DO UPDATE SET
         started_at=coalesce(program_item_progress.started_at,clock_timestamp()),
         completed_at=coalesce(program_item_progress.completed_at,clock_timestamp()),
         last_viewed_at=clock_timestamp(),updated_at=clock_timestamp()
       RETURNING learning_item_id,content_version,started_at,completed_at,last_viewed_at`,
      [newId(), context.userId, item.id, itemProgressVersion(item)]
    );
    await touchLearnerState(transaction, context.userId, item);
    await recordAudit(transaction, {
      workspaceId: context.workspaceId,
      actorUserId: context.userId,
      actorType: "user",
      action: "program.activity_submitted",
      targetType: "program_item",
      targetId: item.id,
      origin: "api",
      requestId: context.requestId,
      outcome: "succeeded",
      metadata: { submissionId, contentVersion: item.contentVersion, progressVersion: itemProgressVersion(item), itemType: item.type }
    });
    const programCompletion = await evaluateProgramCompletion(transaction, configuration, program, context);
    return {
      submissionId,
      progress: toProgress(progress.rows[0]!),
      programCompletion,
      considerations: item.activity?.steps.flatMap((step) => step.considerations ?? []) ?? [],
      knowledgeFeedback: item.type === "knowledge_check" ? evaluateKnowledgeCheck(item, response) : null
    };
  });
}
