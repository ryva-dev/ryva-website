import type { Worker } from "../types";

type WorkerProfilePageProps = {
  onInterview: (workerSlug: string) => void;
  onHire: (workerSlug: string) => void;
  worker: Worker;
};

function renderStars(rating: number) {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

export function WorkerProfilePage({ onHire, onInterview, worker }: WorkerProfilePageProps) {
  return (
    <main className="worker-profile-page">
      <div className="worker-profile-shell">
        <div className="worker-profile-main">
          <a className="back-link" href="#workers">
            ← Back to workers
          </a>

          <section className="worker-hero-card">
            <div className="worker-hero-summary">
              <img alt={worker.name} className="worker-profile-avatar" src={worker.imageUrl} />
              <div className="worker-hero-copy">
                <h1>{worker.name}</h1>
                <p className="worker-hero-title">{worker.title}</p>
                <p className="worker-hero-meta">
                  {worker.department} · {worker.experience}
                </p>
              </div>
            </div>

            <div className="worker-hero-price">
              <strong>{worker.salary}</strong>
              <span>{worker.status}</span>
            </div>

            <div className="worker-hero-actions">
              <button className="button button-primary" onClick={() => onInterview(worker.slug)} type="button">
                Interview {worker.name.split(" ")[0]}
              </button>
              <button className="button button-secondary" onClick={() => onHire(worker.slug)} type="button">
                Hire {worker.name.split(" ")[0]}
              </button>
              <a className="button button-secondary" href="#workers">
                Save profile
              </a>
            </div>
          </section>

          <div className="worker-profile-grid">
            <div className="worker-profile-content">
              <section className="profile-panel">
                <h2>{worker.profile.summaryTitle}</h2>
                <p>{worker.description}</p>
              </section>

              <section className="profile-panel">
                <h2>Responsibilities</h2>
                <ul className="profile-bullets">
                  {worker.profile.responsibilities.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>

              <section className="profile-panel">
                <h2>Experience</h2>
                <p>{worker.profile.experienceSummary}</p>
              </section>

              <section className="profile-panel">
                <h2>Specialties</h2>
                <ul className="specialties-list">
                  {worker.profile.specialties.map((item) => (
                    <li key={item}>✓ {item}</li>
                  ))}
                </ul>
              </section>

              <section className="profile-panel">
                <h2>Sample work</h2>
                <div className="sample-work-list">
                  {worker.profile.sampleWork.map((item) => (
                    <div className="sample-work-item" key={item}>
                      {item}
                    </div>
                  ))}
                </div>
              </section>

              <section className="profile-panel">
                <h2>Work philosophy</h2>
                <blockquote>{worker.profile.philosophy}</blockquote>
              </section>

              <section className="profile-panel">
                <h2>Reviews</h2>
                <div className="review-list">
                  {worker.profile.reviews.map((review) => (
                    <article className="review-card" key={`${review.name}-${review.company}`}>
                      <div className="review-head">
                        <div>
                          <strong>{review.name}</strong>
                          <p>{review.company}</p>
                        </div>
                        <span className="review-stars">{renderStars(review.rating)}</span>
                      </div>
                      <p>{review.quote}</p>
                    </article>
                  ))}
                </div>
              </section>
            </div>

            <aside className="worker-profile-sidebar">
              <section className="sidebar-card">
                <h2>Hiring information</h2>

                <dl className="info-list">
                  <div>
                    <dt>Monthly salary</dt>
                    <dd>{worker.salary}</dd>
                  </div>
                  <div>
                    <dt>Availability</dt>
                    <dd>{worker.status}</dd>
                  </div>
                  <div>
                    <dt>Category</dt>
                    <dd>{worker.profile.category}</dd>
                  </div>
                  <div>
                    <dt>Industry</dt>
                    <dd>{worker.profile.industry}</dd>
                  </div>
                </dl>

                <div className="sidebar-note">{worker.profile.availabilityNote}</div>
              </section>

              <section className="sidebar-card">
                <h2>Skills</h2>
                <ul className="skills-plain-list">
                  {worker.skills.map((skill) => (
                    <li key={skill}>{skill}</li>
                  ))}
                </ul>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}
