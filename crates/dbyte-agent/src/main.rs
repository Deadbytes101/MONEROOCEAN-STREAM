use sha2::{Digest, Sha256};
use std::env;
use std::fmt::Write as _;
use std::fs;
use std::path::Path;

#[derive(Debug, Default)]
struct AgentConfig {
    machine_name: Option<String>,
    machine_note: Option<String>,
    file_path: Option<String>,
    file_expected_sha256: Option<String>,
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
            Ok(())
        }
        Some("verify-file") => verify_file(&config),
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
    command: Option<String>,
}

impl Cli {
    fn parse<I>(args: I) -> Result<Self, String>
    where
        I: IntoIterator<Item = String>,
    {
        let mut args = args.into_iter();
        let mut config_path = None;
        let mut command = None;

        while let Some(arg) = args.next() {
            match arg.as_str() {
                "--config" => {
                    let path = args
                        .next()
                        .ok_or_else(|| "--config requires a path".to_string())?;
                    config_path = Some(path);
                }
                _ if command.is_none() => command = Some(arg),
                _ => return Err(format!("unexpected argument: {arg}")),
            }
        }

        Ok(Self { config_path, command })
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
    println!("  dbyte-agent [--config <path>] <command>");
    println!("commands:");
    println!("  identity      print local machine identity report");
    println!("  verify-file   hash configured file and compare manifest");
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
        return Err(2);
    };

    let Some(expected) = config.file_expected_sha256.as_deref() else {
        eprintln!("config error: file_manifest.expected_sha256 is required");
        return Err(2);
    };

    let actual = match sha256_file(path) {
        Ok(actual) => actual,
        Err(error) => {
            eprintln!("file error: {error}");
            return Err(2);
        }
    };

    let expected = expected.trim().to_ascii_lowercase();
    let matched = actual == expected;

    println!("file.path={path}");
    println!("file.sha256={actual}");
    println!("manifest.expected_sha256={expected}");
    println!("manifest.match={matched}");

    if matched {
        Ok(())
    } else {
        Err(1)
    }
}

fn sha256_file(path: &str) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|error| format!("failed to read {}: {error}", Path::new(path).display()))?;
    let digest = Sha256::digest(&bytes);

    let mut output = String::with_capacity(64);
    for byte in digest {
        write!(&mut output, "{byte:02x}").expect("writing to String cannot fail");
    }

    Ok(output)
}
