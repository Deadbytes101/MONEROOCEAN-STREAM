use sha2::{Digest, Sha256};
use std::env;
use std::fmt::Write as _;
use std::fs;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Default)]
struct AgentConfig {
    machine_name: Option<String>,
    machine_note: Option<String>,
    file_path: Option<String>,
    file_expected_sha256: Option<String>,
    event_log_path: Option<String>,
}

#[derive(Debug, PartialEq, Eq)]
struct ParsedEvent {
    event: String,
    match_value: Option<String>,
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

    let config = match cli.config_path.as_deref() {
        Some(path) => match AgentConfig::load(path) {
            Ok(config) => config,
            Err(error) => {
                eprintln!("config error: {error}");
                std::process::exit(2);
            }
        },
        None => AgentConfig::default(),
    };

    let result = match cli.command.as_deref() {
        Some("identity") => {
            print_identity(&config);
            record_event(&config, "identity_reported", "status=ok");
            Ok(())
        }
        Some("machine") | Some("machine-report") => {
            print_machine_report(&config);
            record_event(&config, "machine_reported", "status=ok");
            Ok(())
        }
        Some("verify-file") => verify_file(&config),
        Some("report") => {
            report_ledger(&config, cli.ledger_path.as_deref(), cli.out_path.as_deref())
        }
        Some("report-json") => {
            report_ledger_json(&config, cli.ledger_path.as_deref(), cli.out_path.as_deref())
        }
        Some("check-ledger") => check_ledger(&config, cli.ledger_path.as_deref()),
        Some("help") | Some("--help") | Some("-h") | None => {
            print_help();
            Ok(())
        }
        Some(command) => {
            eprintln!("unknown command: {command}");
            print_help();
            Err(2)
        }
    };

    if let Err(code) = result {
        std::process::exit(code);
    }
}

#[derive(Debug)]
struct Cli {
    config_path: Option<String>,
    ledger_path: Option<String>,
    out_path: Option<String>,
    command: Option<String>,
}

impl Cli {
    fn parse<I>(args: I) -> Result<Self, String>
    where
        I: IntoIterator<Item = String>,
    {
        let mut args = args.into_iter();
        let mut config_path = None;
        let mut ledger_path = None;
        let mut out_path = None;
        let mut command = None;

        while let Some(arg) = args.next() {
            match arg.as_str() {
                "--config" => {
                    let path = args
                        .next()
                        .ok_or_else(|| "--config requires a path".to_string())?;
                    config_path = Some(path);
                }
                "--ledger" => {
                    let path = args
                        .next()
                        .ok_or_else(|| "--ledger requires a path".to_string())?;
                    ledger_path = Some(path);
                }
                "--out" => {
                    let path = args
                        .next()
                        .ok_or_else(|| "--out requires a path".to_string())?;
                    out_path = Some(path);
                }
                _ if command.is_none() => command = Some(arg),
                _ => return Err(format!("unexpected argument: {arg}")),
            }
        }

        Ok(Self {
            config_path,
            ledger_path,
            out_path,
            command,
        })
    }
}

impl AgentConfig {
    fn load(path: &str) -> Result<Self, String> {
        let raw = fs::read_to_string(path)
            .map_err(|error| format!("failed to read {}: {error}", Path::new(path).display()))?;

        let mut config = AgentConfig::default();
        let mut section = String::new();

        for (index, line) in raw.lines().enumerate() {
            let line_number = index + 1;
            let line = line.trim();

            if line.is_empty() || line.starts_with('#') {
                continue;
            }

            if line.starts_with('[') && line.ends_with(']') {
                section = line[1..line.len() - 1].trim().to_string();
                continue;
            }

            let Some((key, value)) = line.split_once('=') else {
                return Err(format!("line {line_number}: expected key = value"));
            };

            let key = key.trim();
            let value = parse_quoted_value(value.trim())
                .ok_or_else(|| format!("line {line_number}: expected quoted string value"))?;

            match (section.as_str(), key) {
                ("machine", "name") => config.machine_name = Some(value),
                ("machine", "note") => config.machine_note = Some(value),
                ("file_manifest", "path") => config.file_path = Some(value),
                ("file_manifest", "expected_sha256") => config.file_expected_sha256 = Some(value),
                ("event_log", "path") => config.event_log_path = Some(value),
                _ => return Err(format!("line {line_number}: unknown key {section}.{key}")),
            }
        }

        if config
            .machine_name
            .as_deref()
            .map(str::trim)
            .unwrap_or_default()
            .is_empty()
        {
            return Err("machine.name must not be empty".to_string());
        }

        Ok(config)
    }
}

