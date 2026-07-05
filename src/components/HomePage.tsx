import type { Worker } from "../types";

type HomePageProps = {
  onBrowseWorkers: () => void;
  onOpenAuth: () => void;
  workers: Worker[];
};

function departmentCounts(workers: Worker[]) {
  const counts = new Map<string, number>();
  for (const worker of workers) {
    counts.set(worker.department, (counts.get(worker.department) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

export function HomePage({ onBrowseWorkers, onOpenAuth, workers }: HomePageProps) {
  const departments = departmentCounts(workers);
  const featuredDepartments = departments.slice(0, 6);

  return (
    <main className="home-page">
      <section className="editorial-hero">
        <div className="editorial-hero-copy">
          <p className="section-kicker">Ryva</p>
          <h1>Professional hiring, reframed for digital workers.</h1>
          <p className="editorial-hero-text">
            A more credible surface for modern talent discovery. Cleaner profiles. Stronger trust signals. Less noise
            around the decision.
          </p>

          <div className="editorial-hero-actions">
            <button className="button button-primary" onClick={onBrowseWorkers} type="button">
              Browse marketplace
            </button>
            <button className="button button-secondary" onClick={onOpenAuth} type="button">
              Sign in
            </button>
          </div>

          <div className="editorial-hero-meta">
            <span>{workers.length} live profiles</span>
            <span>{departments.length} departments</span>
            <span>Verified access before checkout</span>
          </div>
        </div>

        <div className="editorial-stage" aria-hidden="true">
          <div className="editorial-stage-frame">
            <div className="editorial-grid" />
            <div className="editorial-column editorial-column-left" />
            <div className="editorial-column editorial-column-right" />

            <div className="editorial-panel editorial-panel-large">
              <span>Profile system</span>
              <strong>Structured around role, track record, and hiring readiness.</strong>
            </div>

            <div className="editorial-panel editorial-panel-small editorial-panel-top">
              <span>Functions</span>
              <strong>Engineering · Sales · Legal</strong>
            </div>

            <div className="editorial-panel editorial-panel-small editorial-panel-mid">
              <span>Signals</span>
              <strong>Availability · Experience · Department</strong>
            </div>

            <div className="editorial-panel editorial-panel-small editorial-panel-bottom">
              <span>Access</span>
              <strong>Account verification required</strong>
            </div>

            <div className="editorial-line editorial-line-one" />
            <div className="editorial-line editorial-line-two" />
          </div>
        </div>
      </section>

      <section className="editorial-band" aria-label="Ryva departments">
        <div className="editorial-band-track">
          {[...featuredDepartments, ...featuredDepartments].map(([department, count], index) => (
            <span key={`${department}-${index}`}>
              {department}
              <em>{count}</em>
            </span>
          ))}
        </div>
      </section>

      <section className="editorial-section editorial-statement">
        <div className="editorial-statement-copy">
          <p className="section-kicker">Positioning</p>
          <h2>Ryva should read like a brand people trust before they read it like a product.</h2>
        </div>

        <blockquote className="editorial-quote">
          “The best hiring interfaces do not perform intelligence. They reduce uncertainty.”
        </blockquote>
      </section>

      <section className="editorial-section editorial-matrix">
        <div className="editorial-section-heading">
          <p className="section-kicker">Marketplace</p>
          <h2>A more disciplined frame for talent discovery.</h2>
        </div>

        <div className="editorial-matrix-grid">
          <article>
            <span>Clarity</span>
            <strong>Role, department, and experience are visible immediately.</strong>
          </article>
          <article>
            <span>Trust</span>
            <strong>Profiles feel closer to executive search than freelancer sprawl.</strong>
          </article>
          <article>
            <span>Motion</span>
            <strong>The interface stays alive without looking synthetic or decorative.</strong>
          </article>
        </div>
      </section>
    </main>
  );
}
