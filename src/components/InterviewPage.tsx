import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { getInterviewGuide, type InterviewMessage } from "../interviewPrompts";
import type { Worker } from "../types";
import { WorkerMark } from "./WorkerMark";

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
      text: `I'm ${worker.name}, Ryva's ${worker.title}. Ask me anything you'd want to know before making a hiring decision. I'll answer the way I would in a real interview.`,
    },
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
  const first = worker.name.split(" ")[0];
  const threadRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(storageKey);
      if (!saved) return;
      const parsed = JSON.parse(saved) as { fitNotes: string; messages: InterviewMessage[] };
      if (Array.isArray(parsed.messages) && parsed.messages.length > 0) setMessages(parsed.messages);
      if (typeof parsed.fitNotes === "string") setFitNotes(parsed.fitNotes);
    } catch {
      setMessages(buildIntro(worker));
    }
  }, [storageKey, worker]);

  useEffect(() => {
    window.sessionStorage.setItem(storageKey, JSON.stringify({ fitNotes, messages }));
  }, [fitNotes, messages, storageKey]);

  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) {
      return;
    }

    thread.scrollTop = thread.scrollHeight;
  }, [isSending, messages]);

  async function askQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed || isSending) return;

    const managerMessage: InterviewMessage = { id: `${Date.now()}-manager`, speaker: "manager", text: trimmed };
    const nextMessages = [...messages, managerMessage];
    setMessages(nextMessages);
    setInput("");
    setThreadError("");
    setIsSending(true);

    try {
      const response = await fetch(`/api/workers/${worker.slug}/interview`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; reply?: string } | null;
      if (!response.ok || !payload?.reply) throw new Error(payload?.error ?? "Interview reply failed.");
      setMessages((current) => [...current, { id: `${Date.now()}-worker`, speaker: "worker", text: payload.reply! }]);
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
    <main className="iv">
      <aside className="iv-left">
        <a className="rp-back" href="#workers" onClick={(e) => { e.preventDefault(); onBack(); }}>← Back to profile</a>
        <div className="iv-card">
          <WorkerMark seed={worker.slug} size={64} active />
          <h1>{worker.name}</h1>
          <p className="rp-role">{worker.title}</p>
          <p className="rp-meta">{worker.department} · {worker.salary}</p>
          <p className="iv-summary">{guide.summary}</p>
        </div>
        <section className="iv-panel">
          <h2>Responsibilities</h2>
          <ul className="rp-checks">
            {worker.profile.responsibilities.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
      </aside>

      <section className="iv-main">
        <header className="iv-header">
          <div className="iv-header-id">
            <WorkerMark seed={worker.slug} size={34} active />
            <div><b>{worker.name}</b><span>Interview in progress</span></div>
          </div>
          <button className="r-btn r-btn-accent" onClick={() => onHire(worker.slug)} type="button" style={{ fontSize: 14, padding: "10px 20px" }}>
            Hire {first}
          </button>
        </header>

        <div className="iv-thread" ref={threadRef}>
          {messages.map((message) => (
            <div className={`iv-msg${message.speaker === "manager" ? " you" : ""}`} key={message.id}>
              {message.speaker === "worker" && <WorkerMark seed={worker.slug} size={28} />}
              <div className="iv-bubble">{message.text}</div>
            </div>
          ))}
          {isSending && (
            <div className="iv-msg">
              <WorkerMark seed={worker.slug} size={28} active />
              <div className="iv-bubble iv-typing"><i /><i /><i /></div>
            </div>
          )}
        </div>

        <div className="iv-suggestions">
          {guide.suggestedQuestions.map((question) => (
            <button className="iv-chip" disabled={isSending} key={question} onClick={() => void askQuestion(question)} type="button">
              {question}
            </button>
          ))}
        </div>

        <form className="iv-composer" onSubmit={handleSubmit}>
          <textarea
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask ${first} about fit, working style, first-week plans, or what they need from you.`}
            rows={3}
            value={input}
          />
          {threadError && <p className="ro-error">{threadError}</p>}
          <div className="iv-composer-foot">
            <button className="r-btn r-btn-accent" disabled={!input.trim() || isSending} type="submit">
              {isSending ? "Asking…" : "Ask question"}
            </button>
          </div>
        </form>
      </section>

      <aside className="iv-right">
        <section className="iv-panel">
          <h2>Fit notes</h2>
          <textarea className="iv-notes" onChange={(e) => setFitNotes(e.target.value)} placeholder="Private notes as you evaluate this worker." rows={5} value={fitNotes} />
        </section>
        <section className="iv-panel">
          <h2>Can help with</h2>
          <ul className="rp-checks">{guide.canHelpWith.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
        <section className="iv-panel">
          <h2>Needs from you</h2>
          <ul className="rp-checks">{guide.needsFromYou.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      </aside>
    </main>
  );
}
