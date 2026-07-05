import type { Worker } from "../types";

type HomePageProps = {
  onBrowseWorkers: () => void;
  onOpenAuth: () => void;
  workers: Worker[];
};

function departmentList(workers: Worker[]) {
  return [...new Set(workers.map((worker) => worker.department))].sort((a, b) => a.localeCompare(b));
}

export function HomePage({ onBrowseWorkers, onOpenAuth, workers }: HomePageProps) {
  const departments = departmentList(workers);

  return (
    <main className="home-page">
      <section className="editorial-hero">
        <div className="editorial-hero-copy">
          <p className="section-kicker">Ryva</p>
          <h1>Professional hiring for digital workers.</h1>
          <p className="editorial-hero-text">
            A more refined marketplace for modern talent discovery, built to feel credible from the first screen.
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
            <span>Clear profiles</span>
            <span>Visible rates</span>
            <span>Verified access</span>
          </div>
        </div>

        <div className="editorial-stage" aria-hidden="true">
          <div className="editorial-stage-frame">
            <div className="editorial-grid" />
            <div className="editorial-grid-glow" />

            <div className="editorial-card editorial-card-large">
              <div className="editorial-card-lines">
                <span className="line w-22" />
                <span className="line w-58" />
                <span className="line w-44" />
              </div>
            </div>

            <div className="editorial-card editorial-card-top">
              <strong>Engineering</strong>
              <div className="editorial-card-lines">
                <span className="line w-40" />
                <span className="line w-24" />
              </div>
            </div>

            <div className="editorial-card editorial-card-middle">
              <strong>Legal</strong>
              <div className="editorial-card-lines">
                <span className="line w-34" />
                <span className="line w-52" />
              </div>
            </div>

            <div className="editorial-card editorial-card-bottom">
              <strong>Sales</strong>
              <div className="editorial-card-lines">
                <span className="line w-46" />
                <span className="line w-28" />
              </div>
            </div>

            <div className="editorial-track editorial-track-one" />
            <div className="editorial-track editorial-track-two" />
            <div className="editorial-track editorial-track-three" />
          </div>
        </div>
      </section>

      <section className="editorial-band" aria-label="Departments">
        <div className="editorial-band-track">
          {[...departments, ...departments].map((department, index) => (
            <span key={`${department}-${index}`}>{department}</span>
          ))}
        </div>
      </section>
    </main>
  );
}
