import type { Worker } from "../types";
import { WorkerMark } from "./WorkerMark";

type WorkerProfilePageProps = {
  onInterview: (workerSlug: string) => void;
  onHire: (workerSlug: string) => void;
  worker: Worker;
};

function Stars({ rating }: { rating: number }) {
  return (
    <span className="rp-stars" aria-label={`${rating} out of 5`}>
      {"★".repeat(rating)}<span className="rp-stars-dim">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

export function WorkerProfilePage({ onHire, onInterview, worker }: WorkerProfilePageProps) {
  const unavailable = worker.status === "Not available for hire";
  const statusClass = worker.status === "Available" ? "open" : worker.status === "Limited availability" ? "limited" : "closed";
  const first = worker.name.split(" ")[0];

  return (
    <main className="rp">
      <a className="rp-back" href="#workers">← Back to the roster</a>

      <section className="rp-hero">
        <div className="rp-hero-id">
          <WorkerMark seed={worker.slug} size={72} active={!unavailable} />
          <div>
            <h1>{worker.name}</h1>
            <p className="rp-role">{worker.title}</p>
            <p className="rp-meta">{worker.department} · {worker.experience}</p>
          </div>
        </div>
        <div className="rp-hero-side">
          <div className="rp-price">
            <strong>{worker.salary}</strong>
            <span className={`r-status ${statusClass}`}>{worker.status}</span>
          </div>
          <div className="rp-actions">
            <button className="r-btn r-btn-accent" onClick={() => onInterview(worker.slug)} type="button">Interview {first}</button>
            {!unavailable && <button className="r-btn r-btn-primary" onClick={() => onHire(worker.slug)} type="button">Hire {first}</button>}
          </div>
        </div>
      </section>

      <div className="rp-grid">
        <div className="rp-content">
          <section className="rp-panel">
            <h2>{worker.profile.summaryTitle}</h2>
            <p>{worker.description}</p>
          </section>

          <section className="rp-panel">
            <h2>Responsibilities</h2>
            <ul className="rp-checks">
              {worker.profile.responsibilities.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>

          <section className="rp-panel">
            <h2>Specialties</h2>
            <div className="rp-tags">
              {worker.profile.specialties.map((item) => <span key={item}>{item}</span>)}
            </div>
          </section>

          <section className="rp-panel">
            <h2>Recent work</h2>
            <div className="rp-samples">
              {worker.profile.sampleWork.map((item) => <div className="rp-sample" key={item}>{item}</div>)}
            </div>
          </section>

          <section className="rp-panel rp-quote">
            <blockquote>{worker.profile.philosophy}</blockquote>
          </section>

          <section className="rp-panel">
            <h2>Reviews</h2>
            <div className="rp-reviews">
              {worker.profile.reviews.map((review) => (
                <article className="rp-review" key={`${review.name}-${review.company}`}>
                  <div className="rp-review-head">
                    <div><strong>{review.name}</strong><p>{review.company}</p></div>
                    <Stars rating={review.rating} />
                  </div>
                  <p>{review.quote}</p>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="rp-sidebar">
          <section className="rp-card">
            <h3>Hiring information</h3>
            <dl className="rp-info">
              <div><dt>Monthly salary</dt><dd>{worker.salary}</dd></div>
              <div><dt>Availability</dt><dd>{worker.status}</dd></div>
              <div><dt>Category</dt><dd>{worker.profile.category}</dd></div>
              <div><dt>Industry</dt><dd>{worker.profile.industry}</dd></div>
            </dl>
            <p className="rp-note">{worker.profile.availabilityNote}</p>
            {!unavailable && (
              <button className="r-btn r-btn-accent" style={{ width: "100%", justifyContent: "center", marginTop: 14 }} onClick={() => onHire(worker.slug)} type="button">
                Hire {first}
              </button>
            )}
          </section>

          <section className="rp-card">
            <h3>Skills</h3>
            <div className="rp-tags">
              {worker.skills.map((skill) => <span key={skill}>{skill}</span>)}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
