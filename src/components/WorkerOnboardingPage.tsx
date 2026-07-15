import { useEffect, useMemo, useRef, useState } from "react";

import { buildOnboardingCompletionPayload, getOnboardingSchema, type OnboardingQuestion, type OnboardingSessionState } from "../onboardingSchemas";
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

type ThreadMessage = {
  id: string;
  role: "system" | "user" | "worker";
  text: string;
};

type FlatQuestion = OnboardingQuestion & {
  sectionTitle: string;
};

function flattenQuestions(worker: Worker): FlatQuestion[] {
  const schema = getOnboardingSchema(worker);
  return schema.sections.flatMap((section) =>
    section.questions.map((question) => ({
      ...question,
      sectionTitle: section.title
    }))
  );
}

function workerQuestionPrompt(worker: Worker, question: FlatQuestion) {
  const options = question.options?.length ? ` Options: ${question.options.join(" · ")}.` : "";
  const helper = question.helperText ? ` ${question.helperText}` : "";
  return `${question.label}${helper}${options}`;
}

function buildThread(worker: Worker, questions: FlatQuestion[], answers: Record<string, string>, activeIndex: number, isSummary: boolean) {
  const thread: ThreadMessage[] = [];

  questions.forEach((question) => {
    const answer = answers[question.id]?.trim();
    if (!answer) return;

    thread.push({
      id: `${question.id}-prompt`,
      role: "worker",
      text: workerQuestionPrompt(worker, question)
    });
    thread.push({
      id: `${question.id}-answer`,
      role: "user",
      text: answer
    });

  });

  if (!isSummary && questions[activeIndex]) {
    thread.push({
      id: `${questions[activeIndex].id}-current`,
      role: "worker",
      text: workerQuestionPrompt(worker, questions[activeIndex])
    });
  }

  return thread;
}

