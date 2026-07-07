import type { Worker } from "../types";
import { WorkerMark } from "./WorkerMark";

type WorkerCardProps = {
  onHire: (workerSlug: string) => void;
  worker: Worker;
};

export function WorkerCard({ onHire, worker }: WorkerCardProps) {
  const unavailable = worker.status === "Not available for hire";
  const statusClass =
    worker.status === "Available" ? "open" : worker.status === "Limited availability" ? "limited" : "closed";
  const statusLabel =
    worker.status === "Available" ? "Available" : worker.status === "Limited availability" ? "Limited" : "Not available for hire";
  const salaryNumber = worker.salary.replace(/\/mo$/, "");

  return (
    <article className={`r-worker${unavailable ? " unavailable" : ""}`} style={{ cursor: "default" }}>
      <WorkerMark seed={worker.slug} size={52} />
      <h4>{worker.name}</h4>
      <div className="role">{worker.title}</div>
      <div className="skills">{worker.skills.slice(0, 4).join(" · ")}</div>

      <div className="foot">
        <span className="sal">{salaryNumber}<span>/mo</span></span>
        <span className={`r-status ${statusClass}`}>{statusLabel}</span>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <a className="r-btn r-btn-ghost" href={`#worker-${worker.slug}`} style={{ flex: 1, justifyContent: "center", fontSize: 13, padding: "9px 14px" }}>
          View profile
        </a>
        {!unavailable && (
          <button
            className="r-btn r-btn-accent"
            type="button"
            onClick={() => onHire(worker.slug)}
            style={{ flex: 1, justifyContent: "center", fontSize: 13, padding: "9px 14px" }}
          >
            Hire
          </button>
        )}
      </div>
    </article>
  );
}
