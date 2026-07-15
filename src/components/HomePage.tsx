import { useEffect, useRef, useState } from "react";
import type { Worker } from "../types";
import { WorkerMark } from "./WorkerMark";

type HomePageProps = {
  onBrowseWorkers: () => void;
  onOpenAuth: () => void;
  onOpenGoogleAuth?: () => void;
  workers: Worker[];
  supportEmail?: string | null;
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function useReveal() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    document.querySelectorAll(".r-reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function MockWindow({ url, children, className }: { url: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`mk-window${className ? ` ${className}` : ""}`}>
      <div className="mk-window-bar">
        <span className="dot" /><span className="dot" /><span className="dot" />
        <span className="url">{url}</span>
      </div>
      <div className="mk-window-body">{children}</div>
    </div>
  );
}

type DemoItem = { id: number; title: string; body: string; who: string; entering?: boolean; approving?: boolean };

const DEMO_INITIAL: DemoItem[] = [
  {
    body: "Prepared a 90-day usage counter at $850 against an $1,100 ask. Ready for review.",
    id: 1,
    title: "Contract — Delaney Cruz, $850/post",
    who: "Sloane Pierce"
  },
  {
    body: "6 verified from 41 applicants. Two removed for purchased followers.",
    id: 2,
    title: "Creator shortlist — Velo Apparel",
    who: "Etta Marsh"
  },
  {
    body: "License lapses in 9 days; they're still running two assets as paid ads.",
    id: 3,
    title: "Usage-rights renewal — Meridian",
    who: "June Okafor"
  }
];

function OfficeDemo() {
  const [items, setItems] = useState<DemoItem[]>(DEMO_INITIAL);
  const [status, setStatus] = useState("Drafting outreach to Halcyon Swim");
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const push = (fn: () => void, delay: number) => timers.current.push(window.setTimeout(fn, delay));

    const run = () => {
      setItems(DEMO_INITIAL);
      setStatus("Drafting outreach to Halcyon Swim");

      push(() => {
        setItems((current) => [
          {
            body: "They asked for exclusivity. Drafted a counter holding usage at 60 days.",
            entering: true,
            id: 4,
            title: "Reply draft — Halcyon Swim",
            who: "Mara Vale"
          },
          ...current
        ]);
        setStatus("Waiting on your review");
      }, 3200);

      push(() => {
        setItems((current) => current.map((item) => (item.id === 1 ? { ...item, approving: true } : item)));
      }, 6800);

      push(() => {
        setItems((current) => current.filter((item) => item.id !== 1));
        setStatus("Sending approved contract");
      }, 7700);

      push(() => setStatus("Logging usage-rights dates"), 10500);
      push(run, 14000);
    };

    run();
    return () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current = [];
    };
  }, []);

  return (
    <MockWindow url="ryva.com/office" className="mk-window-hero r-reveal">
      <div className="mk-office">
        <div className="mk-office-nav">
          {["Today", "Chat", "Approvals", "Calendar", "Team", "Files"].map((label, index) => (
            <span key={label} className={index === 0 ? "on" : ""}>
              {label}
            </span>
          ))}
        </div>
        <div className="mk-office-main">
          <div className="mk-office-head">
            <h4>Good morning, Dana.</h4>
            <span>Tuesday, March 4 · 3 workers on the clock</span>
          </div>

          <div className="mk-office-sec">
            <div className="mk-office-sechead">
              Needs your attention <em>{items.length}</em>
            </div>
            {items.map((item) => (
              <div
                key={item.id}
                className={`mk-office-row${item.entering ? " enter" : ""}${item.approving ? " approving" : ""}`}
              >
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </div>
                <span>{item.who}</span>
                {item.approving && (
                  <svg className="mk-check" viewBox="0 0 24 24">
                    <path d="M5 13l4 4 10-11" />
                  </svg>
                )}
              </div>
            ))}
          </div>

          <div className="mk-office-sec">
            <div className="mk-office-sechead">Around the office</div>
            <div className="mk-office-row mk-office-row-quiet">
              <div>
                <strong>{status}</strong>
              </div>
              <span>Mara Vale · now</span>
            </div>
            <div className="mk-office-row mk-office-row-quiet">
              <div>
                <strong>Flagged 2 briefs under your rate floor</strong>
              </div>
              <span>Mara Vale · 26m ago</span>
            </div>
            <div className="mk-office-row mk-office-row-quiet">
              <div>
                <strong>Weekly report drafted for Friday</strong>
              </div>
              <span>June Okafor · 1h ago</span>
            </div>
          </div>
        </div>
      </div>
    </MockWindow>
  );
}

