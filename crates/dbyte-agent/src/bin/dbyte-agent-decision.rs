use std::env;
use std::fmt::Write as _;
use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Default)]
struct Cli {
    ledger_path: Option<String>,
    out_path: Option<String>,
}

#[derive(Debug, Default, PartialEq, Eq)]
struct LedgerFacts {
    path: String,
    exists: bool,
    events: usize,
    valid_events: usize,
    invalid_events: usize,
    identity_reports: usize,
    machine_reports: usize,
    file_verifications: usize,
    file_verify_errors: usize,
    last_event: String,
    last_file_match: String,
    last_invalid_line: usize,
    last_invalid_reason: String,
}

#[derive(Debug, PartialEq, Eq)]
struct Decision {
    status: &'static str,
    reason: &'static str,
    next: &'static str,
}

fn main() {
    let cli = match Cli::parse(env::args().skip(1)) {
        Ok(cli) => cli,
        Err(error) => {
            eprintln!("{error}");
            print_help();
            std::process::exit(2);
        }
    };

    let Some(ledger_path) = cli.ledger_path.as_deref() else {
        eprintln!("config error: --ledger is required");
        print_help();
        std::process::exit(2);
    };

    let facts = match read_ledger_facts(ledger_path) {
        Ok(facts) => facts,
        Err(error) => {
            eprintln!("ledger error: {error}");
            std::process::exit(2);
        }
    };
    let json = decision_json(&facts);
    print!("{json}");

    if let Some(out_path) = cli.out_path.as_deref() {
        if let Err(error) = write_report(out_path, &json) {
            eprintln!("report error: {error}");
            std::process::exit(2);
        }
        println!("report.out={out_path}");
    }
}

impl Cli {
    fn parse<I>(args: I) -> Result<Self, String>
    where
        I: IntoIterator<Item = String>,
    {
        let mut args = args.into_iter();
        let mut ledger_path = None;
        let mut out_path = None;

        while let Some(arg) = args.next() {
            match arg.as_str() {
                "--ledger" => {
                    ledger_path = Some(
                        args.next()
                            .ok_or_else(|| "--ledger requires a path".to_string())?,
                    );
                }
                "--out" => {
                    out_path = Some(
                        args.next()
                            .ok_or_else(|| "--out requires a path".to_string())?,
                    );
                }
                "help" | "--help" | "-h" => {
                    print_help();
                    std::process::exit(0);
                }
                _ => return Err(format!("unexpected argument: {arg}")),
            }
        }

        Ok(Self {
            ledger_path,
            out_path,
        })
    }
}

fn print_help() {
    println!("dbyte-agent-decision {}", env!("CARGO_PKG_VERSION"));
    println!("usage:");
    println!("  dbyte-agent-decision --ledger <path> [--out <path>]");
    println!("description:");
    println!("  read a local event ledger and emit a read-only decision artifact");
}

fn read_ledger_facts(path: &str) -> Result<LedgerFacts, String> {
    let raw = match fs::read_to_string(path) {
        Ok(raw) => raw,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(LedgerFacts {
                path: path.to_string(),
                exists: false,
                last_event: "<none>".to_string(),
                last_file_match: "<unknown>".to_string(),
                last_invalid_reason: "<none>".to_string(),
                ..LedgerFacts::default()
            });
        }
        Err(error) => {
            return Err(format!(
                "failed to read {}: {error}",
                Path::new(path).display()
            ));
        }
    };

    let mut facts = LedgerFacts {
        path: path.to_string(),
        exists: true,
        last_event: "<none>".to_string(),
        last_file_match: "<unknown>".to_string(),
        last_invalid_reason: "<none>".to_string(),
        ..LedgerFacts::default()
    };

    for (index, line) in raw.lines().enumerate() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        facts.events += 1;
        match parse_event(line) {
            Ok(event) => {
                facts.valid_events += 1;
                facts.last_event = event.kind;
                match facts.last_event.as_str() {
                    "identity_reported" => facts.identity_reports += 1,
                    "machine_reported" => facts.machine_reports += 1,
                    "file_verified" => {
                        facts.file_verifications += 1;
                        if let Some(matched) = event.file_match {
                            facts.last_file_match = matched;
                        }
                    }
                    "file_verify_error" => facts.file_verify_errors += 1,
                    _ => {}
                }
            }
            Err(reason) => {
                facts.invalid_events += 1;
                facts.last_invalid_line = index + 1;
                facts.last_invalid_reason = reason;
            }
        }
    }

    Ok(facts)
}

