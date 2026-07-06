import { useEffect, useMemo, useState, type FormEvent } from "react";

import { getInterviewGuide, type InterviewMessage } from "../interviewPrompts";
import type { Worker } from "../types";

type InterviewPageProps = {
  onBack: () => void;
  onHire: (workerSlug: string) => void;
  worker: Worker;
};

function buildIntro(worker: Worker): InterviewMessage[] {
  return [
    {
      id: `${worker.slug}-intro-1`,
      speaker: "worker",
      text: `I’m ${worker.name}, Ryva’s ${worker.title}. Ask me anything you’d want to know before making a hiring decision. I’ll answer the way I would in a real interview.`,
    }
  ];
}

export function InterviewPage({ onBack, onHire, worker }: InterviewPageProps) {
  const guide = useMemo(() => getInterviewGuide(worker), [worker]);
  const storageKey = `ryva-interview-${worker.slug}`;
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<InterviewMessage[]>(() => buildIntro(worker));
  const [fitNotes, setFitNotes] = useState("");
  const [threadError, setThreadError] = useState("");

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(storageKey);
      if (!saved) return;
      const parsed = JSON.parse(saved) as { fitNotes: string; messages: InterviewMessage[] };
      if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
        setMessages(parsed.messages);
      }
      if (typeof parsed.fitNotes === "string") {
        setFitNotes(parsed.fitNotes);
      }
    } catch {
      setMessages(buildIntro(worker));
    }
  }, [storageKey, worker]);

  useEffect(() => {
    window.sessionStorage.setItem(storageKey, JSON.stringify({ fitNotes, messages }));
  }, [fitNotes, messages, storageKey]);

  async function askQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed || isSending) return;

    const managerMessage: InterviewMessage = {
      id: `${Date.now()}-manager`,
      speaker: "manager",
      text: trimmed
    };

    const nextMessages = [...messages, managerMessage];
    setMessages(nextMessages);
    setInput("");
    setThreadError("");
    setIsSending(true);

    try {
      const response = await fetch(`/api/workers/${worker.slug}/interview`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: nextMessages
        })
      });

      const payload = (await response.json().catch(() => null)) as { error?: string; reply?: string } | null;
      if (!response.ok || !payload?.reply) {
        throw new Error(payload?.error ?? "Interview reply failed.");
      }

      setMessages((current) => [
        ...current,
        { id: `${Date.now()}-worker`, speaker: "worker", text: payload.reply! }
      ]);
    } catch (error) {
      setThreadError(error instanceof Error ? error.message : "Unable to continue the interview right now.");
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void askQuestion(input);
  }

  return (
    <main className="interview-page">
      <div className="interview-shell">
        <aside className="interview-sidebar">
          <a className="back-link" href="#workers" onClick={(event) => { event.preventDefault(); onBack(); }}>
            ← Back to profile
          </a>
          <div className="interview-worker-card">
            <img alt={worker.name} className="worker-profile-avatar" src={worker.imageUrl} />
            <h1>{worker.name}</h1>
            <p className="worker-hero-title">{worker.title}</p>
            <p className="worker-hero-meta">
              {worker.department} · {worker.salary}
            </p>
            <p className="interview-summary">{guide.summary}</p>
          </div>
          <section className="interview-panel">
            <h2>Responsibilities</h2>
            <ul className="profile-bullets">
              {worker.profile.responsibilities.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </aside>

        <section className="interview-main">
          <header className="interview-header">
            <div>
              <p className="auth-section-label">Interview</p>
              <h2>Interview {worker.name}</h2>
            </div>
            <button className="button button-primary" onClick={() => onHire(worker.slug)} type="button">
              Hire {worker.name.split(" ")[0]}
            </button>
          </header>

          <div className="interview-thread">
            {messages.map((message) => (
              <article className={message.speaker === "worker" ? "interview-message" : "interview-message interview-message-manager"} key={message.id}>
                <strong>{message.speaker === "worker" ? worker.name : "You"}</strong>
                <p>{message.text}</p>
              </article>
            ))}
            {isSending ? (
              <article className="interview-message interview-message-pending">
                <strong>{worker.name}</strong>
                <p>Responding...</p>
              </article>
            ) : null}
          </div>

          <div className="interview-suggestions">
            {guide.suggestedQuestions.map((question) => (
              <button className="interview-question-link" disabled={isSending} key={question} onClick={() => void askQuestion(question)} type="button">
                {question}
              </button>
            ))}
          </div>

          <form className="interview-composer" onSubmit={handleSubmit}>
            <textarea
              onChange={(event) => setInput(event.target.value)}
              placeholder={`Ask ${worker.name.split(" ")[0]} about fit, working style, first week plans, or what they need from you.`}
              rows={4}
              value={input}
            />
            {threadError ? <p className="interview-thread-error">{threadError}</p> : null}
            <div className="chat-composer-actions">
              <button className="button button-primary" disabled={!input.trim() || isSending} type="submit">
                {isSending ? "Working..." : "Ask question"}
              </button>
            </div>
          </form>
        </section>

        <aside className="interview-sidebar-right">
          <section className="interview-panel">
            <h2>Fit notes</h2>
            <textarea onChange={(event) => setFitNotes(event.target.value)} placeholder="Keep private notes as you evaluate this worker." rows={6} value={fitNotes} />
          </section>
          <section className="interview-panel">
            <h2>What this worker can help with</h2>
            <ul className="profile-bullets">
              {guide.canHelpWith.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <section className="interview-panel">
            <h2>What this worker needs from you</h2>
            <ul className="profile-bullets">
              {guide.needsFromYou.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <section className="interview-panel">
            <h2>Fit signals</h2>
            <ul className="profile-bullets">
              {guide.fitNotes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}
