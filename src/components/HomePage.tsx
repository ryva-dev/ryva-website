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
  const featuredWorkers = workers.slice(0, 3);
  const departments = departmentCounts(workers);

  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-hero-copy">
          <p className="section-kicker">Ryva marketplace</p>
          <h1>Hire specialist digital workers with the clarity of a professional marketplace.</h1>
          <p className="home-hero-text">
            Browse vetted operators across engineering, sales, legal, content, and creator partnerships. Compare
            experience, monthly rates, and work style before you commit.
          </p>

          <div className="home-hero-actions">
            <button className="button button-primary" onClick={onBrowseWorkers} type="button">
              Browse workers
            </button>
            <button className="button button-secondary" onClick={onOpenAuth} type="button">
              Create account
            </button>
          </div>

          <dl className="home-proof-grid">
            <div>
              <dt>{workers.length}</dt>
              <dd>active worker profiles</dd>
            </div>
            <div>
              <dt>{departments.length}</dt>
              <dd>operational departments</dd>
            </div>
            <div>
              <dt>24 hrs</dt>
              <dd>average verification cycle</dd>
            </div>
          </dl>
        </div>

        <div className="home-stage">
          <div className="stage-panel stage-panel-primary">
            <div className="stage-panel-head">
              <span>Hiring pipeline</span>
              <strong>Today</strong>
            </div>
            <div className="stage-lanes">
              <div className="stage-lane">
                <h2>Shortlist</h2>
                <div className="stage-worker stage-worker-delay-1">
                  <strong>Marcus Reyes</strong>
                  <span>Engineering · $8,500/mo</span>
                </div>
                <div className="stage-worker stage-worker-delay-2">
                  <strong>Sofia Marchetti</strong>
                  <span>Marketing · $6,000/mo</span>
                </div>
              </div>
              <div className="stage-lane">
                <h2>Review</h2>
                <div className="stage-worker stage-worker-delay-3">
                  <strong>Lena Carter</strong>
                  <span>Creator Economy · $4,200/mo</span>
                </div>
              </div>
            </div>
          </div>

          <div className="stage-panel stage-panel-secondary stage-panel-float-a">
            <p>Signals</p>
            <ul>
              <li>Availability updates refresh daily</li>
              <li>Profile rates are shown upfront</li>
              <li>Email verification gates checkout</li>
            </ul>
          </div>

          <div className="stage-panel stage-panel-secondary stage-panel-float-b">
            <p>Live demand</p>
            <div className="demand-list">
              <span>Engineering</span>
              <span>Sales</span>
              <span>Legal</span>
              <span>Content</span>
            </div>
          </div>
        </div>
      </section>

      <section className="ticker-band" aria-label="Departments">
        <div className="ticker-track">
          {[...departments, ...departments].map(([department, count], index) => (
            <span key={`${department}-${index}`}>
              {department} · {count} worker{count > 1 ? "s" : ""}
            </span>
          ))}
        </div>
      </section>

      <section className="home-section home-how">
        <div className="section-heading">
          <p className="section-kicker">How it works</p>
          <h2>Move from search to hire without stitched-together recruiting tools.</h2>
        </div>

        <div className="how-grid">
          <article className="how-card">
            <span>01</span>
            <h3>Search by real operating need</h3>
            <p>Filter by department, salary, and experience level instead of vague talent categories.</p>
          </article>
          <article className="how-card how-card-delay-1">
            <span>02</span>
            <h3>Compare profiles side by side</h3>
            <p>See specialties, sample work, availability, and rate structure before outreach starts.</p>
          </article>
          <article className="how-card how-card-delay-2">
            <span>03</span>
            <h3>Verify, shortlist, and hire</h3>
            <p>Account verification keeps the process clean while checkout stays tied to a specific worker profile.</p>
          </article>
        </div>
      </section>

      <section className="home-section home-featured">
        <div className="section-heading section-heading-inline">
          <div>
            <p className="section-kicker">Featured workers</p>
            <h2>Profiles structured like professional hiring decisions.</h2>
          </div>
          <button className="button button-secondary" onClick={onBrowseWorkers} type="button">
            View all workers
          </button>
        </div>

        <div className="featured-grid">
          {featuredWorkers.map((worker, index) => (
            <article className={`featured-card featured-card-${index + 1}`} key={worker.slug}>
              <div className="featured-card-top">
                <img alt={worker.name} src={worker.imageUrl} />
                <div>
                  <h3>{worker.name}</h3>
                  <p>{worker.title}</p>
                  <span>
                    {worker.department} · {worker.experience}
                  </span>
                </div>
              </div>
              <p className="featured-description">{worker.description}</p>
              <div className="featured-meta">
                <strong>{worker.salary}</strong>
                <span>{worker.status}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
