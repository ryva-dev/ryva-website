import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { api, type AccessDecision } from "../api";
import { appPath } from "../appBase";
import { useAuth } from "../auth";
import { Alert, Button, ErrorState, LoadingState } from "../design-system";
import "./program.css";

type ItemType = "article" | "video" | "knowledge_check" | "guided_exercise" | "guided_practice" | "reflection" | "final_simulation" | "final_assessment";
type ItemSummary = {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: ItemType;
  required: boolean;
  estimatedMinutes: number | null;
  contentVersion: number;
  completed: boolean;
  started: boolean;
};
type ModuleSummary = {
  id: string;
  slug: string;
  title: string;
  description: string;
  position: number;
  state: "available" | "current" | "completed" | "locked" | "preparing";
  requiredItems: number;
  completedRequiredItems: number;
  estimatedMinutes: number;
  items: ItemSummary[];
};
type Dashboard = {
  program: { id: string; title: string; heading: string; description: string; version: number };
  progress: {
    completedRequiredItems: number;
    totalRequiredItems: number;
    percentage: number;
    completionConfigured: boolean;
    finalSimulationPublished: boolean;
  };
  modules: ModuleSummary[];
  finalSimulation: ItemSummary & { state: "available" | "completed" | "locked" | "draft" };
  finalAssessment: (ItemSummary & { state: "available" | "completed" | "locked" | "draft" }) | null;
  continueTo: { moduleSlug: string; itemSlug: string } | null;
  programCompletedAt: string | null;
};
type ContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string; level: 2 | 3 }
  | { type: "pull_quote"; text: string }
  | { type: "callout"; title: string; text: string }
  | { type: "list"; items: string[] }
  | { type: "formula"; title: string; formula: string; example: string; result: string; note?: string }
  | { type: "data_table"; caption: string; columns: string[]; rows: string[][]; note?: string }
  | { type: "media"; reference: string; alt: string; caption?: string }
  | { type: "relationship_visual"; centerLabel: string; participants: Array<{ id: string; label: string; role: string; perspective?: string }> }
  | { type: "commercial_journey"; steps: Array<{ id: string; label: string; description: string }>; note: string }
  | { type: "comparison"; columns: Array<{ id: string; title: string; body: string; points?: string[] }> }
  | {
      type: "workspace_preview";
      eyebrow: string;
      title: string;
      description: string;
      scenario: { title: string; facts: string[] };
      areas: Array<{ id: string; label: string; purpose: string; fictionalRecord: string }>;
      prompts: string[];
    }
  | {
      type: "visual_briefing";
      id: string;
      title: string;
      subtitle: string;
      slides: VisualBriefingSlide[];
    }
  | { type: "divider" };
type VisualBriefingSlide = {
  id: string;
  eyebrow?: string;
  title: string;
  body?: string;
  points?: string[];
  flow?: Array<{ label: string; detail: string }>;
  columns?: Array<{ title: string; body: string }>;
  table?: { columns: string[]; rows: string[][] };
  teachingNote?: string;
};
type LibraryResource = {
  id: string;
  title: string;
  category: string;
  summary: string;
  sections: Array<{ title: string; body?: string; items?: string[] }>;
};
type KnowledgeCheckQuestion = (
  | { id: string; type: "single_choice"; prompt: string; options: Array<{ id: string; label: string }> }
  | { id: string; type: "multiple_select"; prompt: string; options: Array<{ id: string; label: string }> }
  | { id: string; type: "true_false"; prompt: string }
  | { id: string; type: "numeric_calculation"; prompt: string; unitLabel?: string }
  | { id: string; type: "ordering"; prompt: string; options: Array<{ id: string; label: string }> }
  | { id: string; type: "matching"; prompt: string; left: Array<{ id: string; label: string }>; right: Array<{ id: string; label: string }> }) & { domain?: string };
type AssessmentResult = {
  attemptNumber: number;
  score: number;
  passingPercentage: number;
  correctAnswers: number;
  totalQuestions: number;
  passed: boolean;
  heading: string;
  performance: Array<{ domain: string; correct: number; total: number; percentage: number }>;
};
type KnowledgeCheckFeedback = {
  questions: Array<{
    questionId: string;
    outcome: "aligned" | "review" | "compare";
    heading: "Correct" | "Not quite";
    explanation: string;
    referenceAnswer?: string;
    thingsToNotice: string[];
  }>;
};
type ActivityField =
  | { id: string; type: "written_response"; label: string; required: boolean; maxLength?: number }
  | { id: string; type: "numeric_response"; label: string; required: boolean; unitLabel?: string }
  | { id: string; type: "multi_select"; label: string; required: boolean; minSelections?: number; maxSelections?: number; options: Array<{ id: string; label: string }> }
  | { id: string; type: "option_selection" | "comparison"; label: string; required: boolean; options: Array<{ id: string; label: string }> }
  | { id: string; type: "ordering"; label: string; required: boolean; options: Array<{ id: string; label: string }> }
  | { id: string; type: "mapping"; label: string; required: boolean; left: Array<{ id: string; label: string }>; right: Array<{ id: string; label: string }> }
  | { id: string; type: "score_matrix"; label: string; required: boolean; maxScore: number; rows: Array<{ id: string; label: string }> }
  | { id: string; type: "classification"; label: string; required: boolean; items: Array<{ id: string; label: string }>; categories: Array<{ id: string; label: string; requiredCount?: number }> }
  | { id: string; type: "assortment_builder"; label: string; required: boolean; minSkus: number; maxSkus: number; openingMinimum?: number; budget?: number; products: Array<{ id: string; label: string; wholesale: number; msrp: number; casePack: number }> };
type ActivityStep = {
  id: string;
  title: string;
  context?: string;
  prompt: string;
  fields: ActivityField[];
  followUpContext?: string;
  considerations?: string[];
  required: boolean;
};
type LearningItem = ItemSummary & {
  moduleId: string;
  blocks: ContentBlock[];
  media?:
    | { status: "awaiting_production"; intendedRole: "primary_explanation"; writtenEdition: "substantive" }
    | {
        status: "available";
        intendedRole: "primary_explanation" | "supporting";
        writtenEdition: "substantive" | "field_notes";
        reference: string;
        posterReference?: string;
        transcript?: ContentBlock[];
      };
  knowledgeCheck?: { introduction: string; questions: KnowledgeCheckQuestion[] };
  assessment?: { questionCount: number; passingPercentage: number; recommendedMinutes: number };
  activity?: { introduction?: string; steps: ActivityStep[] };
};
type ItemPayload = {
  item: LearningItem;
  progress: { completedAt: string | null } | null;
  submission: {
    id: string;
    submittedAt: string;
    considerations: string[];
    knowledgeFeedback: KnowledgeCheckFeedback | null;
    response: { steps: Record<string, Record<string, unknown>> } | null;
    assessmentResult?: AssessmentResult | null;
  } | null;
  module: { id: string; slug: string; title: string; position: number; items: ItemSummary[] } | null;
  navigation: {
    previous: { id: string; slug: string; moduleSlug: string } | null;
    next: { id: string; slug: string; moduleSlug: string } | null;
  };
};

function useProgramAccess(): boolean {
  const { session } = useAuth();
  return Boolean(session?.access.canAccessProgram);
}

function itemTypeLabel(type: ItemType): string {
  return ({
    article: "Lesson",
    video: "Video",
    knowledge_check: "Knowledge Check",
    guided_exercise: "Guided Exercise",
    guided_practice: "Guided Practice",
    reflection: "Reflection",
    final_simulation: "Final Simulation",
    final_assessment: "Final Assessment"
  })[type];
}

function stateLabel(state: ModuleSummary["state"] | Dashboard["finalSimulation"]["state"]): string {
  return ({
    available: "Available",
    current: "Continue here",
    completed: "Completed",
    locked: "Locked",
    preparing: "In preparation",
    draft: "In preparation"
  })[state];
}