export function HomePage({ onBrowseWorkers, onOpenAuth, workers, supportEmail }: HomePageProps) {
  useReveal();

  const roster = workers.slice(0, 4);

  return (
    <div className="mk">
      <header className="mk-hero">
        <h1 className="r-reveal">
          Hire <em>AI workers</em> into your business.
        </h1>
        <p className="mk-hero-line r-reveal" style={{ transitionDelay: "0.08s" }}>
          Interview them before you commit. Onboard them like any new hire. Delegate real work, review what comes
          back, and run it all from one office.
        </p>
        <div className="mk-hero-actions r-reveal" style={{ transitionDelay: "0.16s" }}>
          <button className="r-btn r-btn-accent" type="button" onClick={onBrowseWorkers}>
            Meet the workers
          </button>
          <a className="r-btn r-btn-ghost" href="#office">
            See the office ↓
          </a>
        </div>
        <div className="mk-proof r-reveal" style={{ transitionDelay: "0.22s" }}>
          On the clock 24/7 · Salaried, not metered · You approve what ships
        </div>
      </header>

      <div className="mk-demo-wrap" id="office">
        <OfficeDemo />
      </div>

      <section className="mk-prose r-reveal">
        <h2>
          A chatbot answers.
          <br />A worker <em>owns.</em>
        </h2>
        <p>
          Chat tools wait for prompts. Agent builders hand you a canvas and wish you luck. Either way, the work —
          the follow-ups, the vetting, the renewals, the reporting — is still yours to remember.
        </p>
        <p>
          A worker is different. A worker holds a role. They know your business, carry their own task list, come back
          with finished work, and ask before doing anything you&apos;d want to see first. You don&apos;t operate them.{" "}
          <strong>You manage them.</strong>
        </p>
      </section>

      <section className="mk-sec">
        <h2 className="r-reveal">
          Hired like a person.
          <br />
          Managed like a <em>team.</em>
        </h2>
        <div className="mk-steps">
          {[
            [
              "01",
              "Interview",
              "Sit down with any worker before you spend a dollar. Ask the hard questions. See how they'd handle your worst Tuesday."
            ],
            [
              "02",
              "Hire",
              "One monthly salary. No credits, no per-task meters. After payment, you onboard Mara and connect Gmail — then she starts working inside your approval rules."
            ],
            [
              "03",
              "Onboard",
              "Their first day works like anyone's first day: they ask about your goals, your rules, your tone, your rate floors — and remember all of it."
            ],
            [
              "04",
              "Manage",
              "Delegate from chat or calendar. Everything that ships past your business waits for your approval first."
            ]
          ].map(([n, title, body]) => (
            <div className="mk-step r-reveal" key={n}>
              <span className="n">{n}</span>
              <div>
                <strong>{title}.</strong>
                <p>{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mk-sec">
        <div className="mk-sec-split r-reveal">
          <h2>
            A roster, not a <em>feature list.</em>
          </h2>
          <button className="mk-link" type="button" onClick={onBrowseWorkers}>
            Browse all workers →
          </button>
        </div>
        <p className="mk-sec-line r-reveal">
          Every worker on Ryva has a defined role, salary, seniority, work products, and operating boundaries. Some
          are open to hire. Some aren&apos;t.
        </p>
        <div className="r-roster mk-roster">
          {roster.map((worker, index) => {
            const unavailable = worker.status === "Not available for hire";
            const statusClass =
              worker.status === "Available"
                ? "open"
                : worker.status === "Limited availability"
                  ? "limited"
                  : "closed";
            return (
              <button
                key={worker.slug}
                type="button"
                className={`r-worker r-reveal${unavailable ? " unavailable" : ""}`}
                style={{ transitionDelay: `${index * 0.06}s` }}
                onClick={() => {
                  window.location.hash = `worker-${worker.slug}`;
                }}
              >
                <WorkerMark seed={worker.slug} size={52} />
                <h4>{worker.name}</h4>
                <div className="role">{worker.title}</div>
                <div className="skills">{worker.skills.slice(0, 4).join(" · ")}</div>
                <div className="foot">
                  <span className="sal">
                    {worker.salary.replace(/\/mo$/, "")}
                    <span>/mo</span>
                  </span>
                  <span className={`r-status ${statusClass}`}>
                    {worker.status === "Limited availability" ? "Limited" : worker.status}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mk-sec mk-split">
        <div className="mk-split-copy r-reveal">
          <h2>
            The interview is <em>real.</em>
          </h2>
          <p>
            Before you hire, you talk. Pressure-test their judgment, ask how they&apos;d handle your edge cases, and
            decide like you&apos;d decide about anyone joining your business. Five minutes is usually enough to know.
          </p>
          <button className="r-btn r-btn-ghost" type="button" onClick={onBrowseWorkers}>
            Try an interview
          </button>
        </div>
        <MockWindow url="ryva.com/interview/mara-vale" className="r-reveal">
          <div className="mk-thread">
            <div className="mk-msg you">
              A skincare brand asks for perpetual paid usage but gives no budget. Walk me through your first hour.
            </div>
            <div className="mk-msg">
              <WorkerMark seed="mara-vale" size={24} active />
              <span>
                I&apos;d flag perpetual usage as the commercial risk, separate creation from licensing, check your stored
                rate floor, and prepare a time-bounded counter with the missing budget question for your approval.
              </span>
            </div>
            <div className="mk-chips">
              <span>How do you qualify brands?</span>
              <span>What do you escalate to me?</span>
            </div>
          </div>
        </MockWindow>
      </section>

      <section className="mk-sec mk-split mk-split-flip">
        <MockWindow url="ryva.com/office — first day" className="r-reveal">
          <div className="mk-onboard">
            <div className="mk-thread">
              <div className="mk-msg">
                <WorkerMark seed="mara-vale" size={24} active />
                <span>What&apos;s your floor rate for sponsored posts? I&apos;ll flag anything under it for your review.</span>
              </div>
              <div className="mk-msg you">$500</div>
            </div>
            <div className="mk-learned">
              <div className="mk-learned-title">What Mara has learned</div>
              <div>Rate floor: $500/post</div>
              <div>Tone: direct, warm</div>
              <div>Escalate: contracts over $2,000</div>
            </div>
          </div>
        </MockWindow>
        <div className="mk-split-copy r-reveal">
          <h2>
            Day one looks like <em>day one.</em>
          </h2>
          <p>
            A new worker doesn&apos;t guess. They ask — what you&apos;re building, who you serve, what a good outcome
            looks like, what they should never do without you. Every answer becomes standing context they work from and
            you can inspect, correct, or expand at any time.
          </p>
        </div>
      </section>

      <section className="mk-dark">
        <div className="mk-dark-inner">
          <h2 className="r-reveal">
            Not a chat window.
            <br />
            An <em>office.</em>
          </h2>
          <div className="mk-dark-features">
            <div className="r-reveal">
              <strong>Today.</strong>
              <p>
                One page that answers the manager&apos;s only morning question: what needs me, what happened,
                what&apos;s ahead.
              </p>
            </div>
            <div className="r-reveal" style={{ transitionDelay: "0.08s" }}>
              <strong>Approvals.</strong>
              <p>
                Every consequential action queues for your sign-off — with the actual artifact, not a summary of one.
              </p>
            </div>
            <div className="r-reveal" style={{ transitionDelay: "0.16s" }}>
              <strong>The calendar, the files, the team.</strong>
              <p>Work has a place. Deadlines hold. Deliverables collect. Nothing lives in a thread you&apos;ll never find again.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mk-sec">
        <h2 className="r-reveal">
          You stay the <em>manager.</em>
        </h2>
        <p className="mk-sec-line r-reveal">
          Delegation on Ryva isn&apos;t fire-and-forget. Workers plan before they act, act inside the permissions you
          set, and bring anything customer-facing back for review. Approve it, edit it, or send it back with notes —
          the worker learns from all three.
        </p>
        <div className="mk-trail r-reveal">
          {["You delegate", "Worker plans", "Work happens", "You review", "It ships"].map((stop, index) => (
            <div className="mk-stop" key={stop}>
              <span>{stop}</span>
              {index === 3 && <em>approve · edit · send back</em>}
            </div>
          ))}
        </div>
      </section>

      <section className="mk-sec mk-case">
        <div className="mk-case-copy r-reveal">
          <span className="mk-label">The first role</span>
          <h2>
            Meet the creator operations <em>worker.</em>
          </h2>
          <p>
            Ryva&apos;s first role runs the operational side of a creator business: inbound triage, brand vetting,
            opportunity research, negotiation preparation, usage-rights tracking, scheduling, and the weekly report you never have time to
            write. It&apos;s a role drowning in exactly the kind of work that shouldn&apos;t need a human — which is
            why it&apos;s where Ryva starts, not where it ends.
          </p>
        </div>
        <div className="mk-stats r-reveal">
          {[
            ["Inbound briefs triaged", "daily"],
            ["Fake-follower screens", "every applicant"],
            ["Rate-floor exceptions", "flagged"],
            ["Usage-rights expirations", "tracked to the day"],
            ["Weekly operations report", "Fridays"]
          ].map(([label, value]) => (
            <div className="mk-stat" key={label}>
              <span>{label}</span>
              <em>{value}</em>
            </div>
          ))}
        </div>
      </section>

      <section className="mk-sec">
        <h2 className="r-reveal">
          One office. Many <em>hires.</em>
        </h2>
        <p className="mk-sec-line r-reveal">Creator operations is the first desk, not the last.</p>
        <div className="mk-roles r-reveal">
          {[
            "Marketing",
            "Sales",
            "Recruiting",
            "Research",
            "Customer support",
            "Finance & admin",
            "Legal operations",
            "Data analysis",
            "Operations",
            "Executive assistance"
          ].map((role, index) => (
            <span key={role} className={index < 4 ? "near" : ""}>
              {role}
            </span>
          ))}
        </div>
        <p className="mk-fine r-reveal">Openings post as roles reach hiring quality — no waitlists for work that isn&apos;t ready.</p>
      </section>

      <section className="mk-sec mk-trust">
        <h2 className="r-reveal">
          Built like you&apos;ll be audited.
          <br />
          Because someday you <em>might be.</em>
        </h2>
        <div className="mk-trust-list">
          <div className="r-reveal">
            <strong>Permissions are explicit.</strong>
            <p>
              Workers act inside boundaries you set — spend limits, send limits, escalation rules. Nothing expands its
              own authority.
            </p>
          </div>
          <div className="r-reveal">
            <strong>Memory is inspectable.</strong>
            <p>Everything a worker knows about your business sits in plain view. Read it, correct it, delete it.</p>
          </div>
          <div className="r-reveal">
            <strong>Approvals are the default.</strong>
            <p>
              Consequential actions wait for you. Every action — approved or not — lands in a permanent history you can
              export.
            </p>
          </div>
        </div>
      </section>

      <section className="mk-sec">
        <h2 className="r-reveal">
          Mara works where your <em>deals live.</em>
        </h2>
        <p className="mk-sec-line r-reveal">
          Connect Gmail so Mara can organize brand replies and prepare follow-up copy inside Ryva. Communication remains yours to send; Mara never creates Gmail drafts or sends messages.
          Billing runs through Stripe. Live ad libraries and contact enrichment are operator-configured —
          creators never paste platform API keys into the product.
        </p>
        <div className="mk-logos r-reveal">
          {["Gmail", "Stripe", "Approval-gated sends"].map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
      </section>

      <section className="mk-final">
        <h2 className="r-reveal">
          Interview Mara in
          <br />
          <em>five minutes.</em>
        </h2>
        <button
          className="r-btn r-btn-accent r-reveal"
          type="button"
          style={{ transitionDelay: "0.1s" }}
          onClick={onBrowseWorkers}
        >
          Meet Mara
        </button>
        <p className="mk-fine r-reveal">No card required to interview. Mara is $79/mo after hire.</p>
        <button className="mk-link r-reveal" type="button" onClick={onOpenAuth} style={{ marginTop: 8 }}>
          or sign in to your office →
        </button>
      </section>

      <footer className="mk-footer">
        <div className="mk-footer-grid">
          <div>
            <div className="mk-footer-brand">
              Ryva<span>.</span>
            </div>
            <p>The workplace for AI workers.</p>
          </div>
          <div>
            <b>Product</b>
            <a onClick={onBrowseWorkers}>Workers</a>
            <a href="#office">The Office</a>
            <a href="#pay">Pricing</a>
            <a href="#security">Security</a>
          </div>
          <div>
            <b>Company</b>
            <a href="#about">About</a>
            <a href={supportEmail ? `mailto:${supportEmail}` : "#privacy"}>Contact</a>
          </div>
          <div>
            <b>Legal</b>
            <a href="#terms">Terms</a>
            <a href="#privacy">Privacy</a>
            <a href="#security">Security</a>
          </div>
        </div>
        <div className="mk-footer-base">
          <span>© {new Date().getFullYear()} Ryva Forge, LLC</span>
          <span>Approval-controlled AI work</span>
        </div>
      </footer>
    </div>
  );
}
