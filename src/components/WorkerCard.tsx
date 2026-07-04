import type { Worker } from "../types";

type WorkerCardProps = {
  onHire: (workerSlug: string) => void;
  worker: Worker;
};

export function WorkerCard({ onHire, worker }: WorkerCardProps) {
  return (
    <article className="worker-row-card">
      <div className="worker-row-main">
        <img
          alt={worker.name}
          className="worker-row-avatar"
          src={worker.imageUrl}
        />

        <div className="worker-row-content">
          <div className="worker-row-header">
            <div>
              <h3>{worker.name}</h3>
              <p className="worker-row-title">{worker.title}</p>
              <p className="worker-row-meta">
                {worker.department} · {worker.experience}
              </p>
            </div>

            <div className="worker-row-price">
              <strong>{worker.salary}</strong>
              <span>{worker.status}</span>
            </div>
          </div>

          <p className="worker-row-description">{worker.description}</p>
          <p className="worker-row-skills">{worker.skills.join(" · ")}</p>

          <div className="worker-row-actions">
            <a className="button button-secondary" href={`#worker-${worker.slug}`}>
              View profile
            </a>
            <button className="button button-primary" onClick={() => onHire(worker.slug)} type="button">
              Hire
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