type ModuleRailItem = { item: ItemSummary; check?: ItemSummary };

function groupedModuleItems(items: ItemSummary[]): ModuleRailItem[] {
  return items.reduce<ModuleRailItem[]>((groups, item) => {
    if (item.type === "knowledge_check" && groups.length) {
      groups[groups.length - 1] = { ...groups[groups.length - 1]!, check: item };
      return groups;
    }
    groups.push({ item });
    return groups;
  }, []);
}

function associatedCheck(items: ItemSummary[], itemId: string): ItemSummary | null {
  const index = items.findIndex((item) => item.id === itemId);
  const candidate = index >= 0 ? items[index + 1] : undefined;
  return candidate?.type === "knowledge_check" ? candidate : null;
}

function normalJourneyPath(target: Dashboard["continueTo"], modules: ModuleSummary[]): string | null {
  if (!target) return null;
  if (target.moduleSlug === "final-simulation") return appPath("/program/final-simulation");
  if (target.moduleSlug === "final-assessment") return appPath("/program/final-assessment");
  const module = modules.find((entry) => entry.slug === target.moduleSlug);
  const targetIndex = module?.items.findIndex((item) => item.slug === target.itemSlug) ?? -1;
  const targetItem = targetIndex >= 0 ? module?.items[targetIndex] : undefined;
  const parentItem = targetItem?.type === "knowledge_check" && targetIndex > 0
    ? module?.items[targetIndex - 1]
    : targetItem;
  return appPath(`/program/${target.moduleSlug}/${parentItem?.slug ?? target.itemSlug}`);
}

function ProgramFrame({ children }: { children: ReactNode }) {
  return <div className="ry-program-page">{children}</div>;
}

function ProgramMasthead({ compact = false }: { compact?: boolean }) {
  return <header className={compact ? "ry-program-masthead compact" : "ry-program-masthead"}>
    <Link to={appPath("/program")} className="ry-program-kicker">The Ryva Program</Link>
    {!compact ? <p>Independent industry education and guided practice in brand placement.</p> : null}
  </header>;
}

function ProgressMeter({ value, label }: { value: number; label: string }) {
  return <div className="ry-program-progress">
    <div><span>{label}</span><strong>{value}%</strong></div>
    <progress value={value} max={100} aria-label={`${label}: ${value}%`} />
  </div>;
}

export function ProgramDashboardPage() {
  const canAccess = useProgramAccess();
  const { session } = useAuth();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!canAccess) return;
    let active = true;
    void api<Dashboard>("/api/program")
      .then((result) => { if (active) setDashboard(result); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "The Program could not be loaded."); });
    return () => { active = false; };
  }, [canAccess]);
  if (!canAccess) return <Navigate to={appPath("/access")} replace />;
  if (error) return <ProgramFrame><ProgramMasthead /><ErrorState message={error} /></ProgramFrame>;
  if (!dashboard) return <LoadingState label="Opening The Ryva Program" />;
  const current = dashboard.modules.find((module) => module.state === "current") ?? dashboard.modules[0];
  const continuePath = dashboard.continueTo
    ? normalJourneyPath(dashboard.continueTo, dashboard.modules)
    : current && current.state !== "locked" && current.state !== "preparing"
      ? appPath(`/program/${current.slug}`)
      : null;
  return <ProgramFrame>
    <ProgramMasthead />
    <section className="ry-program-hero" aria-labelledby="program-title">
      <div>
        <p className="ry-program-overline">The Ryva Program</p>
        <h1 id="program-title">{dashboard.program.heading}</h1>
        <p>{dashboard.program.description}</p>
        {continuePath ? <Link className="ry-program-primary-link" to={continuePath}>Continue Learning</Link> : null}
      </div>
      <aside aria-label="Program progress">
        <ProgressMeter value={dashboard.progress.percentage} label="Program Progress" />
        <dl>
          <div><dt>Current module</dt><dd>{current ? `${current.position}. ${current.title}` : "Preparing curriculum"}</dd></div>
          <div><dt>Completed</dt><dd>{dashboard.progress.completedRequiredItems} of {dashboard.progress.totalRequiredItems} required items</dd></div>
        </dl>
      </aside>
    </section>

    {dashboard.programCompletedAt ? <ProgramCompletionPanel canEnterOperating={Boolean(session?.access.canAccessOperatingPlatform)} /> : null}

    <section className="ry-program-journey" aria-labelledby="journey-heading">
      <header>
        <p className="ry-program-overline">Your learning journey</p>
        <h2 id="journey-heading">Eight connected modules</h2>
        <p>Move from the shape of the industry toward the commercial relationships that sustain it.</p>
      </header>
      <ol>
        {dashboard.modules.map((module) => {
          const open = module.state !== "locked" && module.state !== "preparing";
          return <li className={`ry-program-module-row state-${module.state}`} key={module.id}>
            <span className="ry-program-module-number" aria-hidden="true">{String(module.position).padStart(2, "0")}</span>
            <div>
              <span className="ry-program-state">{stateLabel(module.state)}</span>
              <h3>{open ? <Link to={appPath(`/program/${module.slug}`)}>{module.title}</Link> : module.title}</h3>
              <p>{module.description}</p>
            </div>
            <div className="ry-program-module-meta">
              <span>{module.completedRequiredItems}/{module.requiredItems} required</span>
              {module.estimatedMinutes ? <span>{module.estimatedMinutes} min</span> : <span>Lessons in preparation</span>}
            </div>
          </li>;
        })}
      </ol>
      <article className={`ry-program-final-row state-${dashboard.finalSimulation.state}`}>
        <div>
          <span className="ry-program-state">{stateLabel(dashboard.finalSimulation.state)}</span>
          <h3>{dashboard.finalSimulation.state === "available" || dashboard.finalSimulation.state === "completed"
            ? <Link to={appPath("/program/final-simulation")}>Final Simulation</Link>
            : "Final Simulation"}</h3>
          <p>One connected scenario. Brand to product, buyer, placement, order, and continuing account relationship.</p>
        </div>
        <blockquote>“What would you pay attention to next?”</blockquote>
      </article>
      {dashboard.finalAssessment ? <article className={`ry-program-final-row state-${dashboard.finalAssessment.state}`}>
        <div>
          <span className="ry-program-state">{stateLabel(dashboard.finalAssessment.state)}</span>
          <h3>{dashboard.finalAssessment.state === "available" || dashboard.finalAssessment.state === "completed"
            ? <Link to={appPath("/program/final-assessment")}>Final Brand Placement Assessment</Link>
            : "Final Brand Placement Assessment"}</h3>
          <p>Fifty mixed questions across concepts, scenarios, calculations, and commercial interpretation. An 80% score completes the Program.</p>
        </div>
        <blockquote>“Review, interpret, calculate.”</blockquote>
      </article> : null}
    </section>
    <section className="ry-program-library-callout" aria-labelledby="library-callout-heading">
      <div>
        <p className="ry-program-overline">Reference library</p>
        <h2 id="library-callout-heading">Brand Placement Library</h2>
        <p>Return to the Program's field guides, worksheets, commercial checklists, and decision frameworks whenever you need them.</p>
      </div>
      <Link className="ry-program-secondary-link" to={appPath("/program/library")}>Open the library</Link>
    </section>
  </ProgramFrame>;
}