fn parse_quoted_value(input: &str) -> Option<String> {
    let input = input.trim();
    input
        .strip_prefix('"')
        .and_then(|rest| rest.strip_suffix('"'))
        .map(ToString::to_string)
}

fn print_help() {
    println!("dbyte-agent {}", env!("CARGO_PKG_VERSION"));
    println!("usage:");
    println!("  dbyte-agent [--config <path>] [--ledger <path>] [--out <path>] <command>");
    println!("commands:");
    println!("  identity        print local machine identity report");
    println!("  machine         print local machine runtime report");
    println!("  machine-report  alias for machine");
    println!("  verify-file     hash configured file and compare manifest");
    println!("  report          read local event ledger and summarize truth");
    println!("  report-json     read local event ledger and emit JSON truth");
    println!("  check-ledger    parse local event ledger and reject corrupt records");
}

fn print_identity(config: &AgentConfig) {
    let cwd = env::current_dir()
        .map(|path| path.display().to_string())
        .unwrap_or_else(|_| "<unknown>".to_string());

    println!("agent.version={}", env!("CARGO_PKG_VERSION"));
    println!(
        "machine.name={}",
        config.machine_name.as_deref().unwrap_or("<unset>")
    );

    if let Some(note) = config.machine_note.as_deref() {
        println!("machine.note={note}");
    }

    println!("os={}", env::consts::OS);
    println!("arch={}", env::consts::ARCH);
    println!("cwd={cwd}");
}

fn print_machine_report(config: &AgentConfig) {
    print!("{}", build_machine_report(config));
}

fn build_machine_report(config: &AgentConfig) -> String {
    let cwd = env::current_dir()
        .map(|path| path.display().to_string())
        .unwrap_or_else(|_| "<unknown>".to_string());
    let exe = env::current_exe()
        .map(|path| path.display().to_string())
        .unwrap_or_else(|_| "<unknown>".to_string());
    let parallelism = std::thread::available_parallelism()
        .map(|value| value.get())
        .unwrap_or(0);
    let machine_name = config.machine_name.as_deref().unwrap_or("<unset>");
    let machine_note = config.machine_note.as_deref().unwrap_or("<none>");
    let event_log_path = config.event_log_path.as_deref().unwrap_or("<unset>");
    let file_manifest_path = config.file_path.as_deref().unwrap_or("<unset>");
    let file_manifest_expected_sha256 = config
        .file_expected_sha256
        .as_deref()
        .map(|value| if value.trim().is_empty() { "false" } else { "true" })
        .unwrap_or("false");

    format!(
        "agent.version={}\nmachine.name={}\nmachine.note={}\nos={}\narch={}\nparallelism.available={}\ncwd={}\nexe.path={}\nconfig.event_log_path={}\nconfig.file_manifest_path={}\nconfig.file_manifest_expected_sha256={}\n",
        env!("CARGO_PKG_VERSION"),
        machine_name,
        machine_note,
        env::consts::OS,
        env::consts::ARCH,
        parallelism,
        cwd,
        exe,
        event_log_path,
        file_manifest_path,
        file_manifest_expected_sha256
    )
}

