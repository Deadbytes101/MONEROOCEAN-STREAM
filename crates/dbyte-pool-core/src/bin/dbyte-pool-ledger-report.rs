#![forbid(unsafe_code)]

use dbyte_pool_core::{
    FakePoolHarness, Hash32, JobId, LedgerReplay, SessionId, ShareLedger, ShareResult, ShareSubmit,
};
use std::{env, fs};

fn main() {
    let report = match report_from_args(env::args().skip(1)) {
        Ok(report) => report,
        Err(error) => {
            eprintln!("error: {error}");
            std::process::exit(2);
        }
    };
    println!("{}", ledger_replay_json(&report));
}

fn report_from_args(args: impl IntoIterator<Item = String>) -> Result<LedgerReplay, String> {
    let args = args.into_iter().collect::<Vec<_>>();
    match args.as_slice() {
        [] => Ok(LedgerReplay::default()),
        [flag, fixture_name] if flag == "--fixture" && fixture_name == "two-session" => {
            Ok(two_session_fixture_report())
        }
        [flag, path] if flag == "--file" => report_from_file(path),
        [flag, _] if flag == "--fixture" => Err("unknown pool ledger fixture".to_string()),
        _ => {
            Err("usage: dbyte-pool-ledger-report [--fixture two-session] [--file path]".to_string())
        }
    }
}

fn report_from_file(path: &str) -> Result<LedgerReplay, String> {
    let source = fs::read_to_string(path).map_err(|error| format!("read report file: {error}"))?;
    report_from_text(&source)
}

fn report_from_text(source: &str) -> Result<LedgerReplay, String> {
    let mut pool = FakePoolHarness::new();
    let mut ledger = ShareLedger::new();
    let mut sessions = Vec::<SessionId>::new();
    let mut jobs = Vec::<JobId>::new();

    for (line_index, raw_line) in source.lines().enumerate() {
        let line_number = line_index + 1;
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        let fields = line.split(',').map(str::trim).collect::<Vec<_>>();
        match fields.as_slice() {
            ["session", wallet, worker, difficulty] => {
                let difficulty = parse_u64(difficulty, line_number, "difficulty")?;
                let session_id = pool
                    .register_session(*wallet, *worker, difficulty)
                    .map_err(|reason| {
                        format!("line {line_number}: session rejected: {reason:?}")
                    })?;
                sessions.push(session_id);
            }
            ["job", height, required_difficulty] => {
                let height = parse_u64(height, line_number, "height")?;
                let required_difficulty =
                    parse_u64(required_difficulty, line_number, "required_difficulty")?;
                let job_id = pool.create_job(height, required_difficulty, Hash32::zero());
                jobs.push(job_id);
            }
            ["assign", session_index, job_index] => {
                let session_id = lookup_session(&sessions, session_index, line_number)?;
                let job_id = lookup_job(&jobs, job_index, line_number)?;
                pool.assign_job(session_id, job_id)
                    .map_err(|reason| format!("line {line_number}: assign rejected: {reason:?}"))?;
            }
            ["submit", session_index, job_index, nonce, difficulty] => {
                let session_id = lookup_session(&sessions, session_index, line_number)?;
                let job_id = lookup_job(&jobs, job_index, line_number)?;
                let nonce = parse_u64(nonce, line_number, "nonce")?;
                let difficulty = parse_u64(difficulty, line_number, "difficulty")?;
                let submission = submit(session_id, job_id, nonce, difficulty);
                let result = pool.submit_share(submission.clone());
                ledger.append_result(&submission, &result);
            }
            _ => {
                return Err(format!(
                    "line {line_number}: expected session, job, assign, or submit record"
                ));
            }
        }
    }

    ledger
        .replay()
        .map_err(|error| format!("ledger replay failed: {error:?}"))
}

fn parse_u64(value: &str, line_number: usize, field: &str) -> Result<u64, String> {
    value
        .parse::<u64>()
        .map_err(|_| format!("line {line_number}: invalid {field}"))
}

fn lookup_session(
    sessions: &[SessionId],
    value: &str,
    line_number: usize,
) -> Result<SessionId, String> {
    let index = parse_index(value, line_number, "session_index")?;
    sessions
        .get(index)
        .copied()
        .ok_or_else(|| format!("line {line_number}: unknown session index {}", index + 1))
}

fn lookup_job(jobs: &[JobId], value: &str, line_number: usize) -> Result<JobId, String> {
    let index = parse_index(value, line_number, "job_index")?;
    jobs.get(index)
        .copied()
        .ok_or_else(|| format!("line {line_number}: unknown job index {}", index + 1))
}

fn parse_index(value: &str, line_number: usize, field: &str) -> Result<usize, String> {
    let index = parse_u64(value, line_number, field)?;
    let zero_based = index
        .checked_sub(1)
        .ok_or_else(|| format!("line {line_number}: {field} must start at 1"))?;
    usize::try_from(zero_based).map_err(|_| format!("line {line_number}: invalid {field}"))
}

