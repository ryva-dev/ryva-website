import type { Worker } from "../types";
import { WorkerMark } from "./WorkerMark";

type HireWorkerPageProps = {
  onBack: () => void;
  onConfirmHire: (workerSlug: string) => void;
  worker: Worker;
};

export function HireWorkerPage({ onBack, onConfirmHire, worker }: HireWorkerPageProps) {
  const first = worker.name.split(" ")[0];

  return (
    <main className="hire">
      <a className="rp-back" href={`#worker-${worker.slug}`} onClick={(e) => { e.preventDefault(); onBack(); }}>← Back to profile</a>

      <div className="hire-card">
        <div className="hire-id">
          <WorkerMark seed={worker.slug} size={64} />
          <div>
            <h1>Hire {worker.name}</h1>
            <p>as your {worker.title}</p>
          </div>
          <div className="hire-price">
            <strong>{worker.salary}</strong>
            <span>billed monthly</span>
          </div>
        </div>

        <div className="hire-body">
          <p className="hire-lede">
            {first} starts the moment you sign. First thing, they'll sit down with you for a
            first-day onboarding — learning your goals, brand, approval rules, and how you want
            work done — then get to work from that context.
          </p>

          <div className="hire-steps">
            <div className="hire-step"><span className="n">01</span><b>Onboarding</b><p>{first} asks the questions a good new hire would to understand the job.</p></div>
            <div className="hire-step"><span className="n">02</span><b>Context saved</b><p>Your goals, preferences, and rules are written into {first}'s memory.</p></div>
            <div className="hire-step"><span className="n">03</span><b>First day</b><p>Your office is seeded with first tasks and a briefing, and {first} gets to work.</p></div>
          </div>
        </div>

        <div className="hire-actions">
          <button className="r-btn r-btn-ghost" onClick={onBack} type="button">Cancel</button>
          <button className="r-btn r-btn-accent" onClick={() => onConfirmHire(worker.slug)} type="button">
            Hire {first} · {worker.salary}
          </button>
        </div>
      </div>
    </main>
  );
}
