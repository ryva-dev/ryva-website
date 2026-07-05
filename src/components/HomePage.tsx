import { useEffect, useMemo, useState, type CSSProperties } from "react";

import type { Worker } from "../types";

type HomePageProps = {
  onBrowseWorkers: () => void;
  onOpenAuth: () => void;
  workers: Worker[];
};

type RoleMoment = {
  department: string;
  role: string;
};

const TILE_COUNT = 108;

function buildRoleMoments(workers: Worker[]): RoleMoment[] {
  const seen = new Set<string>();
  const moments: RoleMoment[] = [];

  for (const worker of workers) {
    const key = `${worker.title}-${worker.department}`;
    if (seen.has(key)) continue;
    seen.add(key);
    moments.push({ department: worker.department, role: worker.title });
  }

  return moments.slice(0, 8);
}

export function HomePage({ onBrowseWorkers, onOpenAuth, workers }: HomePageProps) {
  const roleMoments = useMemo(() => buildRoleMoments(workers), [workers]);
  const [roleIndex, setRoleIndex] = useState(0);

  useEffect(() => {
    if (roleMoments.length <= 1) return undefined;

    const interval = window.setInterval(() => {
      setRoleIndex((current) => (current + 1) % roleMoments.length);
    }, 2200);

    return () => window.clearInterval(interval);
  }, [roleMoments]);

  const activeRole = roleMoments[roleIndex] ?? { department: "Engineering", role: "Operator" };

  return (
    <main className="home-page">
      <section className="brand-hero">
        <div className="brand-hero-copy">
          <h1 className="brand-hero-title">
            <span className="brand-title-line">Your next</span>
            <span className="brand-title-rotator" aria-live="polite">
              <span key={`${activeRole.role}-${activeRole.department}`} className="brand-title-role">
                {activeRole.role}
              </span>
            </span>
            <span className="brand-title-line">is already working.</span>
          </h1>

          <p className="brand-hero-meta">{activeRole.department}</p>

          <p className="brand-hero-description">
            Ryva brings specialist talent into one clear hiring surface for modern teams.
          </p>

          <div className="brand-hero-actions">
            <button className="button button-primary hero-button" onClick={onBrowseWorkers} type="button">
              Browse workers
            </button>
            <button className="hero-link" onClick={onOpenAuth} type="button">
              Sign in
            </button>
          </div>
        </div>

        <div className="brand-grid-panel" aria-hidden="true">
          <div className="brand-grid">
            {Array.from({ length: TILE_COUNT }, (_, index) => (
              <span
                key={index}
                className={`brand-grid-tile brand-grid-tile-${(index % 6) + 1}`}
                style={
                  {
                    "--tile-delay": `${(index % 18) * 0.22}s`,
                    "--tile-duration": `${4.8 + (index % 5) * 0.45}s`,
                  } as CSSProperties
                }
              />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