fn verify_file(config: &AgentConfig) -> Result<(), i32> {
    let Some(path) = config.file_path.as_deref() else {
        eprintln!("config error: file_manifest.path is required");
        record_event(config, "file_verify_error", "reason=missing_path");
        return Err(2);
    };

    let Some(expected) = config.file_expected_sha256.as_deref() else {
        eprintln!("config error: file_manifest.expected_sha256 is required");
        record_event(
            config,
            "file_verify_error",
            "reason=missing_expected_sha256",
        );
        return Err(2);
    };

    let actual = match sha256_file(path) {
        Ok(actual) => actual,
        Err(error) => {
            eprintln!("file error: {error}");
            record_event(config, "file_verify_error", "reason=file_read_failed");
            return Err(2);
        }
    };

    let expected = expected.trim().to_ascii_lowercase();
    let matched = actual == expected;

    println!("file.path={path}");
    println!("file.sha256={actual}");
    println!("manifest.expected_sha256={expected}");
    println!("manifest.match={matched}");

    let detail = format!(
        "path={} actual_sha256={} expected_sha256={} match={}",
        escape_event_value(path),
        actual,
        expected,
        matched
    );
    record_event(config, "file_verified", &detail);

    if matched { Ok(()) } else { Err(1) }
}

fn report_ledger(
    config: &AgentConfig,
    ledger_override: Option<&str>,
    out_path: Option<&str>,
) -> Result<(), i32> {
    let path = resolve_ledger_path(config, ledger_override)?;
    let report = match build_ledger_report(path) {
        Ok(report) => report,
        Err(error) => {
            eprintln!("ledger error: {error}");
            return Err(2);
        }
    };

    print!("{report}");

    if let Some(out_path) = out_path {
        if let Err(error) = write_report(out_path, &report) {
            eprintln!("report error: {error}");
            return Err(2);
        }
        println!("report.out={out_path}");
    }

    Ok(())
}

fn report_ledger_json(
    config: &AgentConfig,
    ledger_override: Option<&str>,
    out_path: Option<&str>,
) -> Result<(), i32> {
    let path = resolve_ledger_path(config, ledger_override)?;
    let report = match build_ledger_report(path) {
        Ok(report) => report,
        Err(error) => {
            eprintln!("ledger error: {error}");
            return Err(2);
        }
    };

    let json = report_to_json(&report);
    print!("{json}");

    if let Some(out_path) = out_path {
        if let Err(error) = write_report(out_path, &json) {
            eprintln!("report error: {error}");
            return Err(2);
        }
        println!("report.out={out_path}");
    }

    Ok(())
}

fn check_ledger(config: &AgentConfig, ledger_override: Option<&str>) -> Result<(), i32> {
    let path = resolve_ledger_path(config, ledger_override)?;
    let report = match build_ledger_report(path) {
        Ok(report) => report,
        Err(error) => {
            eprintln!("ledger error: {error}");
            return Err(2);
        }
    };

    print!("{report}");

    let invalid_events = report_field(&report, "ledger.invalid_events")
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or(0);

    if invalid_events == 0 { Ok(()) } else { Err(1) }
}

fn resolve_ledger_path<'a>(
    config: &'a AgentConfig,
    ledger_override: Option<&'a str>,
) -> Result<&'a str, i32> {
    if let Some(path) = ledger_override {
        return Ok(path);
    }

    let Some(path) = config.event_log_path.as_deref() else {
        eprintln!("config error: event_log.path is required");
        return Err(2);
    };

    Ok(path)
}

