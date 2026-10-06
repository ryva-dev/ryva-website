import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  initializeMicrosoftClarity,
  normalizeClarityProjectId
} from "../../apps/web/src/analytics/clarityCore.js";

function clarityHarness() {
  const scripts = new Map<string, { id: string; src: string }>();
  const runtime: {
    clarity?: ((...args: unknown[]) => void) & { q?: Array<ArrayLike<unknown>> };
    __ryvaClarityProjectId?: string;
  } = {};
  const environment = {
    runtime,
    hasScript: (id: string) => scripts.has(id),
    appendScript: (script: { id: string; src: string }) => scripts.set(script.id, script)
  };
  return { environment, runtime, scripts };
}

void describe("Microsoft Clarity", () => {
  void it("stays disabled without a valid project ID", () => {
    const harness = clarityHarness();
    assert.equal(normalizeClarityProjectId(undefined), null);
    assert.equal(normalizeClarityProjectId("not valid"), null);
    assert.equal(initializeMicrosoftClarity(null, "/", harness.environment), false);
    assert.equal(harness.scripts.size, 0);
  });

  void it("injects the standard Clarity loader only once on public routes", () => {
    const harness = clarityHarness();
    const projectId = normalizeClarityProjectId(" YTMWAMEI85 ");
    assert.equal(projectId, "ytmwamei85");
    assert.equal(initializeMicrosoftClarity(projectId, "/", harness.environment), true);
    assert.equal(initializeMicrosoftClarity(projectId, "/the-program", harness.environment), true);
    assert.equal(harness.scripts.size, 1);
    assert.equal(
      harness.scripts.get("ryva-clarity-script")?.src,
      "https://www.clarity.ms/tag/ytmwamei85"
    );
    assert.equal(typeof harness.runtime.clarity, "function");
  });

  void it("does not initialize directly on account or private application routes", () => {
    const harness = clarityHarness();
    assert.equal(initializeMicrosoftClarity("ytmwamei85", "/login", harness.environment), false);
    assert.equal(initializeMicrosoftClarity("ytmwamei85", "/app/program", harness.environment), false);
    assert.equal(harness.scripts.size, 0);
  });
});