export function ProgramLibraryPage() {
  const canAccess = useProgramAccess();
  const [resources, setResources] = useState<LibraryResource[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!canAccess) return;
    let active = true;
    void api<{ resources: LibraryResource[] }>("/api/program/library")
      .then((result) => { if (active) setResources(result.resources); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "The library could not be loaded."); });
    return () => { active = false; };
  }, [canAccess]);
  if (!canAccess) return <Navigate to={appPath("/access")} replace />;
  if (error) return <ProgramFrame><ProgramMasthead compact /><ErrorState message={error} /></ProgramFrame>;
  if (!resources.length) return <LoadingState label="Opening the Brand Placement Library" />;
  const categories = [...new Set(resources.map((resource) => resource.category))];
  return <ProgramFrame>
    <ProgramMasthead compact />
    <main className="ry-program-library">
      <header>
        <Link to={appPath("/program")} className="ry-program-back">← Program journey</Link>
        <p className="ry-program-overline">Permanent reference area</p>
        <h1>Brand Placement Library</h1>
        <p>Practical reference tools from across the eight modules. Open any resource for a print-friendly working guide.</p>
        <Button type="button" onClick={() => window.print()}>Print open resources</Button>
      </header>
      {categories.map((category) => <section key={category} aria-labelledby={`library-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
        <h2 id={`library-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>{category}</h2>
        <div className="ry-program-library-grid">{resources.filter((resource) => resource.category === category).map((resource) => <details key={resource.id} id={resource.id}>
          <summary><span>{resource.title}</span><small>{resource.summary}</small></summary>
          <div>{resource.sections.map((section) => <section key={section.title}>
            <h3>{section.title}</h3>
            {section.body ? <p>{section.body}</p> : null}
            {section.items ? <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul> : null}
          </section>)}</div>
        </details>)}</div>
      </section>)}
    </main>
  </ProgramFrame>;
}

export function ProgramModulePage() {
  const canAccess = useProgramAccess();
  const { moduleSlug = "" } = useParams();
  const [module, setModule] = useState<ModuleSummary | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!canAccess) return;
    let active = true;
    void api<{ module: ModuleSummary }>(`/api/program/modules/${encodeURIComponent(moduleSlug)}`)
      .then((result) => { if (active) setModule(result.module); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "This module could not be loaded."); });
    return () => { active = false; };
  }, [canAccess, moduleSlug]);
  if (!canAccess) return <Navigate to={appPath("/access")} replace />;
  if (error) return <ProgramFrame><ProgramMasthead compact /><ErrorState message={error} /></ProgramFrame>;
  if (!module) return <LoadingState label="Opening module" />;
  const railItems = groupedModuleItems(module.items);
  return <ProgramFrame>
    <ProgramMasthead compact />
    <div className="ry-program-module-layout">
      <header>
        <Link to={appPath("/program")} className="ry-program-back">← Program journey</Link>
        <p className="ry-program-overline">Module {module.position}</p>
        <h1>{module.title}</h1>
        <p>{module.description}</p>
        <ProgressMeter
          value={module.requiredItems ? Math.round((module.completedRequiredItems / module.requiredItems) * 100) : 0}
          label="Module progress"
        />
      </header>
      <section aria-labelledby="module-items-heading">
        <h2 id="module-items-heading">In this module</h2>
        {railItems.length ? <ol className="ry-program-item-list">
          {railItems.map(({ item, check }, index) => <li key={item.id}>
            <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <small>{itemTypeLabel(item.type)}{item.estimatedMinutes ? ` · ${item.estimatedMinutes} min` : ""}</small>
              <h3><Link to={appPath(`/program/${module.slug}/${item.slug}`)}>{item.title}</Link></h3>
              <p>{item.description}</p>
              {check ? <span className="ry-program-inline-check-status">
                <span aria-hidden="true">✓</span>
                Knowledge check included · {check.completed ? "Completed" : check.started ? "Continue" : "Ready"}
              </span> : null}
            </div>
            <strong>{item.completed && (!check || check.completed) ? "Completed" : item.started || check?.started ? "Continue" : "Begin"}</strong>
          </li>)}
        </ol> : <div className="ry-program-preparing">
          <h3>Lessons are in editorial preparation.</h3>
          <p>The module structure is ready. Draft lesson bodies remain private until they are reviewed and published.</p>
        </div>}
      </section>
    </div>
  </ProgramFrame>;
}

function ContentBlocks({ blocks }: { blocks: ContentBlock[] }) {
  return <div className="ry-program-prose">
    {blocks.map((block, index) => {
      const key = `${block.type}-${index}`;
      if (block.type === "paragraph") return <p key={key}>{block.text}</p>;
      if (block.type === "heading") return block.level === 2 ? <h2 key={key}>{block.text}</h2> : <h3 key={key}>{block.text}</h3>;
      if (block.type === "pull_quote") return <blockquote key={key}>{block.text}</blockquote>;
      if (block.type === "callout") return <aside className="ry-program-callout" key={key}><strong>{block.title}</strong><p>{block.text}</p></aside>;
      if (block.type === "list") return <ul key={key}>{block.items.map((item) => <li key={item}>{item}</li>)}</ul>;
      if (block.type === "formula") return <FormulaWalkthrough block={block} key={key} />;
      if (block.type === "data_table") return <CommercialTable block={block} key={key} />;
      if (block.type === "media") return <figure key={key}><div className="ry-program-media-placeholder" role="img" aria-label={block.alt}>Media reference: {block.reference}</div>{block.caption ? <figcaption>{block.caption}</figcaption> : null}</figure>;
      if (block.type === "relationship_visual") return <RelationshipVisual block={block} key={key} />;
      if (block.type === "commercial_journey") return <CommercialJourney block={block} key={key} />;
      if (block.type === "comparison") return <ComparisonVisual block={block} key={key} />;
      if (block.type === "workspace_preview") return <WorkspacePreview block={block} key={key} />;
      if (block.type === "visual_briefing") return <VisualBriefing block={block} key={key} />;
      return <hr key={key} />;
    })}
  </div>;
}

export function VisualBriefing({ block }: { block: Extract<ContentBlock, { type: "visual_briefing" }> }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = block.slides[activeIndex];
  const lastIndex = Math.max(0, block.slides.length - 1);
  const move = (direction: number) => setActiveIndex((current) => Math.min(lastIndex, Math.max(0, current + direction)));
  if (!active) return null;
  return <section
    className="ry-program-briefing"
    aria-label={`${block.title} visual briefing`}
    onKeyDown={(event) => {
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
    }}
    tabIndex={0}
  >
    <header>
      <div><span>Visual Briefing</span><h2>{block.title}</h2><p>{block.subtitle}</p></div>
      <strong>{String(activeIndex + 1).padStart(2, "0")} / {String(block.slides.length).padStart(2, "0")}</strong>
    </header>
    <progress value={activeIndex + 1} max={block.slides.length} aria-label={`Slide ${activeIndex + 1} of ${block.slides.length}`} />
    <article className="ry-program-briefing-slide" aria-live="polite">
      <span>{active.eyebrow}</span>
      <h3>{active.title}</h3>
      {active.body ? <p>{active.body}</p> : null}
      {active.points ? <ul>{active.points.map((point) => <li key={point}>{point}</li>)}</ul> : null}
      {active.flow ? <ol className="ry-program-briefing-flow">{active.flow.map((step, index) => <li key={step.label}><span>{String(index + 1).padStart(2, "0")}</span><strong>{step.label}</strong><p>{step.detail}</p></li>)}</ol> : null}
      {active.columns ? <div className="ry-program-briefing-columns">{active.columns.map((column) => <section key={column.title}><h4>{column.title}</h4><p>{column.body}</p></section>)}</div> : null}
      {active.table ? <CommercialTable block={{ type: "data_table", caption: active.title, columns: active.table.columns, rows: active.table.rows }} /> : null}
    </article>
    <footer>
      <Button type="button" disabled={activeIndex === 0} onClick={() => move(-1)} aria-label="Previous slide">Previous</Button>
      <div role="group" aria-label="Choose a slide">{block.slides.map((slide, index) => <button aria-label={`Go to slide ${index + 1}: ${slide.title}`} aria-pressed={index === activeIndex} key={slide.id} onClick={() => setActiveIndex(index)} type="button" />)}</div>
      <Button type="button" disabled={activeIndex === lastIndex} onClick={() => move(1)} aria-label="Next slide">Next</Button>
    </footer>
    {active.teachingNote ? <aside><strong>Teaching note</strong><p>{active.teachingNote}</p></aside> : null}
  </section>;
}

