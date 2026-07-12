import assert from "node:assert/strict";
import test from "node:test";
import { getMetricsSnapshot, incrementMetric } from "./metrics.mjs";

test("metrics counters accumulate by name and tags", () => {
  const before = getMetricsSnapshot().metrics["etl_test_counter|kind=a"] || 0;
  incrementMetric("etl_test_counter", 1, { kind: "a" });
  incrementMetric("etl_test_counter", 2, { kind: "a" });
  incrementMetric("etl_test_counter", 1, { kind: "b" });
  const snap = getMetricsSnapshot();
  assert.equal(snap.metrics["etl_test_counter|kind=a"], before + 3);
  assert.equal(snap.metrics["etl_test_counter|kind=b"], 1);
  assert.ok(snap.uptimeSec >= 0);
});
