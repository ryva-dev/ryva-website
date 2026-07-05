import type { Worker } from "../types";

type HireWorkerPageProps = {
  onBack: () => void;
  onConfirmHire: (workerSlug: string) => void;
  worker: Worker;
};

export function HireWorkerPage({ onBack, onConfirmHire, worker }: HireWorkerPageProps) {
  return (
    <main className="content-page">
      <div className="hire-page-shell">
        <a className="back-link" href={`#worker-${worker.slug}`} onClick={(event) => { event.preventDefault(); onBack(); }}>
          ← Back to worker
        </a>

        <header className="content-header">
          <h1>Hire {worker.name}</h1>
          <p>
            You’re about to hire {worker.name} as your {worker.title}. After hiring, {worker.name.split(" ")[0]} will begin a
            new hire onboarding session to learn your goals, preferences, work style, and role-specific context.
          </p>
        </header>

        <div className="hire-page-grid">
          <section className="profile-panel">
            <h2>Hiring decision</h2>
            <dl className="info-list">
              <div>
                <dt>Worker</dt>
                <dd>{worker.name}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{worker.title}</dd>
              </div>
              <div>
                <dt>Department</dt>
                <dd>{worker.department}</dd>
              </div>
              <div>
                <dt>Monthly salary</dt>
                <dd>{worker.salary}</dd>
              </div>
            </dl>
          </section>

          <section className="profile-panel">
            <h2>What happens after hiring</h2>
            <ul className="profile-bullets">
              <li>{worker.name.split(" ")[0]} runs a new hire onboarding session.</li>
              <li>Ryva saves your goals, preferences, approval rules, and role context into the worker’s memory.</li>
              <li>Your office is seeded with first-day tasks, a first briefing, and initial working context.</li>
              <li>{worker.name.split(" ")[0]} then joins Ryva Office and starts operating from that context.</li>
            </ul>
          </section>
        </div>

        <div className="hire-page-actions">
          <button className="button button-primary" onClick={() => onConfirmHire(worker.slug)} type="button">
            Hire {worker.name}
          </button>
          <button className="button button-secondary" onClick={onBack} type="button">
            Back
          </button>
        </div>
      </div>
    </main>
  );
}