function FormulaWalkthrough({ block }: { block: Extract<ContentBlock, { type: "formula" }> }) {
  return <figure className="ry-program-formula">
    <figcaption>{block.title}</figcaption>
    <code>{block.formula}</code>
    <p>{block.example}</p>
    <strong>{block.result}</strong>
    {block.note ? <small>{block.note}</small> : null}
  </figure>;
}

function CommercialTable({ block }: { block: Extract<ContentBlock, { type: "data_table" }> }) {
  return <figure className="ry-program-data-table">
    <figcaption>{block.caption}</figcaption>
    <div><table><thead><tr>{block.columns.map((column) => <th scope="col" key={column}>{column}</th>)}</tr></thead>
      <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, index) => index === 0 ? <th scope="row" key={index}>{cell}</th> : <td key={index}>{cell}</td>)}</tr>)}</tbody>
    </table></div>
    {block.note ? <p>{block.note}</p> : null}
  </figure>;
}

function RelationshipVisual({ block }: { block: Extract<ContentBlock, { type: "relationship_visual" }> }) {
  return <figure className="ry-program-relationship-visual" aria-labelledby="relationship-visual-title">
    <figcaption id="relationship-visual-title">Each participant views the same commercial relationship from a different perspective.</figcaption>
    <div className="ry-program-relationship-center">{block.centerLabel}</div>
    <ul>
      {block.participants.map((participant) => <li key={participant.id}>
        <strong>{participant.label}</strong>
        <p>{participant.role}</p>
        {participant.perspective ? <blockquote>“{participant.perspective}”</blockquote> : null}
      </li>)}
    </ul>
  </figure>;
}

function CommercialJourney({ block }: { block: Extract<ContentBlock, { type: "commercial_journey" }> }) {
  return <figure className="ry-program-commercial-journey" aria-labelledby="commercial-journey-title">
    <figcaption id="commercial-journey-title">The commercial journey</figcaption>
    <ol>
      {block.steps.map((step, index) => <li key={step.id}>
        <span>{String(index + 1).padStart(2, "0")}</span>
        <strong>{step.label}</strong>
        <p>{step.description}</p>
      </li>)}
    </ol>
    <p className="ry-program-visual-note">{block.note}</p>
  </figure>;
}

function ComparisonVisual({ block }: { block: Extract<ContentBlock, { type: "comparison" }> }) {
  return <div className="ry-program-comparison">
    {block.columns.map((column) => <article key={column.id}>
      <h3>{column.title}</h3>
      <p>{column.body}</p>
      {column.points?.length ? <ul>{column.points.map((point) => <li key={point}>{point}</li>)}</ul> : null}
    </article>)}
  </div>;
}