fn build_ledger_report(path: &str) -> Result<String, String> {
    let raw = match fs::read_to_string(path) {
        Ok(raw) => raw,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(format!(
                "ledger.path={path}\nledger.exists=false\nledger.events=0\nledger.valid_events=0\nledger.invalid_events=0\nledger.identity_reports=0\nledger.machine_reports=0\nledger.file_verifications=0\nledger.file_verify_errors=0\nledger.last_event=<none>\nledger.last_file_match=<unknown>\nledger.last_invalid_line=0\nledger.last_invalid_reason=<none>\n"
            ));
        }
        Err(error) => {
            return Err(format!(
                "failed to read {}: {error}",
                Path::new(path).display()
            ));
        }
    };

    let mut total_events = 0usize;
    let mut valid_events = 0usize;
    let mut invalid_events = 0usize;
    let mut identity_reports = 0usize;
    let mut machine_reports = 0usize;
    let mut file_verifications = 0usize;
    let mut verify_errors = 0usize;
    let mut last_event = String::from("<none>");
    let mut last_file_match = String::from("<unknown>");
    let mut last_invalid_line = 0usize;
    let mut last_invalid_reason = String::from("<none>");

    for (index, line) in raw.lines().enumerate() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        total_events += 1;

        match parse_event_line(line) {
            Ok(parsed) => {
                valid_events += 1;
                last_event = parsed.event;

                match last_event.as_str() {
                    "identity_reported" => identity_reports += 1,
                    "machine_reported" => machine_reports += 1,
                    "file_verified" => {
                        file_verifications += 1;
                        if let Some(value) = parsed.match_value {
                            last_file_match = value;
                        }
                    }
                    "file_verify_error" => verify_errors += 1,
                    _ => {}
                }
            }
            Err(reason) => {
                invalid_events += 1;
                last_invalid_line = index + 1;
                last_invalid_reason = reason;
            }
        }
    }

    Ok(format!(
        "ledger.path={path}\nledger.exists=true\nledger.events={total_events}\nledger.valid_events={valid_events}\nledger.invalid_events={invalid_events}\nledger.identity_reports={identity_reports}\nledger.machine_reports={machine_reports}\nledger.file_verifications={file_verifications}\nledger.file_verify_errors={verify_errors}\nledger.last_event={last_event}\nledger.last_file_match={last_file_match}\nledger.last_invalid_line={last_invalid_line}\nledger.last_invalid_reason={last_invalid_reason}\n"
    ))
}

fn parse_event_line(line: &str) -> Result<ParsedEvent, String> {
    let ts_unix = require_field(line, "ts_unix")?;
    if ts_unix.parse::<u64>().is_err() {
        return Err("invalid_ts_unix".to_string());
    }

    let machine = require_field(line, "machine")?;
    if machine.trim().is_empty() {
        return Err("empty_machine".to_string());
    }

    let event = require_field(line, "event")?;
    if event.trim().is_empty() {
        return Err("empty_event".to_string());
    }

    match event {
        "identity_reported" => {
            let status = require_field(line, "status")?;
            if status != "ok" {
                return Err("invalid_identity_status".to_string());
            }
            Ok(ParsedEvent {
                event: event.to_string(),
                match_value: None,
            })
        }
        "machine_reported" => {
            let status = require_field(line, "status")?;
            if status != "ok" {
                return Err("invalid_machine_status".to_string());
            }
            Ok(ParsedEvent {
                event: event.to_string(),
                match_value: None,
            })
        }
        "file_verified" => {
            require_field(line, "path")?;
            let actual = require_field(line, "actual_sha256")?;
            let expected = require_field(line, "expected_sha256")?;
            let matched = require_field(line, "match")?;

            if !is_sha256_hex(actual) {
                return Err("invalid_actual_sha256".to_string());
            }
            if !is_sha256_hex(expected) {
                return Err("invalid_expected_sha256".to_string());
            }
            if matched != "true" && matched != "false" {
                return Err("invalid_match_value".to_string());
            }

            Ok(ParsedEvent {
                event: event.to_string(),
                match_value: Some(matched.to_string()),
            })
        }
        "file_verify_error" => {
            require_field(line, "reason")?;
            Ok(ParsedEvent {
                event: event.to_string(),
                match_value: None,
            })
        }
        _ => Err(format!("unknown_event_{event}")),
    }
}