#[derive(Debug, PartialEq, Eq)]
struct EventFacts {
    kind: String,
    file_match: Option<String>,
}

fn parse_event(line: &str) -> Result<EventFacts, String> {
    let ts_unix = require_field(line, "ts_unix")?;
    if ts_unix.parse::<u64>().is_err() {
        return Err("invalid_ts_unix".to_string());
    }

    let machine = require_field(line, "machine")?;
    if machine.trim().is_empty() {
        return Err("empty_machine".to_string());
    }

    let event = require_field(line, "event")?;
    match event {
        "identity_reported" | "machine_reported" => {
            if require_field(line, "status")? != "ok" {
                return Err(format!("invalid_{event}_status"));
            }
            Ok(EventFacts {
                kind: event.to_string(),
                file_match: None,
            })
        }
        "file_verified" => {
            require_field(line, "path")?;
            if !is_sha256_hex(require_field(line, "actual_sha256")?) {
                return Err("invalid_actual_sha256".to_string());
            }
            if !is_sha256_hex(require_field(line, "expected_sha256")?) {
                return Err("invalid_expected_sha256".to_string());
            }
            let matched = require_field(line, "match")?;
            if matched != "true" && matched != "false" {
                return Err("invalid_match_value".to_string());
            }
            Ok(EventFacts {
                kind: event.to_string(),
                file_match: Some(matched.to_string()),
            })
        }
        "file_verify_error" => {
            require_field(line, "reason")?;
            Ok(EventFacts {
                kind: event.to_string(),
                file_match: None,
            })
        }
        _ => Err(format!("unknown_event_{event}")),
    }
}

fn decide(facts: &LedgerFacts) -> Decision {
    if !facts.exists {
        return Decision {
            status: "attention",
            reason: "ledger_missing",
            next: "initialize_ledger",
        };
    }
    if facts.invalid_events > 0 {
        return Decision {
            status: "blocked",
            reason: "ledger_invalid_events",
            next: "inspect_ledger",
        };
    }
    if facts.file_verify_errors > 0 {
        return Decision {
            status: "attention",
            reason: "file_verify_errors",
            next: "inspect_file_manifest",
        };
    }
    if facts.last_file_match == "false" {
        return Decision {
            status: "blocked",
            reason: "file_mismatch",
            next: "verify_file",
        };
    }
    if facts.machine_reports == 0 {
        return Decision {
            status: "attention",
            reason: "missing_machine_report",
            next: "run_machine_report",
        };
    }

    Decision {
        status: "ok",
        reason: "ledger_clean",
        next: "observe",
    }
}

fn decision_json(facts: &LedgerFacts) -> String {
    decision_json_at(facts, current_unix())
}

fn decision_json_at(facts: &LedgerFacts, decision_ts_unix: u64) -> String {
    let decision = decide(facts);
    let mut output = String::from("{\n");
    let fields = [
        ("decision_schema", "1".to_string()),
        ("decision_ts_unix", decision_ts_unix.to_string()),
        ("decision_scope", "read_only".to_string()),
        ("decision_status", decision.status.to_string()),
        ("decision_reason", decision.reason.to_string()),
        ("decision_next", decision.next.to_string()),
        ("ledger_path", facts.path.clone()),
        ("ledger_exists", facts.exists.to_string()),
        ("ledger_events", facts.events.to_string()),
        ("ledger_valid_events", facts.valid_events.to_string()),
        ("ledger_invalid_events", facts.invalid_events.to_string()),
        (
            "ledger_identity_reports",
            facts.identity_reports.to_string(),
        ),
        ("ledger_machine_reports", facts.machine_reports.to_string()),
        (
            "ledger_file_verifications",
            facts.file_verifications.to_string(),
        ),
        (
            "ledger_file_verify_errors",
            facts.file_verify_errors.to_string(),
        ),
        ("ledger_last_event", facts.last_event.clone()),
        ("ledger_last_file_match", facts.last_file_match.clone()),
        (
            "ledger_last_invalid_line",
            facts.last_invalid_line.to_string(),
        ),
        (
            "ledger_last_invalid_reason",
            facts.last_invalid_reason.clone(),
        ),
    ];

    for (index, (key, value)) in fields.iter().enumerate() {
        let comma = if index + 1 == fields.len() { "" } else { "," };
        let _ = writeln!(output, "  \"{key}\": {}{comma}", json_value(value));
    }
    output.push_str("}\n");
    output
}

