use sha2::{Digest, Sha256};
use std::env;
use std::fmt::Write as _;
use std::fs;
use std::path::Path;

fn main() {
    let Some(path) = env::args().nth(1) else {
        eprintln!("usage: dbyte-agent-check <json-report>");
        std::process::exit(2);
    };

    match run(&path) {
        Ok(true) => std::process::exit(0),
        Ok(false) => std::process::exit(1),
        Err(error) => {
            eprintln!("check error: {error}");
            std::process::exit(2);
        }
    }
}

fn run(path: &str) -> Result<bool, String> {
    let raw = fs::read_to_string(path)
        .map_err(|error| format!("failed to read {}: {error}", Path::new(path).display()))?;

    let file_path = string_field(&raw, "agent_binary")?;
    let expected_hash = string_field(&raw, "agent_sha256")?.to_ascii_lowercase();
    let expected_size = u64_field(&raw, "agent_size_bytes")?;
    let commit = string_field(&raw, "agent_git_commit")?;

    if !is_sha256_hex(&expected_hash) {
        return Err("agent_sha256 is invalid".to_string());
    }

    if commit.trim().is_empty() {
        return Err("agent_git_commit is empty".to_string());
    }

    let actual_hash = sha256_file(&file_path)?;
    let actual_size = fs::metadata(&file_path)
        .map_err(|error| {
            format!(
                "failed to inspect {}: {error}",
                Path::new(&file_path).display()
            )
        })?
        .len();

    let hash_match = actual_hash == expected_hash;
    let size_match = actual_size == expected_size;
    let valid = hash_match && size_match;

    println!("check.path={path}");
    println!("agent.binary={file_path}");
    println!("agent.expected_sha256={expected_hash}");
    println!("agent.actual_sha256={actual_hash}");
    println!("agent.hash_match={hash_match}");
    println!("agent.expected_size_bytes={expected_size}");
    println!("agent.actual_size_bytes={actual_size}");
    println!("agent.size_match={size_match}");
    println!("agent.git_commit={commit}");
    println!("check.valid={valid}");

    Ok(valid)
}

fn string_field(raw: &str, key: &str) -> Result<String, String> {
    let value = raw_field(raw, key)?;
    parse_string(value).ok_or_else(|| format!("{key} must be a string"))
}

fn u64_field(raw: &str, key: &str) -> Result<u64, String> {
    let value = raw_field(raw, key)?;
    let digits: String = value.chars().take_while(|c| c.is_ascii_digit()).collect();

    if digits.is_empty() {
        return Err(format!("{key} must be an unsigned integer"));
    }

    digits
        .parse::<u64>()
        .map_err(|error| format!("{key}: {error}"))
}

fn raw_field<'a>(raw: &'a str, key: &str) -> Result<&'a str, String> {
    let quoted = format!("\"{key}\"");
    let start = raw
        .find(&quoted)
        .ok_or_else(|| format!("missing field: {key}"))?;
    let after_key = &raw[start + quoted.len()..];
    let colon = after_key
        .find(':')
        .ok_or_else(|| format!("missing colon: {key}"))?;

    Ok(after_key[colon + 1..].trim_start())
}

fn parse_string(input: &str) -> Option<String> {
    let mut chars = input.chars();

    if chars.next()? != '"' {
        return None;
    }

    let mut output = String::new();
    let mut escaped = false;

    for c in chars {
        if escaped {
            output.push(match c {
                '"' => '"',
                '\\' => '\\',
                'n' => '\n',
                'r' => '\r',
                't' => '\t',
                _ => return None,
            });
            escaped = false;
        } else if c == '\\' {
            escaped = true;
        } else if c == '"' {
            return Some(output);
        } else {
            output.push(c);
        }
    }

    None
}

fn is_sha256_hex(value: &str) -> bool {
    value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
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