fn require_field<'a>(line: &'a str, key: &str) -> Result<&'a str, String> {
    extract_field(line, key).ok_or_else(|| format!("missing_{key}"))
}

fn is_sha256_hex(value: &str) -> bool {
    value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn report_to_json(report: &str) -> String {
    let mut output = String::from("{\n");
    let fields: Vec<(&str, &str)> = report
        .lines()
        .filter_map(|line| line.split_once('='))
        .collect();

    for (index, (key, value)) in fields.iter().enumerate() {
        let comma = if index + 1 == fields.len() { "" } else { "," };
        let json_key = json_escape(&key.replace('.', "_"));
        let json_value = json_value(value);
        let _ = writeln!(output, "  \"{json_key}\": {json_value}{comma}");
    }

    output.push_str("}\n");
    output
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

fn write_report(path: &str, report: &str) -> Result<(), String> {
    if let Some(parent) = Path::new(path).parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
    }

    fs::write(path, report)
        .map_err(|error| format!("failed to write {}: {error}", Path::new(path).display()))
}

fn report_field<'a>(report: &'a str, key: &str) -> Option<&'a str> {
    let prefix = format!("{key}=");
    report.lines().find_map(|line| line.strip_prefix(&prefix))
}

fn extract_field<'a>(line: &'a str, key: &str) -> Option<&'a str> {
    let prefix = format!("{key}=");
    line.split_whitespace()
        .find_map(|part| part.strip_prefix(&prefix))
}

fn sha256_file(path: &str) -> Result<String, String> {
    let bytes = fs::read(path)
        .map_err(|error| format!("failed to read {}: {error}", Path::new(path).display()))?;
    let digest = Sha256::digest(&bytes);

    let mut output = String::with_capacity(64);
    for byte in digest {
        write!(&mut output, "{byte:02x}").expect("writing to String cannot fail");
    }

    Ok(output)
}

fn record_event(config: &AgentConfig, event: &str, detail: &str) {
    let Some(path) = config.event_log_path.as_deref() else {
        return;
    };

    if let Some(parent) = Path::new(path).parent() {
        if let Err(error) = fs::create_dir_all(parent) {
            eprintln!(
                "event log error: failed to create {}: {error}",
                parent.display()
            );
            return;
        }
    }

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0);

    let machine = config.machine_name.as_deref().unwrap_or("<unset>");
    let line = format!(
        "ts_unix={} machine={} event={} {}\n",
        timestamp,
        escape_event_value(machine),
        escape_event_value(event),
        detail
    );

    match OpenOptions::new().create(true).append(true).open(path) {
        Ok(mut file) => {
            if let Err(error) = file.write_all(line.as_bytes()) {
                eprintln!(
                    "event log error: failed to write {}: {error}",
                    Path::new(path).display()
                );
            }
        }
        Err(error) => {
            eprintln!(
                "event log error: failed to open {}: {error}",
                Path::new(path).display()
            );
        }
    }
}

fn escape_event_value(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
        .replace(' ', "_")
}

#[cfg(test)]
mod tests {
    use super::*;

    const HASH: &str = "b592cc2cef79053a7490ba03d220bb2ff6bcd8fba496d956e377232c2652243e";

    #[test]
    fn parses_identity_event() {
        let event = parse_event_line("ts_unix=1 machine=test event=identity_reported status=ok")
            .expect("identity event should parse");

        assert_eq!(event.event, "identity_reported");
        assert_eq!(event.match_value, None);
    }

    #[test]
    fn parses_machine_reported_event() {
        let event = parse_event_line("ts_unix=1 machine=test event=machine_reported status=ok")
            .expect("machine event should parse");

        assert_eq!(event.event, "machine_reported");
        assert_eq!(event.match_value, None);
    }

