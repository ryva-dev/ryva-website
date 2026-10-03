import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { platformCopy } from "./shared.js";

void describe("platformCopy", () => {
  void it("strips synthetic and fixture language from user-visible copy", () => {
    assert.equal(platformCopy("Supported synthetic fixture"), "Supported");
    assert.equal(platformCopy("Synthetic overdue buyer follow-up"), "Overdue buyer follow-up");
    assert.doesNotMatch(platformCopy("Supported synthetic fixture"), /synthetic/i);
  });
});