fn two_session_fixture_report() -> LedgerReplay {
    let mut pool = FakePoolHarness::new();
    let mut ledger = ShareLedger::new();
    let second_session = pool
        .register_session("wallet-two", "worker-b", 10)
        .expect("valid fixture session");
    let first_session = pool
        .register_session("wallet-one", "worker-a", 10)
        .expect("valid fixture session");
    let job_id = pool.create_job(1_000, 10, Hash32::zero());
    pool.assign_job(first_session, job_id)
        .expect("valid fixture job assignment");
    pool.assign_job(second_session, job_id)
        .expect("valid fixture job assignment");

    let accepted_submit = submit(second_session, job_id, 7, 10);
    let accepted_result = pool.submit_share(accepted_submit.clone());
    assert!(matches!(accepted_result, ShareResult::Accepted(_)));
    ledger.append_result(&accepted_submit, &accepted_result);

    let rejected_submit = submit(first_session, job_id, 8, 1);
    let rejected_result = pool.submit_share(rejected_submit.clone());
    assert!(matches!(rejected_result, ShareResult::Rejected(_)));
    ledger.append_result(&rejected_submit, &rejected_result);

    ledger
        .replay()
        .expect("fixture ledger replay should be valid")
}

fn submit(
    session_id: dbyte_pool_core::SessionId,
    job_id: dbyte_pool_core::JobId,
    nonce: u64,
    difficulty: u64,
) -> ShareSubmit {
    ShareSubmit {
        session_id,
        job_id,
        nonce,
        share_difficulty: difficulty,
        result_hash: Hash32::zero(),
    }
}

fn ledger_replay_json(report: &LedgerReplay) -> String {
    let summary = report.summary();
    let mut session_ids = report.per_session.keys().copied().collect::<Vec<_>>();
    session_ids.sort_by_key(|session_id| session_id.raw());

    let mut out = String::new();
    out.push_str("{\n");
    out.push_str("  \"schema\": 1,\n");
    out.push_str("  \"status\": \"ok\",\n");
    out.push_str(&format!("  \"total_events\": {},\n", summary.total_events));
    out.push_str(&format!(
        "  \"accepted_events\": {},\n",
        summary.accepted_events
    ));
    out.push_str(&format!(
        "  \"rejected_events\": {},\n",
        summary.rejected_events
    ));
    out.push_str(&format!(
        "  \"credited_difficulty\": {},\n",
        summary.credited_difficulty
    ));
    out.push_str("  \"sessions\": [\n");

    for (index, session_id) in session_ids.iter().enumerate() {
        let session = report
            .per_session
            .get(session_id)
            .expect("session id came from replay map");
        out.push_str("    {\n");
        out.push_str(&format!("      \"session_id\": {},\n", session_id.raw()));
        out.push_str(&format!(
            "      \"accepted_shares\": {},\n",
            session.accepted_shares
        ));
        out.push_str(&format!(
            "      \"rejected_shares\": {},\n",
            session.rejected_shares
        ));
        out.push_str(&format!(
            "      \"credited_difficulty\": {}\n",
            session.credited_difficulty
        ));
        out.push_str("    }");
        if index + 1 != session_ids.len() {
            out.push(',');
        }
        out.push('\n');
    }

    out.push_str("  ]\n");
    out.push('}');
    out
}

