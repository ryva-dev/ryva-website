import { useEffect, useRef, useState } from "react";
import type { Worker } from "../types";
import { WorkerMark } from "./WorkerMark";

type HomePageProps = {
  onBrowseWorkers: () => void;
  onOpenAuth: () => void;
  onOpenGoogleAuth?: () => void;
  workers: Worker[];
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
      { threshold: 0.15 }
    );
    document.querySelectorAll(".r-reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

type DemoMessage = { id: number; who: "you" | "worker"; text: string; time: string; typing?: boolean };
type DemoQueueItem = { id: number; seed: string; who: string; title: string; sub: string };

const INITIAL_QUEUE: DemoQueueItem[] = [
  { id: 1, seed: "etta-marsh", who: "Etta Marsh", title: "Creator shortlist — Velo Apparel brief", sub: "6 profiles · rates verified" },
  { id: 2, seed: "sloane-pierce", who: "Sloane Pierce", title: "Usage-rights renewal — Delaney Cruz", sub: "expires in 9 days" },
];

function LiveDemo() {
  const [messages, setMessages] = useState<DemoMessage[]>([
    { id: 0, who: "you", text: "Where did we land with Delaney on the skincare campaign?", time: "8:42 AM" },
  ]);
  const [queue, setQueue] = useState<DemoQueueItem[]>(INITIAL_QUEUE);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [status, setStatus] = useState("Reviewing inbound");
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const push = (fn: () => void, delay: number) => {
      timers.current.push(window.setTimeout(fn, delay));
    };

    const run = () => {
      setMessages([{ id: 0, who: "you", text: "Where did we land with Delaney on the skincare campaign?", time: "8:42 AM" }]);
      setQueue(INITIAL_QUEUE);
      setApprovingId(null);
      setStatus("Reviewing inbound");

      push(() => {
        setStatus("Replying to you");
        setMessages((m) => [...m, { id: 1, who: "worker", text: "", time: "", typing: true }]);
      }, 1400);

      push(() => {
        setStatus("Drafting contracts");
        setMessages((m) => [
          ...m.filter((x) => !x.typing),
          { id: 2, who: "worker", text: "Closed at $850/post with 90-day usage rights — she wanted $1,100. Contract is drafted and waiting in your queue.", time: "8:44 AM" },
        ]);
      }, 3400);

      push(() => {
        setQueue((q) => [
          { id: 99, seed: "sloane-pierce", who: "Sloane Pierce", title: "Contract — Delaney Cruz, $850/post", sub: "just now" },
          ...q,
        ]);
      }, 6200);

      push(() => setApprovingId(1), 8600);
      push(() => setQueue((q) => q.filter((item) => item.id !== 1)), 9500);
      push(run, 14500);
    };

    run();
    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
  }, []);

  return (
    <div className="r-demo-wrap r-reveal" style={{ transitionDelay: "0.24s" }}>
      <div className="r-demo" aria-label="Product demonstration">
        <div className="r-demo-chrome">
          <span className="dot" /><span className="dot" /><span className="dot" />
          <span className="url">ryvaforge.com/office</span>
        </div>
        <div className="r-demo-body">
          <div className="r-demo-rail">
            <div className="r-rail-item on">
              <svg viewBox="0 0 24 24"><path d="M3 12l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>
              Today
            </div>
            <div className="r-rail-item">
              <svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-8 8H5l-2 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z" /></svg>
              Chat
            </div>
            <div className="r-rail-item">
              <svg viewBox="0 0 24 24"><path d="M9 12l2 2 4-5" /><circle cx="12" cy="12" r="9" /></svg>
              Approvals
            </div>
            <div className="r-rail-item">
              <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></svg>
              Calendar
            </div>
            <div className="r-rail-sep" />
            <div className="r-rail-worker">
              <WorkerMark seed="sloane-pierce" size={26} active />
              <div><b>Sloane Pierce</b><span className={status !== "Reviewing inbound" ? "live" : ""}>{status}</span></div>
            </div>
            <div className="r-rail-worker">
              <WorkerMark seed="etta-marsh" size={26} active />
              <div><b>Etta Marsh</b><span>Vetting 6 creators</span></div>
            </div>
            <div className="r-rail-worker">
              <WorkerMark seed="rowan-feld" size={26} />
              <div><b>Rowan Feld</b><span>Starts at 9:00 AM</span></div>
            </div>
          </div>

          <div className="r-demo-chat">
            <div className="r-chat-head">
              <WorkerMark seed="sloane-pierce" size={34} active />
              <div><b>Sloane Pierce</b><span>Senior UGC Talent Manager</span></div>
            </div>
            <div className="r-chat-scroll">
              {messages.map((m) => (
                <div key={m.id} className={`r-msg r-msg-enter${m.who === "you" ? " you" : ""}`}>
                  {m.who === "worker" && <WorkerMark seed="sloane-pierce" size={26} active />}
                  {m.typing ? (
                    <div className="r-bubble r-typing"><i /><i /><i /></div>
                  ) : (
                    <div className="r-bubble">{m.text}{m.time && <time>{m.time}</time>}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="r-demo-side">
            <div className="r-side-title">Waiting on you <span className="count">{queue.length}</span></div>
            <div className="r-queue">
              {queue.map((item) => (
                <div key={item.id} className={`r-qcard${item.id === 99 ? " r-qenter" : ""}${approvingId === item.id ? " r-qapproved" : ""}`}>
                  <div className="r-qtop"><WorkerMark seed={item.seed} size={18} /><span>{item.who}</span></div>
                  <p>{item.title}</p>
                  <div className="r-qsub">{item.sub}</div>
                  <div className="r-qactions">
                    <button className="r-qbtn go" type="button">Approve</button>
                    <button className="r-qbtn" type="button">Open</button>
                  </div>
                  {approvingId === item.id && (
                    <div className="r-checkflash">
                      <svg viewBox="0 0 24 24"><path d="M5 13l4 4 10-11" /></svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HomePage({ onBrowseWorkers, onOpenAuth, workers }: HomePageProps) {
  useReveal();

  const goToProfile = (slug: string) => {
    window.location.hash = `worker-${slug}`;
  };

  const rosterPreview = workers.slice(0, 4);

  return (
    <div className="r-landing">
      <header className="r-hero">
        <h1 className="r-reveal">Meet your next <em>hire.</em></h1>
        <p className="r-hero-line r-reveal" style={{ transitionDelay: "0.08s" }}>
          A marketplace of digital workers for the creator economy. Interview them, hire them,
          and run your roster from one office.
        </p>
        <div className="r-hero-actions r-reveal" style={{ transitionDelay: "0.16s" }}>
          <button className="r-btn r-btn-accent" type="button" onClick={onBrowseWorkers}>Browse the marketplace</button>
          <button className="r-btn r-btn-ghost" type="button" onClick={() => { window.location.hash = "how"; }}>See how it works</button>
        </div>
      </header>

      <LiveDemo />

      <div className="r-proofline r-reveal">
        <span><b>247</b> tasks completed this week</span>
        <span><b>11 min</b> median response</span>
        <span><b>24/7</b> on the clock</span>
        <span><b>$0</b> recruiting fees</span>
      </div>

      <section className="r-block" id="how">
        <h2 className="r-reveal">Hired like a person.<br />Managed like a <em>team.</em></h2>
        <div className="r-steps">
          <div className="r-step r-reveal">
            <h3>Interview</h3>
            <p>Sit down with any worker before you commit. Ask hard questions. See how they think.</p>
            <div className="r-step-visual">
              <div className="r-mini">
                <div className="r-mini-q">A creator ghosts mid-campaign with deliverables due Friday. Walk me through it.</div>
                <div className="r-mini-a">First hour: confirm the gap, activate the backup roster I keep warm for exactly this…</div>
              </div>
            </div>
          </div>
          <div className="r-step r-reveal" style={{ transitionDelay: "0.08s" }}>
            <h3>Hire</h3>
            <p>One salary, no scope creep. They start the moment you sign.</p>
            <div className="r-step-visual">
              <div className="r-mini r-mini-hire">
                <WorkerMark seed="sloane-pierce" size={44} />
                <b>Sloane Pierce</b>
                <span className="sal">$1,900 / month</span>
                <span className="hired">✓ Hired · starts now</span>
              </div>
            </div>
          </div>
          <div className="r-step r-reveal" style={{ transitionDelay: "0.16s" }}>
            <h3>Manage</h3>
            <p>Your office. Their output. You approve what matters and stay out of the rest.</p>
            <div className="r-step-visual">
              <div className="r-mini">
                <div className="r-mini-feed">
                  <div className="r-mini-row"><WorkerMark seed="etta-marsh" size={18} /><span><b>Etta</b> vetted 6 creators</span><time>9:14</time></div>
                  <div className="r-mini-row"><WorkerMark seed="sloane-pierce" size={18} /><span><b>Sloane</b> closed a rate at $850</span><time>9:31</time></div>
                  <div className="r-mini-row"><WorkerMark seed="rowan-feld" size={18} /><span><b>Rowan</b> sent 14 outreach emails</span><time>9:47</time></div>
                  <div className="r-mini-row"><WorkerMark seed="etta-marsh" size={18} /><span><b>Etta</b> flagged a scam brief</span><time>10:02</time></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="r-block" id="roster">
        <h2 className="r-reveal">The <em>roster.</em></h2>
        <div className="r-roster">
          {rosterPreview.map((worker, index) => {
            const unavailable = worker.status === "Not available for hire";
            const statusClass = worker.status === "Available" ? "open" : worker.status === "Limited availability" ? "limited" : "closed";
            const salaryNumber = worker.salary.replace(/\/mo$/, "");
            return (
              <button
                key={worker.slug}
                type="button"
                className={`r-worker r-reveal${unavailable ? " unavailable" : ""}`}
                style={{ transitionDelay: `${index * 0.06}s` }}
                onClick={() => goToProfile(worker.slug)}
              >
                <WorkerMark seed={worker.slug} size={52} />
                <h4>{worker.name}</h4>
                <div className="role">{worker.title}</div>
                <div className="skills">{worker.skills.slice(0, 4).join(" · ")}</div>
                <div className="foot">
                  <span className="sal">{salaryNumber}<span>/mo</span></span>
                  <span className={`r-status ${statusClass}`}>
                    {worker.status === "Available" ? "Available" : worker.status === "Limited availability" ? "Limited" : "Not available for hire"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        <div className="r-roster-cta r-reveal">
          <button type="button" onClick={onBrowseWorkers}>View all workers →</button>
        </div>
      </section>

      <div className="r-salary" id="pay">
        <div className="r-salary-inner">
          <div className="r-reveal">
            <h2>Salaried,<br />not <em>metered.</em></h2>
            <p>No hourly clocks, no per-task invoices, no credits. Every worker has one salary and works your whole business, all month.</p>
          </div>
          <div className="r-paytable r-reveal" style={{ transitionDelay: "0.1s" }}>
            <div className="r-payrow"><div><b>Junior</b><span>the fundamentals, done daily</span></div><span className="amt">$490 /mo</span></div>
            <div className="r-payrow"><div><b>Mid-level</b><span>runs the roster without you</span></div><span className="amt">$940 /mo</span></div>
            <div className="r-payrow"><div><b>Senior</b><span>negotiates, protects, advises</span></div><span className="amt">$1,900 /mo</span></div>
            <div className="r-payrow"><div><b>Annual</b><span>two months free on any worker</span></div><span className="amt">−16%</span></div>
          </div>
        </div>
      </div>

      <section className="r-final">
        <h2 className="r-reveal">The interview takes<br /><em>five minutes.</em></h2>
        <button className="r-btn r-btn-accent r-reveal" type="button" style={{ transitionDelay: "0.1s" }} onClick={onBrowseWorkers}>
          Meet the workers
        </button>
        <div style={{ marginTop: 20 }} className="r-reveal">
          <button
            type="button"
            onClick={onOpenAuth}
            style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 14 }}
          >
            or sign in to your office →
          </button>
        </div>
      </section>

      <footer className="r-footer">
        <span className="fine">© {new Date().getFullYear()} Ryva Forge</span>
        <div className="fl">
          <a onClick={onBrowseWorkers}>Marketplace</a>
          <a onClick={() => { window.location.hash = "about"; }}>About</a>
        </div>
      </footer>
    </div>
  );
}
