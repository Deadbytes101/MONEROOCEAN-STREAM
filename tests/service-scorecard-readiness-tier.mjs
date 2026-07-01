import test from "node:test";
import assert from "node:assert/strict";
import { buildServiceCapabilityScorecard } from "../src/service-capability-scorecard.js";

test.describe("service scorecard readiness tier", { concurrency: false }, () => {
  test("marks the current scorecard as phase-I report-ready without claiming production readiness", () => {
    const scorecard = buildServiceCapabilityScorecard();

    assert.equal(scorecard.status, "ok");
    assert.equal(scorecard.readiness_tier, "phase_i_report_ready");
    assert.equal(scorecard.report_only, true);
    assert.equal(scorecard.production_ready, false);
    assert.equal(scorecard.public_service_ready, false);
    assert.equal(scorecard.summary.readiness_tier, "phase_i_report_ready");
    assert.equal(scorecard.summary.production_ready, false);
    assert.equal(scorecard.summary.public_service_ready, false);
    assert.equal(scorecard.summary.runtime_present, false);
    assert.equal(scorecard.summary.intake_present, false);
    assert.equal(scorecard.summary.value_movement_present, false);
    assert.equal(scorecard.checks.controlled_listener_planned, true);
    assert.equal(scorecard.checks.production_ready, false);
    assert.equal(scorecard.checks.public_service_ready, false);
  });

  test("keeps the planned listener from contributing production score", () => {
    const scorecard = buildServiceCapabilityScorecard();
    const listener = scorecard.capabilities.find((capability) => capability.id === "controlled_listener");

    assert.ok(listener);
    assert.equal(listener.status, "planned");
    assert.equal(listener.score, 0);
    assert.equal(listener.max_score, 10);
    assert.match(listener.evidence.join("\n"), /scorecard_does_not_claim_public_service_ready/);
  });
});
