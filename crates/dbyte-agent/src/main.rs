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
        Some("verify-file") => verify_file(&config),
        Some("report") => report_ledger(&config, cli.out_path.as_deref()),
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
    println!("  dbyte-agent [--config <path>] [--out <path>] <command>");
    println!("commands:");
    println!("  identity      print local machine identity report");
    println!("  verify-file   hash configured file and compare manifest");
    println!("  report        read local event ledger and summarize truth");
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

fn verify_file(config: &AgentConfig) -> Result<(), i32> {
    let Some(path) = config.file_path.as_deref() else {
        eprintln!("config error: file_manifest.path is required");
        record_event(config, "file_verify_error", "reason=missing_path");
        return Err(2);
    };

    let Some(expected) = config.file_expected_sha256.as_deref() else {
        eprintln!("config error: file_manifest.expected_sha256 is required");
        record_event(config, "file_verify_error", "reason=missing_expected_sha256");
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

    if matched {
        Ok(())
    } else {
        Err(1)
    }
}

fn report_ledger(config: &AgentConfig, out_path: Option<&str>) -> Result<(), i32> {
    let Some(path) = config.event_log_path.as_deref() else {
        eprintln!("config error: event_log.path is required");
        return Err(2);
    };

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

fn build_ledger_report(path: &str) -> Result<String, String> {
    let raw = match fs::read_to_string(path) {
        Ok(raw) => raw,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(format!(
                "ledger.path={path}\nledger.exists=false\nledger.events=0\n"
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
    let mut identity_reports = 0usize;
    let mut file_verifications = 0usize;
    let mut verify_errors = 0usize;
    let mut last_event = String::from("<none>");
    let mut last_file_match = String::from("<unknown>");

    for line in raw.lines().map(str::trim).filter(|line| !line.is_empty()) {
        total_events += 1;
        last_event = extract_field(line, "event").unwrap_or("<unknown>").to_string();

        match last_event.as_str() {
            "identity_reported" => identity_reports += 1,
            "file_verified" => {
                file_verifications += 1;
                if let Some(value) = extract_field(line, "match") {
                    last_file_match = value.to_string();
                }
            }
            "file_verify_error" => verify_errors += 1,
            _ => {}
        }
    }

    Ok(format!(
        "ledger.path={path}\nledger.exists=true\nledger.events={total_events}\nledger.identity_reports={identity_reports}\nledger.file_verifications={file_verifications}\nledger.file_verify_errors={verify_errors}\nledger.last_event={last_event}\nledger.last_file_match={last_file_match}\n"
    ))
}

fn write_report(path: &str, report: &str) -> Result<(), String> {
    if let Some(parent) = Path::new(path).parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
    }

    fs::write(path, report)
        .map_err(|error| format!("failed to write {}: {error}", Path::new(path).display()))
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
            eprintln!("event log error: failed to create {}: {error}", parent.display());
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
                eprintln!("event log error: failed to write {}: {error}", Path::new(path).display());
            }
        }
        Err(error) => {
            eprintln!("event log error: failed to open {}: {error}", Path::new(path).display());
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