fn current_unix() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

fn json_value(value: &str) -> String {
    match value {
        "true" => "true".to_string(),
        "false" => "false".to_string(),
        _ => match value.parse::<u64>() {
            Ok(number) => number.to_string(),
            Err(_) => format!("\"{}\"", json_escape(value)),
        },
    }
}

fn json_escape(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
        .replace('\t', "\\t")
}

fn require_field<'a>(line: &'a str, key: &str) -> Result<&'a str, String> {
    extract_field(line, key).ok_or_else(|| format!("missing_{key}"))
}

fn extract_field<'a>(line: &'a str, key: &str) -> Option<&'a str> {
    let prefix = format!("{key}=");
    line.split_whitespace()
        .find_map(|part| part.strip_prefix(&prefix))
}

fn is_sha256_hex(value: &str) -> bool {
    value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn write_report(path: &str, report: &str) -> Result<(), String> {
    if let Some(parent) = Path::new(path).parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
    }

    fs::write(path, report)
        .map_err(|error| format!("failed to write {}: {error}", Path::new(path).display()))
}

#[cfg(test)]
mod tests {
    use super::*;

    const HASH: &str = "b592cc2cef79053a7490ba03d220bb2ff6bcd8fba496d956e377232c2652243e";

    #[test]
    fn clean_ledger_decision_is_ok() {
        let raw = format!(
            "ts_unix=1 machine=test event=identity_reported status=ok\nts_unix=2 machine=test event=machine_reported status=ok\nts_unix=3 machine=test event=file_verified path=configs/hash-fixture.txt actual_sha256={HASH} expected_sha256={HASH} match=true\n"
        );
        let path = write_temp_ledger(&raw);
        let facts = read_ledger_facts(&path).expect("facts should load");
        let _ = fs::remove_file(&path);

        assert_eq!(decide(&facts).status, "ok");
        assert_eq!(decide(&facts).reason, "ledger_clean");
        assert_eq!(facts.file_verifications, 1);
    }

    #[test]
    fn decision_json_includes_generation_timestamp() {
        let facts = LedgerFacts {
            path: "test.events".to_string(),
            exists: true,
            events: 3,
            valid_events: 3,
            identity_reports: 1,
            machine_reports: 1,
            file_verifications: 1,
            last_event: "file_verified".to_string(),
            last_file_match: "true".to_string(),
            last_invalid_reason: "<none>".to_string(),
            ..LedgerFacts::default()
        };

        let json = decision_json_at(&facts, 12345);

        assert!(json.contains("\"decision_ts_unix\": 12345"));
        assert!(json.contains("\"decision_status\": \"ok\""));
    }

    #[test]
    fn corrupt_ledger_blocks_decision() {
        let raw = format!(
            "ts_unix=1 machine=test event=identity_reported status=ok\nts_unix=2 machine=test event=file_verified path=configs/hash-fixture.txt actual_sha256=BAD expected_sha256={HASH} match=true\n"
        );
        let path = write_temp_ledger(&raw);
        let facts = read_ledger_facts(&path).expect("facts should load");
        let _ = fs::remove_file(&path);

        assert_eq!(decide(&facts).status, "blocked");
        assert_eq!(decide(&facts).reason, "ledger_invalid_events");
        assert_eq!(facts.invalid_events, 1);
    }

    #[test]
    fn missing_ledger_requests_initialization() {
        let path = env::temp_dir().join(format!(
            "dbyte-agent-missing-ledger-{}.events",
            temp_suffix()
        ));
        let facts = read_ledger_facts(&path.display().to_string()).expect("missing is valid facts");

        assert_eq!(decide(&facts).status, "attention");
        assert_eq!(decide(&facts).reason, "ledger_missing");
        assert!(!facts.exists);
    }

    fn write_temp_ledger(raw: &str) -> String {
        let path = env::temp_dir().join(format!("dbyte-agent-decision-{}.events", temp_suffix()));
        fs::write(&path, raw).expect("fixture should be written");
        path.display().to_string()
    }

    fn temp_suffix() -> u128 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be valid")
            .as_nanos()
    }
}
