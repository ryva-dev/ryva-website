import { useState } from "react";

import type { Worker } from "../types";

type HomePageProps = {
  onBrowseWorkers: () => void;
  onOpenAuth: () => void;
  workers: Worker[];
};

export function HomePage({ onBrowseWorkers, onOpenAuth, workers: _workers }: HomePageProps) {
  const [activeScene, setActiveScene] = useState<"browse" | "signin" | "hire" | null>(null);

  return (
    <main className="home-page">
      <section
        className="brand-canvas"
        data-scene={activeScene ?? "idle"}
        onMouseLeave={() => setActiveScene(null)}
      >
        <div className="brand-canvas-wordmark">
          <p className="brand-kicker">Ryva</p>
          <h1>Ryva</h1>
        </div>

        <div className="brand-canvas-actions" aria-label="Primary actions">
          <button
            className="brand-action"
            onClick={onBrowseWorkers}
            onFocus={() => setActiveScene("browse")}
            onMouseEnter={() => setActiveScene("browse")}
            type="button"
          >
            Browse
          </button>
          <button
            className="brand-action"
            onClick={onOpenAuth}
            onFocus={() => setActiveScene("signin")}
            onMouseEnter={() => setActiveScene("signin")}
            type="button"
          >
            Sign in
          </button>
          <button
            className="brand-action"
            onClick={onBrowseWorkers}
            onFocus={() => setActiveScene("hire")}
            onMouseEnter={() => setActiveScene("hire")}
            type="button"
          >
            Hire
          </button>
        </div>

        <div className="brand-motion" aria-hidden="true">
          <div className="motion-field">
            <div className="motion-grid" />
            <div className="motion-slab motion-slab-a" />
            <div className="motion-slab motion-slab-b" />
            <div className="motion-slab motion-slab-c" />
            <div className="motion-window motion-window-a">
              <div className="motion-window-lines">
                <span className="w-30" />
                <span className="w-70" />
                <span className="w-46" />
              </div>
            </div>
            <div className="motion-window motion-window-b">
              <div className="motion-window-lines">
                <span className="w-54" />
                <span className="w-34" />
              </div>
            </div>
            <div className="motion-window motion-window-c">
              <div className="motion-window-lines">
                <span className="w-24" />
                <span className="w-58" />
              </div>
            </div>
            <svg className="motion-draw" viewBox="0 0 520 320" fill="none">
              <path d="M30 214C82 164 136 132 196 132C258 132 293 168 293 207C293 242 271 268 245 268C220 268 201 250 201 225C201 191 236 169 282 169C343 169 394 205 444 245" />
              <path d="M412 219L447 247L404 249" />
            </svg>
            <div className="motion-selector motion-selector-a" />
            <div className="motion-selector motion-selector-b" />
            <div className="motion-selector motion-selector-c" />
          </div>
        </div>
      </section>
    </main>
  );
}
