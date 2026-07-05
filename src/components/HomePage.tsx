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
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

export function HomePage({ onBrowseWorkers, onOpenAuth, workers }: HomePageProps) {
  const featuredWorkers = workers.slice(0, 4);
  const departments = departmentCounts(workers);

  return (
    <main className="home-page">
      <section className="brand-hero">
        <div className="brand-hero-copy">
          <p className="section-kicker">Ryva</p>
          <h1>Digital workers, presented like real hires.</h1>
          <p className="brand-hero-text">
            Ryva is a cleaner front door for modern talent: sharp profiles, visible rates, and a hiring experience that
            feels direct, current, and human.
          </p>

          <div className="brand-hero-actions">
            <button className="button button-primary" onClick={onBrowseWorkers} type="button">
              Explore workers
            </button>
            <button className="button button-secondary" onClick={onOpenAuth} type="button">
              Open account
            </button>
          </div>

          <div className="brand-notes">
            <span>{workers.length} active profiles</span>
            <span>{departments.length} departments</span>
            <span>Monthly rates shown upfront</span>
          </div>
        </div>

        <div className="brand-stage" aria-hidden="true">
          <div className="brand-stage-frame">
            <div className="brand-stage-grid" />
            <div className="brand-orbit brand-orbit-one">
              <span>Engineering</span>
              <span>Creator Economy</span>
              <span>Sales</span>
            </div>
            <div className="brand-orbit brand-orbit-two">
              <span>Legal</span>
              <span>Marketing</span>
              <span>Content</span>
            </div>

            <article className="brand-profile-card brand-profile-main">
              <img alt={featuredWorkers[0]?.name ?? "Worker"} src={featuredWorkers[0]?.imageUrl ?? ""} />
              <div>
                <strong>{featuredWorkers[0]?.name}</strong>
                <p>{featuredWorkers[0]?.title}</p>
                <span>{featuredWorkers[0]?.salary}</span>
              </div>
            </article>

            <article className="brand-profile-card brand-profile-side brand-profile-side-a">
              <strong>{featuredWorkers[1]?.name}</strong>
              <p>{featuredWorkers[1]?.department}</p>
            </article>

            <article className="brand-profile-card brand-profile-side brand-profile-side-b">
              <strong>{featuredWorkers[2]?.name}</strong>
              <p>{featuredWorkers[2]?.department}</p>
            </article>

            <div className="brand-rate-chip">
              <span>Starting at</span>
              <strong>$3.8k/mo</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="brand-marquee" aria-label="Marketplace departments">
        <div className="brand-marquee-track">
          {[...departments, ...departments].map(([department, count], index) => (
            <span key={`${department}-${index}`}>
              {department} <em>{count}</em>
            </span>
          ))}
        </div>
      </section>

      <section className="brand-section">
        <div className="brand-section-heading">
          <p className="section-kicker">Selected roster</p>
          <h2>A tighter, more legible talent surface.</h2>
        </div>

        <div className="brand-roster">
          {featuredWorkers.map((worker, index) => (
            <article className={`brand-roster-card brand-roster-card-${index + 1}`} key={worker.slug}>
              <div className="brand-roster-head">
                <img alt={worker.name} src={worker.imageUrl} />
                <div>
                  <strong>{worker.name}</strong>
                  <p>{worker.title}</p>
                </div>
              </div>
              <div className="brand-roster-meta">
                <span>{worker.department}</span>
                <span>{worker.salary}</span>
              </div>
              <p>{worker.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="brand-section brand-manifesto">
        <div className="brand-manifesto-copy">
          <p className="section-kicker">Positioning</p>
          <h2>Ryva should feel less like software and more like a well-run hiring floor.</h2>
        </div>

        <div className="brand-manifesto-panel">
          <div>
            <span>Browse</span>
            <strong>Profiles with rates, specialties, and track record visible at first glance.</strong>
          </div>
          <div>
            <span>Select</span>
            <strong>Workers by function, not fluff.</strong>
          </div>
          <div>
            <span>Hire</span>
            <strong>Move from interest to action without a maze of recruiting software.</strong>
          </div>
        </div>
      </section>
    </main>
  );
}