#[cfg(test)]
fn ledger_error_json(error: &dbyte_pool_core::LedgerError) -> String {
    match error {
        dbyte_pool_core::LedgerError::SequenceGap { expected, actual } => format!(
            "{{\n  \"schema\": 1,\n  \"status\": \"blocked\",\n  \"reason\": \"sequence_gap\",\n  \"expected_sequence\": {},\n  \"actual_sequence\": {}\n}}",
            expected, actual
        ),
        dbyte_pool_core::LedgerError::DuplicateAcceptedShare { sequence, key } => format!(
            "{{\n  \"schema\": 1,\n  \"status\": \"blocked\",\n  \"reason\": \"duplicate_accepted_share\",\n  \"sequence\": {},\n  \"session_id\": {},\n  \"job_id\": {},\n  \"nonce\": {}\n}}",
            sequence,
            key.session_id.raw(),
            key.job_id.raw(),
            key.nonce
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use dbyte_pool_core::{LedgerEvent, LedgerOutcome};

    const BRIDGE_FIXTURE: &str = "\
# kind,wallet_or_session,worker_or_job,difficulty_or_nonce,optional_difficulty\n\
session,wallet-one,worker-a,10\n\
session,wallet-two,worker-b,10\n\
job,1000,10\n\
assign,1,1\n\
assign,2,1\n\
submit,2,1,7,10\n\
submit,1,1,8,1\n";

    #[test]
    fn ledger_report_json_is_stable_and_sorted() {
        let replay = two_session_fixture_report();
        let json = ledger_replay_json(&replay);

        assert_eq!(
            json,
            "{\n  \"schema\": 1,\n  \"status\": \"ok\",\n  \"total_events\": 2,\n  \"accepted_events\": 1,\n  \"rejected_events\": 1,\n  \"credited_difficulty\": 10,\n  \"sessions\": [\n    {\n      \"session_id\": 1,\n      \"accepted_shares\": 1,\n      \"rejected_shares\": 0,\n      \"credited_difficulty\": 10\n    },\n    {\n      \"session_id\": 2,\n      \"accepted_shares\": 0,\n      \"rejected_shares\": 1,\n      \"credited_difficulty\": 0\n    }\n  ]\n}"
        );
    }

    #[test]
    fn report_from_args_defaults_to_empty_report() {
        let replay = report_from_args([]).expect("default report should be valid");

        assert_eq!(replay.total_events, 0);
        assert_eq!(replay.accepted_events, 0);
        assert_eq!(replay.rejected_events, 0);
        assert_eq!(replay.credited_difficulty, 0);
    }

    #[test]
    fn report_from_args_loads_two_session_fixture() {
        let replay = report_from_args(["--fixture".to_string(), "two-session".to_string()])
            .expect("fixture report should be valid");

        assert_eq!(replay.total_events, 2);
        assert_eq!(replay.accepted_events, 1);
        assert_eq!(replay.rejected_events, 1);
        assert_eq!(replay.credited_difficulty, 10);
        assert_eq!(replay.per_session.len(), 2);
    }

    #[test]
    fn report_from_text_loads_bridge_fixture() {
        let replay = report_from_text(BRIDGE_FIXTURE).expect("bridge fixture should replay");

        assert_eq!(replay.total_events, 2);
        assert_eq!(replay.accepted_events, 1);
        assert_eq!(replay.rejected_events, 1);
        assert_eq!(replay.credited_difficulty, 10);
        assert_eq!(replay.per_session.len(), 2);
    }

    #[test]
    fn report_from_args_loads_bridge_file() {
        let path = env::temp_dir().join(format!(
            "dbyte-pool-file-report-{}.ledger",
            std::process::id()
        ));
        fs::write(&path, BRIDGE_FIXTURE).expect("write bridge fixture");

        let replay = report_from_args(["--file".to_string(), path.to_string_lossy().into_owned()])
            .expect("bridge file should replay");
        let _ = fs::remove_file(path);

        assert_eq!(replay.total_events, 2);
        assert_eq!(replay.accepted_events, 1);
        assert_eq!(replay.rejected_events, 1);
        assert_eq!(replay.credited_difficulty, 10);
        assert_eq!(replay.per_session.len(), 2);
    }

    #[test]
    fn report_from_text_rejects_unknown_session_index() {
        let error = report_from_text("job,1000,10\nsubmit,1,1,7,10\n")
            .expect_err("missing session should fail");

        assert_eq!(error, "line 2: unknown session index 1");
    }

    #[test]
    fn report_from_args_rejects_unknown_fixture() {
        let error = report_from_args(["--fixture".to_string(), "unknown".to_string()])
            .expect_err("unknown fixture should fail");

        assert_eq!(error, "unknown pool ledger fixture");
    }

    #[test]
    fn ledger_error_json_reports_sequence_gap() {
        let error = dbyte_pool_core::LedgerError::SequenceGap {
            expected: 1,
            actual: 3,
        };

        assert_eq!(
            ledger_error_json(&error),
            "{\n  \"schema\": 1,\n  \"status\": \"blocked\",\n  \"reason\": \"sequence_gap\",\n  \"expected_sequence\": 1,\n  \"actual_sequence\": 3\n}"
        );
    }

    #[test]
    fn ledger_error_json_reports_duplicate_accepted_share() {
        let mut pool = FakePoolHarness::new();
        let mut ledger = ShareLedger::new();
        let session_id = pool
            .register_session("wallet-one", "worker-a", 10)
            .expect("valid session");
        let job_id = pool.create_job(1_000, 10, Hash32::zero());
        let event = LedgerEvent {
            sequence: 1,
            session_id: Some(session_id),
            job_id: Some(job_id),
            nonce: Some(9),
            outcome: LedgerOutcome::Accepted {
                credited_difficulty: 10,
            },
        };
        ledger.append_event(event.clone());
        ledger.append_event(LedgerEvent {
            sequence: 2,
            ..event
        });
        let error = ledger
            .replay()
            .expect_err("duplicate share should fail replay");

        assert_eq!(
            ledger_error_json(&error),
            "{\n  \"schema\": 1,\n  \"status\": \"blocked\",\n  \"reason\": \"duplicate_accepted_share\",\n  \"sequence\": 2,\n  \"session_id\": 1,\n  \"job_id\": 1,\n  \"nonce\": 9\n}"
        );
    }

    #[test]
    fn report_binary_default_output_is_empty_ok_report() {
        let json = ledger_replay_json(&LedgerReplay::default());

        assert!(json.contains("\"status\": \"ok\""));
        assert!(json.contains("\"total_events\": 0"));
        assert!(json.contains("\"sessions\": ["));
    }
}