    #[test]
    fn machine_report_contains_local_runtime_fields() {
        let config = AgentConfig {
            machine_name: Some("rig-one".to_string()),
            machine_note: Some("lab".to_string()),
            file_path: Some("target.bin".to_string()),
            file_expected_sha256: Some(HASH.to_string()),
            event_log_path: Some("runtime/events.log".to_string()),
        };

        let report = build_machine_report(&config);

        assert_eq!(report_field(&report, "machine.name"), Some("rig-one"));
        assert_eq!(report_field(&report, "machine.note"), Some("lab"));
        assert_eq!(report_field(&report, "os"), Some(env::consts::OS));
        assert_eq!(report_field(&report, "arch"), Some(env::consts::ARCH));
        assert_eq!(
            report_field(&report, "config.event_log_path"),
            Some("runtime/events.log")
        );
        assert_eq!(
            report_field(&report, "config.file_manifest_expected_sha256"),
            Some("true")
        );
        assert!(report_field(&report, "parallelism.available").is_some());
        assert!(report_field(&report, "cwd").is_some());
        assert!(report_field(&report, "exe.path").is_some());
    }

    #[test]
    fn parses_file_verified_event() {
        let line = format!(
            "ts_unix=2 machine=test event=file_verified path=configs/hash-fixture.txt actual_sha256={HASH} expected_sha256={HASH} match=true"
        );
        let event = parse_event_line(&line).expect("file_verified event should parse");

        assert_eq!(event.event, "file_verified");
        assert_eq!(event.match_value.as_deref(), Some("true"));
    }

    #[test]
    fn rejects_corrupt_sha() {
        let line = format!(
            "ts_unix=2 machine=test event=file_verified path=configs/hash-fixture.txt actual_sha256=BAD expected_sha256={HASH} match=true"
        );

        assert_eq!(
            parse_event_line(&line),
            Err("invalid_actual_sha256".to_string())
        );
    }

    #[test]
    fn counts_invalid_records() {
        let raw = format!(
            "ts_unix=1 machine=test event=identity_reported status=ok\nts_unix=2 machine=test event=file_verified path=configs/hash-fixture.txt actual_sha256=BAD expected_sha256={HASH} match=true\n"
        );
        let path = env::temp_dir().join(format!(
            "dbyte-agent-corrupt-ledger-{}.events",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system time should be valid")
                .as_nanos()
        ));

        fs::write(&path, raw).expect("fixture should be written");
        let report = build_ledger_report(&path.display().to_string()).expect("report should build");
        let _ = fs::remove_file(&path);

        assert_eq!(report_field(&report, "ledger.events"), Some("2"));
        assert_eq!(report_field(&report, "ledger.valid_events"), Some("1"));
        assert_eq!(report_field(&report, "ledger.invalid_events"), Some("1"));
        assert_eq!(report_field(&report, "ledger.last_invalid_line"), Some("2"));
        assert_eq!(
            report_field(&report, "ledger.last_invalid_reason"),
            Some("invalid_actual_sha256")
        );
    }

    #[test]
    fn counts_machine_report_events() {
        let raw = format!(
            "ts_unix=1 machine=test event=identity_reported status=ok\nts_unix=2 machine=test event=machine_reported status=ok\nts_unix=3 machine=test event=file_verified path=configs/hash-fixture.txt actual_sha256={HASH} expected_sha256={HASH} match=true\n"
        );
        let path = env::temp_dir().join(format!(
            "dbyte-agent-machine-ledger-{}.events",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system time should be valid")
                .as_nanos()
        ));

        fs::write(&path, raw).expect("fixture should be written");
        let report = build_ledger_report(&path.display().to_string()).expect("report should build");
        let _ = fs::remove_file(&path);

        assert_eq!(report_field(&report, "ledger.events"), Some("3"));
        assert_eq!(report_field(&report, "ledger.valid_events"), Some("3"));
        assert_eq!(report_field(&report, "ledger.machine_reports"), Some("1"));
        assert_eq!(report_field(&report, "ledger.last_event"), Some("file_verified"));
    }
}
