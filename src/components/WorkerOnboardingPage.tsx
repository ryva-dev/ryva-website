import { useEffect, useMemo, useState } from "react";

import { buildOnboardingCompletionPayload, getOnboardingSchema, type OnboardingSessionState } from "../onboardingSchemas";
import type { Worker } from "../types";

type WorkerOnboardingPageProps = {
  onComplete: (payload: {
    answers: Record<string, string>;
    briefing: {
      agenda: string[];
      dateLabel: string;
      decisionsNeeded: string[];
      recommendedActions: string[];
      summary: string;
      title: string;
    };
    generatedSummary: string[];
    knowledge: Array<{ items: string[]; title: string }>;
    tasks: Array<{
      dueDate: string;
      module: string;
      owner: "Worker" | "You";
      priority: "High" | "Low" | "Medium";
      status: "Completed" | "In Progress" | "Needs Review" | "To Do";
      title: string;
    }>;
    worklogEntry: {
      module: string;
      result: string;
    };
  }) => Promise<void>;
  onSaveProgress: (payload: { answers: Record<string, string>; generatedSummary: string[] }) => Promise<void>;
  onStartFirstDay: (notice: string) => void;
  session: OnboardingSessionState | null;
  worker: Worker;
};

export function WorkerOnboardingPage({
  onComplete,
  onSaveProgress,
  onStartFirstDay,
  session,
  worker
}: WorkerOnboardingPageProps) {
  const schema = useMemo(() => getOnboardingSchema(worker), [worker]);
  const [answers, setAnswers] = useState<Record<string, string>>(session?.answers ?? {});
  const [sectionIndex, setSectionIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(session?.status === "completed");
  const [isSaving, setIsSaving] = useState(false);
  const [showSummary, setShowSummary] = useState(session?.status === "completed");

  useEffect(() => {
    setAnswers(session?.answers ?? {});
    setIsComplete(session?.status === "completed");
    setShowSummary(session?.status === "completed");
  }, [session]);

  const currentSection = schema.sections[sectionIndex];
  const generated = buildOnboardingCompletionPayload(worker, answers);

  function updateAnswer(questionId: string, value: string) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  }

  function sectionIsComplete(index: number) {
    const section = schema.sections[index];
    return section.questions.every((question) => !question.required || Boolean(answers[question.id]?.trim()));
  }

  async function handleSaveAndContinue() {
    setIsSaving(true);
    try {
      await onSaveProgress({ answers, generatedSummary: generated.summary });
      if (sectionIndex === schema.sections.length - 1) {
        setShowSummary(true);
      } else {
        setSectionIndex((current) => current + 1);
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmSummary() {
    setIsSaving(true);
    try {
      await onComplete({
        answers,
        briefing: generated.briefing,
        generatedSummary: generated.summary,
        knowledge: generated.knowledge,
        tasks: generated.tasks,
        worklogEntry: generated.worklogEntry
      });
      setIsComplete(true);
      setShowSummary(true);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="office-page">
      <header className="office-topbar">
        <div>
          <h1>New Hire Onboarding</h1>
          <p>{worker.name} is learning how to work with you.</p>
        </div>
        <div className="office-topbar-meta">
          {showSummary ? "Summary" : `Section ${sectionIndex + 1} of ${schema.sections.length} · ${currentSection.title}`}
        </div>
      </header>

      <div className="onboarding-layout">
        <section className="onboarding-main">
          {!showSummary ? (
            <div className="onboarding-section">
              <div className="settings-section-head">
                <div>
                  <h3>{currentSection.title}</h3>
                  <p>{worker.name.split(" ")[0]} is collecting working context for this part of the role.</p>
                </div>
              </div>

              <div className="onboarding-question-list">
                {currentSection.questions.map((question) => (
                  <article className="onboarding-question-card" key={question.id}>
                    <label>
                      <span>{question.label}</span>
                      {question.helperText ? <small>{question.helperText}</small> : null}
                      {question.type === "select" ? (
                        <select onChange={(event) => updateAnswer(question.id, event.target.value)} value={answers[question.id] ?? ""}>
                          <option value="">Select</option>
                          {question.options?.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : question.type === "long-text" ? (
                        <textarea onChange={(event) => updateAnswer(question.id, event.target.value)} rows={4} value={answers[question.id] ?? ""} />
                      ) : (
                        <input
                          onChange={(event) => updateAnswer(question.id, event.target.value)}
                          type={question.type === "url" ? "url" : "text"}
                          value={answers[question.id] ?? ""}
                        />
                      )}
                    </label>
                  </article>
                ))}
              </div>

              <div className="onboarding-actions">
                <button className="button button-secondary" disabled={sectionIndex === 0} onClick={() => setSectionIndex((current) => Math.max(current - 1, 0))} type="button">
                  Back
                </button>
                <button
                  className="button button-primary"
                  disabled={!sectionIsComplete(sectionIndex) || isSaving}
                  onClick={() => void handleSaveAndContinue()}
                  type="button"
                >
                  {isSaving ? "Saving..." : sectionIndex === schema.sections.length - 1 ? "Save and continue" : "Continue"}
                </button>
              </div>
            </div>
          ) : (
            <div className="onboarding-section">
              <div className="settings-section-head">
                <div>
                  <h3>Summary</h3>
                  <p>{worker.name.split(" ")[0]} summarized what was learned from onboarding.</p>
                </div>
              </div>

              <div className="onboarding-summary-list">
                {generated.summary.map((item) => (
                  <div className="sample-work-item" key={item}>
                    {item}
                  </div>
                ))}
              </div>

              {!isComplete ? (
                <div className="onboarding-actions">
                  <button className="button button-secondary" onClick={() => setShowSummary(false)} type="button">
                    Edit answers
                  </button>
                  <button className="button button-primary" disabled={isSaving} onClick={() => void handleConfirmSummary()} type="button">
                    {isSaving ? "Confirming..." : "Confirm summary"}
                  </button>
                </div>
              ) : (
                <div className="onboarding-actions">
                  <button className="button button-primary" onClick={() => onStartFirstDay(generated.firstDayNotice)} type="button">
                    Start first day
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="onboarding-sidebar">
          <section className="interview-panel">
            <h2>What {worker.name.split(" ")[0]} is learning</h2>
            <ul className="profile-bullets">
              {showSummary ? schema.sections.flatMap((section) => section.learningFocus).slice(0, 6).map((item) => <li key={item}>{item}</li>) : currentSection.learningFocus.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>

          <section className="interview-panel">
            <h2>This will populate</h2>
            <ul className="profile-bullets">
              <li>Goals</li>
              <li>Preferences</li>
              <li>Rules</li>
              <li>Knowledge</li>
              <li>Work style</li>
              <li>Role-specific context</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
