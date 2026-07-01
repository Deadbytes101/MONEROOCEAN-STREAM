import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execPath } from "node:process";
import { promisify } from "node:util";
import { buildServiceCapabilityScorecard } from "../src/service-capability-scorecard.js";
import { assessServiceReadiness } from "../src/service-readiness.js";

const execFileAsync = promisify(execFile);

test.describe("service capability scorecard", { concurrency: false }, () => {
  test("scores current report-only service capability without claiming listener readiness", () => {
    const scorecard = buildServiceCapabilityScorecard();

    assert.equal(scorecard.schema, 1);
    assert.equal(scorecard.status, "ok");
    assert.equal(scorecard.mode, "report_only_capability_scorecard");
    assert.equal(scorecard.report_only, true);
    assert.equal(scorecard.competitive_target, "evidence_first_operator_pool");
    assert.equal(scorecard.score, 90);
    assert.equal(scorecard.max_score, 100);
    assert.equal(scorecard.score_percent, 90);
    assert.equal(scorecard.summary.capability_count, 6);
    assert.equal(scorecard.summary.ok_capabilities, 5);
    assert.equal(scorecard.summary.planned_capabilities, 1);
    assert.equal(scorecard.summary.runtime_present, false);
    assert.equal(scorecard.summary.intake_present, false);
    assert.equal(scorecard.summary.value_movement_present, false);
    assert.deepEqual(scorecard.blockers, []);
    assert.ok(scorecard.capabilities.find((capability) => capability.id === "controlled_listener" && capability.status === "planned"));
  });

  test("turns attention when readiness has blockers", () => {
    const readiness = assessServiceReadiness({ config: { enabled: true } });
    const scorecard = buildServiceCapabilityScorecard({ readiness });

    assert.equal(scorecard.status, "attention");
    assert.equal(scorecard.score < scorecard.max_score, true);
    assert.match(scorecard.blockers.join("\n"), /readiness_not_ok/);
    assert.match(scorecard.blockers.join("\n"), /scorecard_requires_report_only_readiness|runtime_must_remain_absent_for_scorecard/);
  });

  test("writes a stable scorecard report artifact", async () => {
    const directory = await mkdtemp(join(tmpdir(), "dbyte-service-scorecard-"));
    const output = join(directory, "scorecard.json");

    try {
      const { stdout } = await execFileAsync(execPath, ["scripts/report-service-capability-scorecard.mjs", "--out", output]);
      const report = JSON.parse(await readFile(output, "utf8"));

      assert.match(stdout, /service\.capability\.status=ok/);
      assert.match(stdout, /service\.capability\.score=90/);
      assert.equal(report.schema, 1);
      assert.equal(report.status, "ok");
      assert.equal(report.report_path, output);
      assert.equal(report.score, 90);
      assert.equal(report.max_score, 100);
      assert.equal(report.summary.runtime_present, false);
      assert.equal(report.summary.intake_present, false);
      assert.equal(report.summary.value_movement_present, false);
      assert.deepEqual(report.blockers, []);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
