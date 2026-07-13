import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("shared agent calls rely on the Anthropic client for one usage charge", async () => {
  const source = await readFile(new URL("./agentLlm.mjs", import.meta.url), "utf8");
  const budgetedMessage = source.match(/async function budgetedMessage[\s\S]*?\n}/)?.[0] || "";
  assert.match(budgetedMessage, /createAnthropicMessage/);
  assert.doesNotMatch(budgetedMessage, /noteSpend/);
});