function WorkspacePreview({ block }: { block: Extract<ContentBlock, { type: "workspace_preview" }> }) {
  const [activeArea, setActiveArea] = useState(block.areas[0]?.id ?? "");
  const selected = block.areas.find((area) => area.id === activeArea) ?? block.areas[0];
  return <section className="ry-program-workspace-preview" aria-labelledby="workspace-preview-title">
    <header>
      <div>
        <span>{block.eyebrow}</span>
        <h2 id="workspace-preview-title">{block.title}</h2>
        <p>{block.description}</p>
      </div>
      <strong aria-label="Simulation is read only">Simulation · Read only</strong>
    </header>
    <aside>
      <span>Current context</span>
      <h3>{block.scenario.title}</h3>
      <ul>{block.scenario.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
    </aside>
    <div className="ry-program-preview-map">
      <nav aria-label="Simulated Ryva areas">
        {block.areas.map((area) => <button
          aria-pressed={area.id === activeArea}
          key={area.id}
          onClick={() => setActiveArea(area.id)}
          type="button"
        >{area.label}</button>)}
      </nav>
      {selected ? <article aria-live="polite">
        <span>Fictional Program record</span>
        <h3>{selected.label}</h3>
        <p>{selected.purpose}</p>
        <strong>{selected.fictionalRecord}</strong>
      </article> : null}
    </div>
    <footer>
      <h3>Orient yourself</h3>
      <ol>{block.prompts.map((prompt) => <li key={prompt}>{prompt}</li>)}</ol>
    </footer>
  </section>;
}

function ActivityForm({ item, initialResponses, onCompleted }: { item: LearningItem; initialResponses?: Record<string, Record<string, unknown>>; onCompleted: (completedProgram: boolean, considerations: string[]) => void }) {
  const [responses, setResponses] = useState<Record<string, Record<string, unknown>>>(initialResponses ?? {});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const steps = item.activity?.steps ?? [];

  function setResponse(stepId: string, fieldId: string, value: unknown) {
    setResponses((current) => ({
      ...current,
      [stepId]: { ...current[stepId], [fieldId]: value }
    }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const result = await api<{ programCompletion: unknown; considerations: string[] }>(`/api/program/items/${item.id}/submissions`, {
        method: "POST",
        body: { steps: responses }
      });
      onCompleted(Boolean(result.programCompletion), result.considerations);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your response could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!steps.length) return <Alert tone="info" title="Activity in preparation">This activity structure is not yet published for submission.</Alert>;
  return <form className="ry-program-activity" onSubmit={(event) => { void submit(event); }}>
    {item.activity?.introduction ? <p className="ry-program-activity-intro">{item.activity.introduction}</p> : null}
    {steps.map((step, stepIndex) => <fieldset className="ry-program-activity-step" key={step.id}>
      <legend>
        <span className="ry-program-activity-step-number">Step {stepIndex + 1}</span>
        <span className="ry-program-activity-step-title">{step.title}</span>
      </legend>
      {step.context ? <p className="ry-program-activity-context">{step.context}</p> : null}
      <p className="ry-program-prompt">{step.prompt}</p>
      {step.fields.map((field) => <ActivityFieldControl
        field={field}
        key={field.id}
        value={responses[step.id]?.[field.id]}
        onChange={(value) => setResponse(step.id, field.id, value)}
      />)}
    </fieldset>)}
    {error ? <Alert tone="danger">{error}</Alert> : null}
    <Button type="submit" loading={submitting}>Submit your thinking</Button>
  </form>;
}

function ActivityFieldControl({ field, value, onChange }: { field: ActivityField; value: unknown; onChange: (value: unknown) => void }) {
  if (field.type === "written_response") return <label className="ry-program-field">
    <span>{field.label}{field.required ? " *" : ""}</span>
    <textarea
      required={field.required}
      maxLength={field.maxLength ?? 10_000}
      value={typeof value === "string" ? value : ""}
      onChange={(event) => onChange(event.target.value)}
    />
  </label>;
  if (field.type === "numeric_response") return <label className="ry-program-field ry-program-numeric-field">
    <span>{field.label}{field.required ? " *" : ""}</span>
    <input required={field.required} step="any" type="number" inputMode="decimal" value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} />
    {field.unitLabel ? <small>{field.unitLabel}</small> : null}
  </label>;
  if (field.type === "multi_select") {
    const selected = Array.isArray(value) ? value as string[] : [];
    return <fieldset className="ry-program-options"><legend>{field.label}</legend><div className="ry-program-option-grid">{field.options.map((entry) => <label key={entry.id}>
      <input type="checkbox" checked={selected.includes(entry.id)} onChange={(event) => onChange(event.target.checked ? [...selected, entry.id] : selected.filter((id) => id !== entry.id))} />
      <span>{entry.label}</span>
    </label>)}</div><small>Select {field.minSelections ?? 1}{field.maxSelections ? `–${field.maxSelections}` : "+"}.</small></fieldset>;
  }
  if (field.type === "mapping") {
    const mappings = Array.isArray(value) ? value as string[] : [];
    return <fieldset className="ry-program-mapping-field"><legend>{field.label}</legend>{field.left.map((left) => {
      const current = mappings.find((entry) => entry.startsWith(`${left.id}:`))?.split(":")[1] ?? "";
      return <label key={left.id}><span>{left.label}</span><select required={field.required} value={current} onChange={(event) => {
        const next = mappings.filter((entry) => !entry.startsWith(`${left.id}:`));
        if (event.target.value) next.push(`${left.id}:${event.target.value}`);
        onChange(next);
      }}><option value="">Choose destination</option>{field.right.map((right) => <option key={right.id} value={right.id}>{right.label}</option>)}</select></label>;
    })}</fieldset>;
  }
  if (field.type === "score_matrix") {
    const scores = Array.isArray(value) ? value as string[] : [];
    const total = scores.reduce((sum, entry) => sum + Number(entry.split(":")[1] ?? 0), 0);
    return <fieldset className="ry-program-score-matrix"><legend>{field.label}</legend>{field.rows.map((row) => {
      const current = scores.find((entry) => entry.startsWith(`${row.id}:`))?.split(":")[1] ?? "";
      return <label key={row.id}><span>{row.label}</span><select required={field.required} value={current} onChange={(event) => {
        const next = scores.filter((entry) => !entry.startsWith(`${row.id}:`));
        if (event.target.value) next.push(`${row.id}:${event.target.value}`);
        onChange(next);
      }}><option value="">Score</option>{Array.from({ length: field.maxScore }, (_, index) => <option value={index + 1} key={index + 1}>{index + 1}</option>)}</select></label>;
    })}<strong>Total: {total} / {field.rows.length * field.maxScore}</strong></fieldset>;
  }
  if (field.type === "classification") {
    const classifications = Array.isArray(value) ? value as string[] : [];
    return <fieldset className="ry-program-classification"><legend>{field.label}</legend>{field.items.map((entry) => {
      const current = classifications.find((selection) => selection.startsWith(`${entry.id}:`))?.split(":")[1] ?? "";
      return <label key={entry.id}><span>{entry.label}</span><select required={field.required} value={current} onChange={(event) => {
        const next = classifications.filter((selection) => !selection.startsWith(`${entry.id}:`));
        if (event.target.value) next.push(`${entry.id}:${event.target.value}`);
        onChange(next);
      }}><option value="">Choose priority</option>{field.categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label>;
    })}</fieldset>;
  }
  if (field.type === "assortment_builder") {
    const quantities = new Map((Array.isArray(value) ? value as string[] : []).map((entry) => {
      const [id, quantity] = entry.split(":"); return [id, Number(quantity)] as const;
    }));
    const selected = field.products.filter((product) => (quantities.get(product.id) ?? 0) > 0);
    const total = selected.reduce((sum, product) => sum + (quantities.get(product.id) ?? 0) * product.wholesale, 0);
    const update = (id: string, quantity: number) => onChange(field.products.flatMap((product) => {
      const nextQuantity = product.id === id ? quantity : quantities.get(product.id) ?? 0;
      return nextQuantity > 0 ? [`${product.id}:${nextQuantity}`] : [];
    }));
    return <fieldset className="ry-program-assortment-builder"><legend>{field.label}</legend>
      <div className="ry-program-assortment-summary"><span>{selected.length} SKUs selected</span><strong>${total.toFixed(2)} wholesale</strong>{field.budget ? <span className={total > field.budget ? "is-over" : ""}>Budget ${field.budget.toLocaleString()}</span> : null}{field.openingMinimum ? <span className={total >= field.openingMinimum ? "is-met" : ""}>Minimum ${field.openingMinimum.toLocaleString()}</span> : null}</div>
      <div className="ry-program-assortment-products">{field.products.map((product) => <label key={product.id}><span><strong>{product.label}</strong><small>${product.wholesale} wholesale · ${product.msrp} MSRP · pack {product.casePack}</small></span><select value={quantities.get(product.id) ?? 0} onChange={(event) => update(product.id, Number(event.target.value))}><option value={0}>Not selected</option>{[1,2,3,4,5,6].map((cases) => <option key={cases} value={cases * product.casePack}>{cases * product.casePack} units</option>)}</select></label>)}</div>
      <small>Choose {field.minSkus}–{field.maxSkus} SKUs. Quantities follow each case pack.</small>
    </fieldset>;
  }
  if (field.type === "ordering") return <fieldset className="ry-program-ordering">
    <legend>{field.label}</legend>
    <p>Choose a position for each consideration.</p>
    <div className="ry-program-ordering-grid">{field.options.map((option) => {
      const ordered = Array.isArray(value) ? value as string[] : [];
      const currentPosition = ordered.indexOf(option.id);
      return <label key={option.id}><span>{option.label}</span><select
        required={field.required}
        value={currentPosition >= 0 ? String(currentPosition + 1) : ""}
        onChange={(event) => {
          const next = ordered.filter((id) => id !== option.id);
          const position = Number(event.target.value) - 1;
          if (position >= 0) next.splice(position, 0, option.id);
          onChange(next);
        }}
      ><option value="">Choose</option>{field.options.map((_, index) => <option value={index + 1} key={index + 1}>{index + 1}</option>)}</select></label>;
    })}</div>
  </fieldset>;
  return <fieldset className="ry-program-options">
    <legend>{field.label}</legend>
    <div className="ry-program-option-grid">{field.options.map((option) => <label key={option.id}>
      <input
        type="radio"
        name={field.id}
        value={option.id}
        required={field.required}
        checked={value === option.id}
        onChange={() => onChange(option.id)}
      />
      <span>{option.label}</span>
    </label>)}</div>
  </fieldset>;
}

function KnowledgeCheckForm({
  item,
  initialFeedback,
  initialResponses,
  onCompleted,
  beforeSubmit,
  continueTo
}: {
  item: LearningItem;
  initialFeedback: KnowledgeCheckFeedback | null;
  initialResponses: Record<string, unknown> | undefined;
  onCompleted: (feedback: KnowledgeCheckFeedback) => void;
  beforeSubmit?: () => Promise<void>;
  continueTo?: { label: string; to: string } | null;
}) {
  const [responses, setResponses] = useState<Record<string, unknown>>(initialResponses ?? {});
  const [feedback, setFeedback] = useState<KnowledgeCheckFeedback | null>(initialFeedback);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const questions = item.knowledgeCheck?.questions ?? [];

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await beforeSubmit?.();
      const result = await api<{ knowledgeFeedback: KnowledgeCheckFeedback }>(`/api/program/items/${item.id}/submissions`, {
        method: "POST",
        body: { steps: { "knowledge-check": responses } }
      });
      setFeedback(result.knowledgeFeedback);
      onCompleted(result.knowledgeFeedback);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your responses could not be reviewed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!questions.length) return <Alert tone="info" title="Knowledge Check in preparation">This check is not yet available.</Alert>;
  return <section className="ry-program-knowledge-check" aria-labelledby="knowledge-check-heading">
    <header>
      <p className="ry-program-overline">Knowledge Check</p>
      <h2 id="knowledge-check-heading">Pause and review</h2>
      <p>{item.knowledgeCheck?.introduction}</p>
    </header>
    <form onSubmit={(event) => { void submit(event); }}>
      {questions.map((question, index) => <KnowledgeQuestionControl
        disabled={Boolean(feedback)}
        feedback={feedback?.questions.find((entry) => entry.questionId === question.id)}
        index={index}
        key={question.id}
        question={question}
        value={responses[question.id]}
        onChange={(value) => {
          setFeedback(null);
          setResponses((current) => ({ ...current, [question.id]: value }));
        }}
      />)}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {feedback
        ? <Button type="button" onClick={() => {
          setResponses({});
          setFeedback(null);
          setError("");
        }}>Try again</Button>
        : <Button type="submit" loading={submitting}>Review responses</Button>}
    </form>
    {feedback && continueTo ? <div className="ry-program-inline-continue">
      <Link className="ry-program-primary-link" to={continueTo.to}>Continue to {continueTo.label}</Link>
    </div> : null}
  </section>;
}

const assessmentDomainLabels: Record<string, string> = {
  foundations: "Brand placement foundations",
  brands_products: "Brands, products & assortment",
  pricing_math: "Pricing & commercial math",
  buyers_accounts: "Buyers & account fit",
  placement_strategy: "Placement strategy",
  outreach: "Outreach & buyer communication",
  orders_reorders: "Orders, terms & reorders",
  account_performance: "Account performance",
  commissions: "Commissions",
  ryva_workflow: "Ryva commercial workflow"
};

function assessmentResponseComplete(question: KnowledgeCheckQuestion, value: unknown): boolean {
  if (question.type === "single_choice" || question.type === "true_false") return typeof value === "string" && value.length > 0;
  if (question.type === "numeric_calculation") return (typeof value === "string" || typeof value === "number") && String(value).trim().length > 0 && Number.isFinite(Number(value));
  if (question.type === "multiple_select") return Array.isArray(value) && value.length > 0;
  if (question.type === "ordering") return Array.isArray(value) && value.length === question.options.length && value.every((entry) => typeof entry === "string" && entry.length > 0) && new Set(value).size === value.length;
  return Array.isArray(value) && value.length === question.left.length && question.left.every((left) => value.some((entry) => typeof entry === "string" && entry.startsWith(`${left.id}:`)));
}

function FinalAssessmentForm({ item, initialResult, onPassed }: { item: LearningItem; initialResult: AssessmentResult | null; onPassed: () => void }) {
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState<AssessmentResult | null>(initialResult);
  const [questions, setQuestions] = useState<KnowledgeCheckQuestion[]>(item.knowledgeCheck?.questions ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [loadingRetake, setLoadingRetake] = useState(false);
  const [error, setError] = useState("");
  const [missingQuestionId, setMissingQuestionId] = useState<string | null>(null);

  async function beginRetake() {
    setLoadingRetake(true);
    setError("");
    try {
      const nextAttempt = await api<ItemPayload>(`/api/program/items/${item.id}`, { cache: "no-store" });
      setQuestions(nextAttempt.item.knowledgeCheck?.questions ?? []);
      setResponses({});
      setMissingQuestionId(null);
      setResult(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The next assessment attempt could not be prepared.");
    } finally {
      setLoadingRetake(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const missingIndex = questions.findIndex((question) => !assessmentResponseComplete(question, responses[question.id]));
    if (missingIndex >= 0) {
      const missingQuestion = questions[missingIndex]!;
      setMissingQuestionId(missingQuestion.id);
      setError(`Question ${missingIndex + 1} needs an answer.`);
      requestAnimationFrame(() => {
        const questionElement = document.getElementById(`assessment-question-${missingQuestion.id}`);
        questionElement?.scrollIntoView({ behavior: "smooth", block: "center" });
        questionElement?.querySelector<HTMLElement>("input, select, button")?.focus({ preventScroll: true });
      });
      return;
    }
    setMissingQuestionId(null);
    setSubmitting(true);
    try {
      const response = await api<{ assessmentResult: AssessmentResult }>(`/api/program/items/${item.id}/submissions`, {
        method: "POST",
        body: { steps: { "knowledge-check": responses } }
      });
      setResult(response.assessmentResult);
      if (response.assessmentResult.passed) onPassed();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your assessment could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }
  if (result) return <section className="ry-program-assessment-result" aria-live="polite">
    <p className="ry-program-overline">Attempt {result.attemptNumber}</p>
    <h2>{result.heading}</h2>
    <p className="ry-program-assessment-score">{result.score}% <span>{result.correctAnswers} of {result.totalQuestions} correct</span></p>
    <div className="ry-program-assessment-performance">{result.performance.map((area) => <div key={area.domain}>
      <span>{assessmentDomainLabels[area.domain] ?? area.domain}</span><strong>{area.percentage}%</strong>
      <progress value={area.percentage} max={100} aria-label={`${assessmentDomainLabels[area.domain] ?? area.domain}: ${area.percentage}%`} />
    </div>)}</div>
    {result.passed
      ? <p>You completed the required assessment threshold. Your Program completion is being recorded.</p>
      : <><p>Revisit the learning areas that need attention, then begin a reshuffled attempt. There is no permanent failure state.</p>{error ? <Alert tone="danger">{error}</Alert> : null}<Button type="button" loading={loadingRetake} onClick={() => { void beginRetake(); }}>Begin another attempt</Button></>}
  </section>;
  return <section className="ry-program-knowledge-check ry-program-final-assessment" aria-labelledby="final-assessment-heading">
    <header>
      <p className="ry-program-overline">Final Brand Placement Assessment</p>
      <h2 id="final-assessment-heading">Review, interpret, calculate</h2>
      <p>{questions.length} questions · approximately {item.assessment?.recommendedMinutes ?? 60} minutes · {item.assessment?.passingPercentage ?? 80}% required</p>
    </header>
    <form noValidate onSubmit={(event) => { void submit(event); }}>
      {questions.map((question, index) => <KnowledgeQuestionControl
        attentionNeeded={missingQuestionId === question.id}
        disabled={submitting}
        feedback={undefined}
        index={index}
        key={question.id}
        question={question}
        value={responses[question.id]}
        onChange={(value) => {
          setResponses((current) => ({ ...current, [question.id]: value }));
          setError("");
          if (missingQuestionId === question.id) setMissingQuestionId(null);
        }}
      />)}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Button type="submit" loading={submitting}>Submit assessment</Button>
    </form>
  </section>;
}

function KnowledgeQuestionControl({
  question,
  index,
  value,
  disabled,
  feedback,
  attentionNeeded = false,
  onChange
}: {
  question: KnowledgeCheckQuestion;
  index: number;
  value: unknown;
  disabled: boolean;
  feedback: KnowledgeCheckFeedback["questions"][number] | undefined;
  attentionNeeded?: boolean;
  onChange: (value: unknown) => void;
}) {
  const questionClassName = `ry-program-knowledge-question${feedback ? ` has-feedback ${feedback.outcome === "aligned" ? "is-correct" : "is-incorrect"}` : ""}${attentionNeeded ? " is-unanswered" : ""}`;
  const questionElementId = `assessment-question-${question.id}`;
  const feedbackId = `knowledge-feedback-${question.id}`;
  const legend = <legend>
    <span className="ry-program-question-number">{String(index + 1).padStart(2, "0")}</span>
    <span className="ry-program-question-title">{question.prompt}</span>
    {attentionNeeded ? <span className="ry-program-question-required">Answer required</span> : null}
  </legend>;
  if (question.type === "multiple_select") {
    const selected = Array.isArray(value) ? value as string[] : [];
    return <fieldset aria-describedby={feedback ? feedbackId : undefined} aria-invalid={attentionNeeded || undefined} className={questionClassName} id={questionElementId}>
      {legend}
      <p className="ry-program-check-instruction">Select all that apply.</p>
      <div className="ry-program-check-options">{question.options.map((option, optionIndex) => <label key={option.id}>
        <input
          checked={selected.includes(option.id)}
          disabled={disabled}
          name={question.id}
          onChange={(event) => onChange(event.target.checked
            ? [...selected, option.id]
            : selected.filter((entry) => entry !== option.id))}
          required={optionIndex === 0 && selected.length === 0}
          type="checkbox"
          value={option.id}
        />
        <span>{option.label}</span>
      </label>)}</div>
      {feedback ? <QuestionFeedback feedback={feedback} id={feedbackId} /> : null}
    </fieldset>;
  }
  if (question.type === "single_choice" || question.type === "true_false") {
    const options = question.type === "single_choice"
      ? question.options
      : [{ id: "true", label: "True" }, { id: "false", label: "False" }];
    return <fieldset aria-describedby={feedback ? feedbackId : undefined} aria-invalid={attentionNeeded || undefined} className={questionClassName} id={questionElementId}>
      {legend}
      <div className="ry-program-check-options">{options.map((option) => <label key={option.id}>
        <input
          checked={value === option.id}
          disabled={disabled}
          name={question.id}
          onChange={() => onChange(option.id)}
          required
          type="radio"
          value={option.id}
        />
        <span>{option.label}</span>
      </label>)}</div>
      {feedback ? <QuestionFeedback feedback={feedback} id={feedbackId} /> : null}
    </fieldset>;
  }
  if (question.type === "numeric_calculation") {
    return <fieldset aria-describedby={feedback ? feedbackId : undefined} aria-invalid={attentionNeeded || undefined} className={questionClassName} id={questionElementId}>
      {legend}
      <label className="ry-program-check-number">
        <span>Answer{question.unitLabel ? ` (${question.unitLabel})` : ""}</span>
        <input
          inputMode="decimal"
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          required
          step="any"
          type="number"
          value={typeof value === "number" || typeof value === "string" ? value : ""}
        />
      </label>
      {feedback ? <QuestionFeedback feedback={feedback} id={feedbackId} /> : null}
    </fieldset>;
  }
  if (question.type === "ordering") {
    const ordered = Array.isArray(value) ? value as string[] : [];
    return <fieldset aria-describedby={feedback ? feedbackId : undefined} aria-invalid={attentionNeeded || undefined} className={questionClassName} id={questionElementId}>
      {legend}
      <p>Choose the item that belongs in each position.</p>
      <div className="ry-program-check-ordering">{question.options.map((_, position) => <label key={position}>
        <span>Position {position + 1}</span>
        <select
          disabled={disabled}
          required
          value={ordered[position] ?? ""}
          onChange={(event) => {
            const next = [...ordered];
            next[position] = event.target.value;
            onChange(next);
          }}
        >
          <option value="">Choose</option>
          {question.options.map((option) => <option
            disabled={ordered.includes(option.id) && ordered[position] !== option.id}
            key={option.id}
            value={option.id}
          >{option.label}</option>)}
        </select>
      </label>)}</div>
      {feedback ? <QuestionFeedback feedback={feedback} id={feedbackId} /> : null}
    </fieldset>;
  }
  const matches = Array.isArray(value) ? value as string[] : [];
  const matchFor = (leftId: string) => matches.find((entry) => entry.startsWith(`${leftId}:`))?.split(":")[1] ?? "";
  return <fieldset aria-describedby={feedback ? feedbackId : undefined} aria-invalid={attentionNeeded || undefined} className={questionClassName} id={questionElementId}>
    {legend}
    <div className="ry-program-check-matching">{question.left.map((left) => <label key={left.id}>
      <span>{left.label}</span>
      <select
        disabled={disabled}
        required
        value={matchFor(left.id)}
        onChange={(event) => {
          const next = matches.filter((entry) => !entry.startsWith(`${left.id}:`));
          if (event.target.value) next.push(`${left.id}:${event.target.value}`);
          onChange(next);
        }}
      >
        <option value="">Choose a perspective</option>
        {question.right.map((right) => <option key={right.id} value={right.id}>{right.label}</option>)}
      </select>
    </label>)}</div>
    {feedback ? <QuestionFeedback feedback={feedback} id={feedbackId} /> : null}
  </fieldset>;
}

function QuestionFeedback({ feedback, id }: { feedback: KnowledgeCheckFeedback["questions"][number]; id: string }) {
  return <div className={`ry-program-question-feedback ${feedback.outcome === "aligned" ? "is-correct" : "is-incorrect"}`} id={id} role="status">
    <strong>{feedback.heading}</strong>
    <p>{feedback.explanation}</p>
    {feedback.referenceAnswer ? <aside><strong>Consider this</strong><p>{feedback.referenceAnswer}</p></aside> : null}
  </div>;
}

function itemPath(target: ItemPayload["navigation"]["next"]): string {
  if (target?.moduleSlug === "final-simulation") return appPath("/program/final-simulation");
  if (target?.moduleSlug === "final-assessment") return appPath("/program/final-assessment");
  return appPath(`/program/${target?.moduleSlug ?? ""}/${target?.slug ?? ""}`);
}

function continuationFor(payload: ItemPayload): { label: string; to: string } | null {
  const target = payload.navigation.next;
  if (!target) return null;
  const item = payload.module?.items.find((entry) => entry.id === target.id);
  return {
    label: item?.title ?? (target.moduleSlug === "final-simulation"
      ? "Final Simulation"
      : target.moduleSlug === "final-assessment"
        ? "Final Brand Placement Assessment"
        : "the next section"),
    to: itemPath(target)
  };
}

export function ProgramItemPage({ itemIdentifier, moduleIdentifier }: { itemIdentifier?: string; moduleIdentifier?: string } = {}) {
  const canAccess = useProgramAccess();
  const params = useParams();
  const moduleSlug = moduleIdentifier ?? params.moduleSlug ?? "";
  const itemSlug = itemIdentifier ?? params.itemSlug ?? "";
  const { refresh } = useAuth();
  const [payload, setPayload] = useState<ItemPayload | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [programCompleted, setProgramCompleted] = useState(false);
  const [considerations, setConsiderations] = useState<string[]>([]);
  const [knowledgeFeedback, setKnowledgeFeedback] = useState<KnowledgeCheckFeedback | null>(null);
  const [inlineCheckPayload, setInlineCheckPayload] = useState<ItemPayload | null>(null);
  const [inlineCheckCompleted, setInlineCheckCompleted] = useState(false);
  useEffect(() => {
    if (!canAccess) return;
    let active = true;
    setPayload(null);
    setError("");
    setInlineCheckPayload(null);
    setInlineCheckCompleted(false);
    void api<ItemPayload>(`/api/program/items/${encodeURIComponent(itemSlug)}`)
      .then(async (result) => {
        if (!active) return;
        setPayload(result);
        setCompleted(Boolean(result.progress?.completedAt));
        setConsiderations(result.submission?.considerations ?? []);
        setKnowledgeFeedback(result.submission?.knowledgeFeedback ?? null);
        const checkSummary = result.item.type === "knowledge_check"
          ? null
          : associatedCheck(result.module?.items ?? [], result.item.id);
        const [checkResult] = await Promise.all([
          checkSummary ? api<ItemPayload>(`/api/program/items/${encodeURIComponent(checkSummary.slug)}`) : Promise.resolve(null),
          api(`/api/program/items/${encodeURIComponent(result.item.id)}/start`, { method: "POST" })
        ]);
        if (!active || !checkResult) return;
        setInlineCheckPayload(checkResult);
        setInlineCheckCompleted(Boolean(checkResult.progress?.completedAt));
        await api(`/api/program/items/${encodeURIComponent(checkResult.item.id)}/start`, { method: "POST" });
      })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "This lesson could not be loaded."); });
    return () => { active = false; };
  }, [canAccess, itemSlug]);
  const moduleItems = payload?.module?.items ?? [];
  if (!canAccess) return <Navigate to={appPath("/access")} replace />;
  if (error) return <ProgramFrame><ProgramMasthead compact /><ErrorState message={error} /></ProgramFrame>;
  if (!payload) return <LoadingState label="Opening lesson" />;
  const activeItem = payload.item;
  const activity = ["guided_exercise", "guided_practice", "reflection", "final_simulation"].includes(payload.item.type);
  const knowledgeCheck = payload.item.type === "knowledge_check";
  const finalAssessment = payload.item.type === "final_assessment";
  const inlineCheckSummary = associatedCheck(moduleItems, activeItem.id);
  const railItems = groupedModuleItems(moduleItems);
  const continuation = continuationFor(payload);
  const inlineContinuation = inlineCheckPayload ? continuationFor(inlineCheckPayload) : null;

  async function completeActiveItem() {
    if (completed) return;
    const result = await api<{ programCompletion: unknown; access: AccessDecision }>(`/api/program/items/${activeItem.id}/complete`, { method: "POST" });
    setCompleted(true);
    if (result.programCompletion) {
      setProgramCompleted(true);
      await refresh();
    }
  }

  async function markComplete() {
    setSaving(true);
    setError("");
    try {
      await completeActiveItem();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This item could not be completed.");
    } finally {
      setSaving(false);
    }
  }

  async function activityCompleted(completedProgram: boolean, nextConsiderations: string[]) {
    setCompleted(true);
    setConsiderations(nextConsiderations);
    if (completedProgram) {
      setProgramCompleted(true);
      await refresh();
    }
  }

  function knowledgeCheckCompleted(feedback: KnowledgeCheckFeedback) {
    setCompleted(true);
    setKnowledgeFeedback(feedback);
  }

  if (programCompleted) return <ProgramFrame><ProgramMasthead compact /><ProgramCompletionPanel newlyCompleted /></ProgramFrame>;
  return <ProgramFrame>
    <ProgramMasthead compact />
    <div className="ry-program-lesson-layout">
      <main className="ry-program-lesson">
        <Link to={moduleSlug === "final-simulation" ? appPath("/program") : appPath(`/program/${moduleSlug}`)} className="ry-program-back">← {payload.module?.title ?? "Program journey"}</Link>
        <header>
          <p className="ry-program-overline">{itemTypeLabel(payload.item.type)}{payload.item.estimatedMinutes ? ` · ${payload.item.estimatedMinutes} minutes` : ""}</p>
          <h1>{payload.item.title}</h1>
          <p>{payload.item.description}</p>
        </header>
        <ContentBlocks blocks={payload.item.blocks} />
        {activity ? <ActivityForm item={payload.item} initialResponses={payload.submission?.response?.steps ?? {}} key={payload.item.id} onCompleted={(didComplete, next) => { void activityCompleted(didComplete, next); }} /> : null}
        {knowledgeCheck ? <KnowledgeCheckForm
          continueTo={continuation}
          initialFeedback={knowledgeFeedback}
          initialResponses={payload.submission?.response?.steps["knowledge-check"]}
          item={payload.item}
          key={payload.item.id}
          onCompleted={knowledgeCheckCompleted}
        /> : null}
        {finalAssessment ? <FinalAssessmentForm
          initialResult={payload.submission?.assessmentResult ?? null}
          item={payload.item}
          onPassed={() => { setCompleted(true); setProgramCompleted(true); void refresh(); }}
        /> : null}
        {inlineCheckSummary && !inlineCheckPayload ? <LoadingState label="Preparing the knowledge check" /> : null}
        {inlineCheckPayload ? <KnowledgeCheckForm
          beforeSubmit={completeActiveItem}
          continueTo={completed ? inlineContinuation : null}
          initialFeedback={inlineCheckPayload.submission?.knowledgeFeedback ?? null}
          initialResponses={inlineCheckPayload.submission?.response?.steps["knowledge-check"]}
          item={inlineCheckPayload.item}
          key={inlineCheckPayload.item.id}
          onCompleted={() => { setInlineCheckCompleted(true); }}
        /> : null}
        {considerations.length ? <section className="ry-program-considerations" aria-live="polite">
          <h2>Things to notice</h2>
          <ul>{considerations.map((item) => <li key={item}>{item}</li>)}</ul>
        </section> : null}
        {!inlineCheckSummary && !knowledgeCheck && !finalAssessment ? <footer className="ry-program-lesson-actions">
          {completed ? <strong className="ry-program-complete-mark">Completed</strong> : !activity ? <Button loading={saving} onClick={() => { void markComplete(); }}>Complete Section</Button> : null}
          {continuation && completed ? <Link className="ry-program-primary-link" to={continuation.to}>Continue to {continuation.label}</Link> : null}
        </footer> : null}
      </main>
      {payload.module ? <aside className="ry-program-contents" aria-label="Module contents">
        <span>Module {payload.module.position}</span>
        <h2>{payload.module.title}</h2>
        <ol>{railItems.map(({ item, check }, index) => {
          const current = item.id === activeItem.id || check?.id === activeItem.id;
          const checkIsComplete = check?.id === inlineCheckPayload?.item.id ? inlineCheckCompleted : check?.completed;
          return <li className={current ? "current" : ""} key={item.id}>
          <Link aria-current={current ? "page" : undefined} to={appPath(`/program/${payload.module!.slug}/${item.slug}`)}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <span>{item.title}{checkIsComplete ? <small>Completed</small> : null}</span>
            {item.completed && (!check || checkIsComplete) ? <strong>✓</strong> : null}
          </Link>
        </li>})}</ol>
      </aside> : null}
    </div>
  </ProgramFrame>;
}

export function FinalSimulationPage() {
  const canAccess = useProgramAccess();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!canAccess) return;
    void api<Dashboard>("/api/program").then(setDashboard).catch((caught) => setError(caught instanceof Error ? caught.message : "The simulation could not be loaded."));
  }, [canAccess]);
  if (!canAccess) return <Navigate to={appPath("/access")} replace />;
  if (error) return <ProgramFrame><ProgramMasthead compact /><ErrorState message={error} /></ProgramFrame>;
  if (!dashboard) return <LoadingState label="Opening Final Simulation" />;
  if (dashboard.finalSimulation.state === "draft") return <ProgramFrame>
    <ProgramMasthead compact />
    <section className="ry-program-final-preparing">
      <Link to={appPath("/program")} className="ry-program-back">← Program journey</Link>
      <p className="ry-program-overline">Final Simulation</p>
      <h1>One connected commercial scenario.</h1>
      <p>The final simulation structure is in place, but its educational scenario remains in editorial review and has not been published.</p>
    </section>
  </ProgramFrame>;
  if (dashboard.finalSimulation.state === "locked") return <ProgramFrame><ProgramMasthead compact /><Alert title="Final Simulation locked">Complete every required module item before beginning the connected scenario.</Alert></ProgramFrame>;
  return <ProgramItemPage itemIdentifier="final-simulation" moduleIdentifier="final-simulation" />;
}

export function FinalAssessmentPage() {
  const canAccess = useProgramAccess();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!canAccess) return;
    void api<Dashboard>("/api/program").then(setDashboard).catch((caught) => setError(caught instanceof Error ? caught.message : "The assessment could not be loaded."));
  }, [canAccess]);
  if (!canAccess) return <Navigate to={appPath("/access")} replace />;
  if (error) return <ProgramFrame><ProgramMasthead compact /><ErrorState message={error} /></ProgramFrame>;
  if (!dashboard) return <LoadingState label="Opening Final Brand Placement Assessment" />;
  if (!dashboard.finalAssessment || dashboard.finalAssessment.state === "draft") return <ProgramFrame><ProgramMasthead compact /><Alert title="Assessment unavailable">The Final Brand Placement Assessment is not published.</Alert></ProgramFrame>;
  if (dashboard.finalAssessment.state === "locked") return <ProgramFrame><ProgramMasthead compact /><Alert title="Final Assessment locked">Complete the Final Brand Placement Simulation before beginning the assessment.</Alert></ProgramFrame>;
  return <ProgramItemPage itemIdentifier="final-assessment" moduleIdentifier="final-assessment" />;
}

function ProgramCompletionPanel({ newlyCompleted = false, canEnterOperating = true }: { newlyCompleted?: boolean; canEnterOperating?: boolean }) {
  return <section className="ry-program-completion" aria-labelledby="program-completion-heading">
    <p className="ry-program-overline">Program complete</p>
    <h2 id="program-completion-heading">The Ryva Program: Completed</h2>
    <p>{newlyCompleted
      ? "You completed the required learning, guided activities, Final Brand Placement Simulation, and Final Brand Placement Assessment. Your Ryva operating platform is now available. Your 30-day Ryva Pro access period has begun."
      : "You completed the required Program experience. Your Program remains available to revisit whenever you choose."}</p>
    <div>
      {canEnterOperating ? <Link className="ry-program-primary-link" to={appPath("/")}>Enter Ryva</Link> : null}
      <Link className="ry-program-secondary-link" to={appPath("/program")}>Return to Program</Link>
    </div>
  </section>;
}
