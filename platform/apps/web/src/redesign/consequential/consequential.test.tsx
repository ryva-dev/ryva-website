import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ConsequentialReviewLayout,
  ExactArtifact,
  ReadinessSummary,
  ValidationSummary
} from "./ConsequentialReview";

void describe("Ryva Consequential Review", () => {
  void it("places readiness before the exact artifact in semantic order", () => {
    const html = renderToStaticMarkup(
      <ConsequentialReviewLayout readiness={<ReadinessSummary state="blocked" description="A human decision is unavailable." blockers={["Authority is missing."]} />}>
        <ExactArtifact title="Stored artifact" description="Exact content" version="4">Artifact body</ExactArtifact>
      </ConsequentialReviewLayout>
    );
    assert.ok(html.indexOf("Decision readiness") < html.indexOf("Exact item under review"));
    assert.match(html, /Authority is missing/);
    assert.match(html, /Version 4/);
  });

  void it("gives every validation result authored text", () => {
    const html = renderToStaticMarkup(<ValidationSummary checks={[
      { id: "pass", label: "Exact artifact", detail: "Stored version is visible.", state: "passed" },
      { id: "review", label: "Authority", detail: "Human review required.", state: "requires_review" },
      { id: "fail", label: "Conflict", detail: "A blocker remains.", state: "failed" }
    ]} />);
    assert.match(html, />passed</);
    assert.match(html, />requires review</);
    assert.match(html, />failed</);
  });

  void it("keeps the consequential stylesheet token-only", () => {
    const css = readFileSync(new URL("./consequential.css", import.meta.url), "utf8");
    assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i);
    assert.doesNotMatch(css, /\b(?:rgb|hsl)a?\(/i);
    assert.doesNotMatch(css, /linear-gradient|radial-gradient|backdrop-filter/i);
  });
});
