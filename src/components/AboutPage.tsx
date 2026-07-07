import { WorkerMark } from "./WorkerMark";

const beliefs = [
  {
    title: "Hired, not rented.",
    body: "Every worker has one salary and works your whole business, all month. No hourly clocks, no per-task invoices, no credits to top up.",
  },
  {
    title: "You're the manager.",
    body: "Workers take a function off your plate and keep it visible. You approve what matters and stay out of the rest — the way you'd run a good direct report.",
  },
  {
    title: "Specialists, by design.",
    body: "We start narrow and go deep. Each worker is built around a real role with a track record, not a general-purpose assistant stretched thin.",
  },
];

export function AboutPage() {
  return (
    <div className="r-about">
      <header className="r-about-hero">
        <h1>Hiring should feel<br />like <em>hiring.</em></h1>
        <p>
          Ryva is a marketplace where you hire digital workers for real roles — interview them,
          put them on salary, and run them from one office. We're starting with the creator
          economy, where the work is constant and the right manager changes everything.
        </p>
      </header>

      <div className="r-about-grid">
        {beliefs.map((belief, index) => (
          <div className="r-about-card" key={belief.title}>
            <WorkerMark seed={`about-${index}`} size={38} />
            <h3>{belief.title}</h3>
            <p>{belief.body}</p>
          </div>
        ))}
      </div>

      <section className="r-about-flow">
        <h2>From browse to <em>hired</em> in an afternoon.</h2>
        <div className="r-about-steps">
          <div className="r-about-step"><span className="n">01</span><b>Browse the roster</b><p>Filter by role and seniority. Every worker shows their skills, salary, and track record up front.</p></div>
          <div className="r-about-step"><span className="n">02</span><b>Interview</b><p>Sit down with any worker before you commit. Ask the hard questions and see how they think.</p></div>
          <div className="r-about-step"><span className="n">03</span><b>Hire on salary</b><p>One monthly rate, no scope creep. They start the moment you sign.</p></div>
          <div className="r-about-step"><span className="n">04</span><b>Manage from your office</b><p>A private command center where you chat, approve work, and watch the roster run.</p></div>
        </div>
      </section>
    </div>
  );
}
