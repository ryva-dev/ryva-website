import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  StatusLabel,
  Table
} from "./index";

void describe("Ryva shared component system", () => {
  void it("preserves action names and explicit button behavior while loading", () => {
    const markup = renderToStaticMarkup(<Button loading type="submit">Approve agreement</Button>);
    assert.match(markup, /type="submit"/);
    assert.match(markup, /disabled=""/);
    assert.match(markup, /aria-busy="true"/);
    assert.match(markup, />Approve agreement</);
  });

  void it("programmatically associates field hints and errors with the control", () => {
    const markup = renderToStaticMarkup(
      <Field label="Authority evidence" hint="Cite the written source." error="Evidence is required.">
        <Input required />
      </Field>
    );
    const controlId = markup.match(/id="([^"]+)"/)?.[1];
    const describedBy = markup.match(/aria-describedby="([^"]+)"/)?.[1];
    assert.ok(controlId);
    assert.ok(describedBy);
    assert.match(markup, new RegExp(`for="${controlId}"`));
    for (const descriptionId of describedBy.split(" ")) {
      assert.match(markup, new RegExp(`id="${descriptionId}"`));
    }
    assert.match(markup, /aria-invalid="true"/);
  });

  void it("uses authored text as well as semantic tone for status", () => {
    const markup = renderToStaticMarkup(<StatusLabel value="proceed_with_conditions" />);
    assert.match(markup, />proceed with conditions</);
    assert.match(markup, /ry-tone-warning/);
  });

  void it("keeps loading, error, and empty states structurally distinct", () => {
    assert.match(renderToStaticMarkup(<LoadingState label="Loading records" />), /aria-busy="true"/);
    assert.match(renderToStaticMarkup(<ErrorState message="Records unavailable." />), /role="alert"/);
    assert.match(renderToStaticMarkup(<EmptyState description="No records." />), /No records/);
  });

  void it("gives data tables an accessible dataset name", () => {
    const markup = renderToStaticMarkup(
      <Table caption="Qualified products">
        <thead><tr><th scope="col">Product</th></tr></thead>
        <tbody><tr><td>Example</td></tr></tbody>
      </Table>
    );
    assert.match(markup, /aria-label="Qualified products"/);
    assert.match(markup, /<caption class="sr-only">Qualified products<\/caption>/);
    assert.match(markup, /scope="col"/);
  });

  void it("exports only token-driven redesign CSS", () => {
    const css = readFileSync(
      new URL("./components.css", import.meta.url),
      "utf8"
    );
    assert.doesNotMatch(css, /#[\da-f]{3,8}\b/i);
    assert.doesNotMatch(css, /\b(?:rgb|rgba|hsl|hsla)\s*\(/i);
    assert.doesNotMatch(css, /\b(?:linear|radial|conic)-gradient\s*\(/i);
    assert.doesNotMatch(css, /backdrop-filter/i);
  });
});
