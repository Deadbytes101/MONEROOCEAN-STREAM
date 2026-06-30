import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execPath } from "node:process";
import { promisify } from "node:util";
import { planSettlement } from "../src/settlement-plan.js";

const execFileAsync = promisify(execFile);

test.describe("settlement plan report", { concurrency: false }, () => {
  test("creates reproducible review rows without execution", () => {
    const plan = planSettlement({
      rows: [{ account_id: "synthetic-account-a", worker: "synthetic-worker-a", credited_difficulty: 10 }],
      policy: { min_amount_units: 10, fee_estimate_units: 1 }
    });

    assert.equal(plan.valid, true);
    assert.equal(plan.execution_enabled, false);
    assert.equal(plan.operator_approval_required, true);
    assert.deepEqual(plan.rows[0], {
      account_id: "synthetic-account-a",
      worker: "synthetic-worker-a",
      credited_difficulty: 10,
      amount_units: 10,
      fee_estimate_units: 1,
      net_amount_units: 9,
      status: "ready_for_review",
      reason: "threshold_met",
      execution_enabled: false,
      operator_approval_required: true
    });
    assert.equal(plan.summary.review_rows, 1);
    assert.equal(plan.summary.secret_material_stored, false);
  });

  test("holds rows below threshold without estimating a fee", () => {
    const plan = planSettlement({
      rows: [{ account_id: "synthetic-account-a", worker: "synthetic-worker-a", credited_difficulty: 9 }],
      policy: { min_amount_units: 10, fee_estimate_units: 1 }
    });

    assert.equal(plan.rows[0].status, "below_threshold");
    assert.equal(plan.rows[0].reason, "threshold_not_met");
    assert.equal(plan.rows[0].fee_estimate_units, 0);
    assert.equal(plan.rows[0].net_amount_units, 9);
    assert.equal(plan.summary.held_rows, 1);
    assert.equal(plan.summary.review_rows, 0);
  });

  test("sorts rows by account and worker", () => {
    const plan = planSettlement({
      rows: [
        { account_id: "synthetic-account-b", worker: "worker-b", credited_difficulty: 20 },
        { account_id: "synthetic-account-a", worker: "worker-a", credited_difficulty: 10 }
      ],
      policy: { min_amount_units: 10, fee_estimate_units: 1 }
    });

    assert.deepEqual(plan.rows.map((row) => `${row.account_id}/${row.worker}`), ["synthetic-account-a/worker-a", "synthetic-account-b/worker-b"]);
    assert.equal(plan.summary.total_amount_units, 30);
    assert.equal(plan.summary.total_fee_estimate_units, 2);
    assert.equal(plan.summary.total_net_amount_units, 28);
  });

  test("writes a stable settlement plan report artifact", async () => {
    const directory = await mkdtemp(join(tmpdir(), "dbyte-settlement-plan-"));
    const output = join(directory, "settlement-plan.json");

    try {
      const { stdout } = await execFileAsync(execPath, [
        "scripts/report-settlement-plan.mjs",
        "--protocol",
        "tests/fixtures/service-protocol.clean.jsonl",
        "--jobs",
        "tests/fixtures/job-source.clean.json",
        "--out",
        output,
        "--min-amount-units",
        "10",
        "--fee-estimate-units",
        "1"
      ]);
      const report = JSON.parse(await readFile(output, "utf8"));

      assert.match(stdout, /settlement\.plan\.status=ok/);
      assert.match(stdout, /settlement\.plan\.execution_enabled=false/);
      assert.equal(report.schema, 1);
      assert.equal(report.status, "ok");
      assert.equal(report.execution_enabled, false);
      assert.equal(report.operator_approval_required, true);
      assert.equal(report.plan_valid, true);
      assert.equal(report.summary.plan_rows, 1);
      assert.equal(report.summary.review_rows, 1);
      assert.equal(report.summary.secret_material_stored, false);
      assert.equal(report.rows[0].status, "ready_for_review");
      assert.deepEqual(report.parse_errors, []);
      assert.deepEqual(report.registry_errors, []);
      assert.deepEqual(report.job_errors, []);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