export function WorkerOnboardingPage({
  onComplete,
  onSaveProgress,
  onStartFirstDay,
  session,
  worker
}: WorkerOnboardingPageProps) {
  const schema = useMemo(() => getOnboardingSchema(worker), [worker]);
  const questions = useMemo(() => flattenQuestions(worker), [worker]);
  const [answers, setAnswers] = useState<Record<string, string>>(session?.answers ?? {});
  const [composerValue, setComposerValue] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [isSummary, setIsSummary] = useState(session?.status === "completed");
  const [threadError, setThreadError] = useState("");
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>(() =>
    buildThread(worker, questions, session?.answers ?? {}, 0, session?.status === "completed")
  );
  const threadRef = useRef<HTMLDivElement | null>(null);
  const localAnswersRef = useRef<Record<string, string>>(session?.answers ?? {});
  const hydratedWorkerRef = useRef(worker.slug);

  useEffect(() => {
    const nextAnswers = session?.answers ?? {};
    const nextSummary = session?.status === "completed";
    const workerChanged = hydratedWorkerRef.current !== worker.slug;
    const answersMatchLocal = JSON.stringify(nextAnswers) === JSON.stringify(localAnswersRef.current);

    // Saving one answer refreshes the parent session. Do not treat that echo
    // as a new onboarding session: rebuilding here used to erase anything the
    // creator had already started typing and replace Mara's real reply with a
    // hard-coded acknowledgement.
    if (!workerChanged && answersMatchLocal) return;

    const nextIndex = questions.findIndex((question) => !nextAnswers[question.id]?.trim());
    const normalizedIndex = nextIndex === -1 ? Math.max(questions.length - 1, 0) : nextIndex;

    hydratedWorkerRef.current = worker.slug;
    localAnswersRef.current = nextAnswers;
    setAnswers(nextAnswers);
    setCurrentIndex(nextIndex === -1 ? questions.length : normalizedIndex);
    setComposerValue("");
    setIsSummary(nextSummary || nextIndex === -1);
    setThreadMessages(buildThread(worker, questions, nextAnswers, normalizedIndex, nextSummary || nextIndex === -1));
  }, [questions, session, worker]);

  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) {
      return;
    }

    thread.scrollTop = thread.scrollHeight;
  }, [isReplying, threadMessages]);

  const currentQuestion = currentIndex < questions.length ? questions[currentIndex] : null;
  const generated = buildOnboardingCompletionPayload(worker, answers);
  const allAnswered = currentIndex >= questions.length;

  async function persistProgress(nextAnswers: Record<string, string>) {
    await onSaveProgress({ answers: nextAnswers, generatedSummary: buildOnboardingCompletionPayload(worker, nextAnswers).summary });
  }

  async function handleSend() {
    const current = currentQuestion;
    const answer = composerValue.trim();
    if (!current || !answer || isReplying || isCompleting) return;

    const nextAnswers = { ...answers, [current.id]: answer };
    const nextIndex = currentIndex + 1;
    const nextQuestion = questions[nextIndex] ?? null;

    setThreadError("");
    setComposerValue("");
    setIsReplying(true);
    localAnswersRef.current = nextAnswers;
    setAnswers(nextAnswers);
    setThreadMessages((messages) => [
      ...messages,
      { id: `${current.id}-reply-${Date.now()}`, role: "user", text: answer }
    ]);

    try {
      await persistProgress(nextAnswers);

      const response = await fetch(`/api/workers/${worker.slug}/onboarding/reply`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          answerText: answer,
          knownAnswers: nextAnswers,
          summarySoFar: buildOnboardingCompletionPayload(worker, nextAnswers).summary,
          nextQuestionLabel: nextQuestion?.label ?? "",
          questionHelperText: current.helperText ?? "",
          questionLabel: current.label,
          role: schema.role,
          sectionTitle: current.sectionTitle
        })
      });

      const payload = (await response.json().catch(() => null)) as { error?: string; reply?: string } | null;
      if (!response.ok || !payload?.reply) {
        throw new Error(payload?.error ?? "Onboarding reply failed.");
      }

      setThreadMessages((messages) => {
        const nextMessages: ThreadMessage[] = [
          ...messages,
          { id: `${current.id}-ack-${Date.now()}`, role: "worker", text: payload.reply! }
        ];

        if (nextQuestion) {
          nextMessages.push({
            id: `${nextQuestion.id}-prompt-${Date.now()}`,
            role: "worker",
            text: workerQuestionPrompt(worker, nextQuestion)
          });
        }

        return nextMessages;
      });

      if (!nextQuestion) {
        setIsSummary(true);
        setCurrentIndex(questions.length);
      } else {
        setCurrentIndex(nextIndex);
      }
    } catch (error) {
      setThreadError(error instanceof Error ? error.message : "Unable to continue onboarding right now.");
      localAnswersRef.current = answers;
      setAnswers(answers);
      setComposerValue(answer);
      setThreadMessages(buildThread(worker, questions, answers, currentIndex, false));
    } finally {
      setIsReplying(false);
    }
  }

  async function handleSkip() {
    if (!currentQuestion || currentQuestion.required || isReplying || isCompleting) return;

    const nextIndex = currentIndex + 1;
    const nextQuestion = questions[nextIndex] ?? null;
    setThreadMessages((messages) => [
      ...messages,
      { id: `${currentQuestion.id}-skip-${Date.now()}`, role: "user", text: "Skip for now." },
      {
        id: `${currentQuestion.id}-skip-ack-${Date.now()}`,
        role: "worker",
        text: nextQuestion
          ? `No problem. We can leave that open for now. Next, ${nextQuestion.label.charAt(0).toLowerCase()}${nextQuestion.label.slice(1)}`
          : "No problem. I have enough to put together the first working setup."
      },
      ...(nextQuestion
        ? [
            {
              id: `${nextQuestion.id}-prompt-${Date.now()}`,
              role: "worker" as const,
              text: workerQuestionPrompt(worker, nextQuestion)
            }
          ]
        : [])
    ]);

    if (!nextQuestion) {
      setIsSummary(true);
      setCurrentIndex(questions.length);
    } else {
      setCurrentIndex(nextIndex);
      await persistProgress(answers);
    }
  }

  async function handleConfirmSummary() {
    setIsCompleting(true);
    try {
      await onComplete({
        answers,
        briefing: generated.briefing,
        generatedSummary: generated.summary,
        knowledge: generated.knowledge,
        tasks: generated.tasks,
        worklogEntry: generated.worklogEntry
      });
    } finally {
      setIsCompleting(false);
    }
  }

  return (
    <div className="office-page">
      <header className="office-topbar">
        <div>
          <h1>Onboarding</h1>
          <p>{worker.name} is getting aligned on how to work with you.</p>
        </div>
        <div className="office-topbar-meta">
          {isSummary ? "Ready to launch" : currentQuestion ? `${currentQuestion.sectionTitle} · ${currentIndex + 1} of ${questions.length}` : "Ready to launch"}
        </div>
      </header>

      <div className="onboarding-conversation-layout">
        <section className="onboarding-thread-shell">
          <div className={`onboarding-chat-shell${isSummary ? " is-summary" : ""}`}>
            <div className="onboarding-thread-head">
              <div>
                <strong>{worker.name}</strong>
                <span>{worker.title}</span>
              </div>
            </div>

            <div className="onboarding-thread" ref={threadRef}>
              {threadMessages.map((message) => (
                <article
                  className={
                    message.role === "user"
                      ? "onboarding-thread-message onboarding-thread-message-user"
                      : message.role === "system"
                        ? "onboarding-thread-message onboarding-thread-message-system"
                        : "onboarding-thread-message"
                  }
                  key={message.id}
                >
                  <strong>{message.role === "user" ? "You" : message.role === "system" ? "Ryva Office" : worker.name}</strong>
                  <p>{message.text}</p>
                </article>
              ))}
              {isReplying ? (
                <article className="onboarding-thread-message onboarding-thread-message-pending">
                  <strong>{worker.name}</strong>
                  <p>Thinking through that...</p>
                </article>
              ) : null}
            </div>

            {!isSummary ? (
              <div className="onboarding-composer-shell">
                {currentQuestion?.options?.length ? (
                  <div className="onboarding-quick-replies">
                    {currentQuestion.options.map((option) => (
                      <button
                        className="interview-question-link"
                        disabled={isReplying || isCompleting}
                        key={option}
                        onClick={() => setComposerValue(option)}
                        type="button"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="interview-composer onboarding-composer">
                  <textarea
                    onChange={(event) => setComposerValue(event.target.value)}
                    placeholder={currentQuestion ? `Reply to ${worker.name.split(" ")[0]} here...` : "Reply here..."}
                    rows={4}
                    value={composerValue}
                  />
                  {threadError ? <p className="interview-thread-error">{threadError}</p> : null}
                  <div className="onboarding-composer-actions">
                    {!currentQuestion?.required ? (
                      <button className="button button-secondary" disabled={isReplying || isCompleting} onClick={() => void handleSkip()} type="button">
                        Skip
                      </button>
                    ) : null}
                    <button className="button button-primary" disabled={!composerValue.trim() || isReplying || isCompleting} onClick={() => void handleSend()} type="button">
                      {isReplying ? "Working..." : "Send"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <section className="onboarding-summary-shell">
                <div className="office-panel-head">
                  <h3>What was captured</h3>
                  <span>{allAnswered ? "Complete" : "Draft"}</span>
                </div>
                <div className="onboarding-summary-lines">
                  {generated.summary.map((item) => (
                    <div className="onboarding-summary-line" key={item}>
                      {item}
                    </div>
                  ))}
                </div>
                {session?.status === "completed" ? (
                  <div className="onboarding-actions">
                    <button className="button button-primary" onClick={() => onStartFirstDay(generated.firstDayNotice)} type="button">
                      Start first day
                    </button>
                  </div>
                ) : (
                  <div className="onboarding-actions">
                    <button
                      className="button button-secondary"
                      onClick={() => {
                        setCurrentIndex(Math.max(questions.length - 1, 0));
                        setThreadMessages(buildThread(worker, questions, answers, Math.max(questions.length - 1, 0), false));
                        setIsSummary(false);
                      }}
                      type="button"
                    >
                      Keep editing
                    </button>
                    <button className="button button-primary" disabled={isCompleting} onClick={() => void handleConfirmSummary()} type="button">
                      {isCompleting ? "Finalizing..." : "Launch onboarding"}
                    </button>
                  </div>
                )}
              </section>
            )}
          </div>
        </section>

        <aside className="onboarding-rail">
          <section className="office-panel onboarding-rail-section">
            <div className="office-panel-head">
              <h3>Progress</h3>
              <span>{Math.min(Object.keys(answers).length, questions.length)} / {questions.length}</span>
            </div>
            <div className="onboarding-progress-list">
              {schema.sections.map((section) => {
                const sectionQuestions = questions.filter((question) => question.sectionTitle === section.title);
                const completed = sectionQuestions.filter((question) => answers[question.id]?.trim()).length;
                return (
                  <div className="onboarding-progress-row" key={section.id}>
                    <strong>{section.title}</strong>
                    <span>{completed}/{sectionQuestions.length}</span>
                  </div>
                );
              })}
            </div>
          </section>

        </aside>
      </div>
    </div>
  );
}
