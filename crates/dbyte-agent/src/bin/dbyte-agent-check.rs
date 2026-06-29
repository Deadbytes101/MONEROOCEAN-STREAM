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
    let actual_size = file_size(&file_path)?;

    let hash_match = actual_hash == expected_hash;
    let size_match = actual_size == expected_size;
    let release_report_match = optional_artifact_match(
        &raw,
        "agent_report",
        "agent_report_sha256",
        "agent_report_size_bytes",
    )?;
    let checker_report_match = optional_artifact_match(
        &raw,
        "agent_checker_report",
        "agent_checker_report_sha256",
        "agent_checker_report_size_bytes",
    )?;
    let artifact_match = release_report_match && checker_report_match;
    let valid = hash_match && size_match && artifact_match;
    let reason = approval_reason(hash_match, size_match, artifact_match);

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
    print!("{}", runtime_approval_output(valid, reason));

    Ok(valid)
}

fn string_field(raw: &str, key: &str) -> Result<String, String> {
    let value = raw_field(raw, key)?;
    parse_string(value).ok_or_else(|| format!("{key} must be a string"))
}

fn optional_string_field(raw: &str, key: &str) -> Result<Option<String>, String> {
    let Some(value) = optional_raw_field(raw, key)? else {
        return Ok(None);
    };

    parse_string(value)
        .map(Some)
        .ok_or_else(|| format!("{key} must be a string"))
}

fn u64_field(raw: &str, key: &str) -> Result<u64, String> {
    let value = raw_field(raw, key)?;
    parse_u64_field_value(value, key)
}

fn optional_u64_field(raw: &str, key: &str) -> Result<Option<u64>, String> {
    let Some(value) = optional_raw_field(raw, key)? else {
        return Ok(None);
    };

    parse_u64_field_value(value, key).map(Some)
}

fn parse_u64_field_value(value: &str, key: &str) -> Result<u64, String> {
    let digits: String = value.chars().take_while(|c| c.is_ascii_digit()).collect();

    if digits.is_empty() {
        return Err(format!("{key} must be an unsigned integer"));
    }

    digits
        .parse::<u64>()
        .map_err(|error| format!("{key}: {error}"))
}

fn raw_field<'a>(raw: &'a str, key: &str) -> Result<&'a str, String> {
    optional_raw_field(raw, key)?.ok_or_else(|| format!("missing field: {key}"))
}

fn optional_raw_field<'a>(raw: &'a str, key: &str) -> Result<Option<&'a str>, String> {
    let quoted = format!("\"{key}\"");
    let Some(start) = raw.find(&quoted) else {
        return Ok(None);
    };
    let after_key = &raw[start + quoted.len()..];
    let colon = after_key
        .find(':')
        .ok_or_else(|| format!("missing colon: {key}"))?;

    Ok(Some(after_key[colon + 1..].trim_start()))
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

fn file_size(path: &str) -> Result<u64, String> {
    fs::metadata(path)
        .map_err(|error| format!("failed to inspect {}: {error}", Path::new(path).display()))
        .map(|metadata| metadata.len())
}

fn optional_artifact_match(
    raw: &str,
    path_key: &str,
    hash_key: &str,
    size_key: &str,
) -> Result<bool, String> {
    let expected_hash = optional_string_field(raw, hash_key)?.map(|hash| hash.to_ascii_lowercase());
    let expected_size = optional_u64_field(raw, size_key)?;

    match (expected_hash, expected_size) {
        (None, None) => Ok(true),
        (Some(hash), Some(size)) => {
            if !is_sha256_hex(&hash) {
                return Err(format!("{hash_key} is invalid"));
            }

            let path = string_field(raw, path_key)?;
            let actual_hash = sha256_file(&path)?;
            let actual_size = file_size(&path)?;

            Ok(actual_hash == hash && actual_size == size)
        }
        _ => Err(format!(
            "{hash_key} and {size_key} must be provided together"
        )),
    }
}

fn approval_reason(hash_match: bool, size_match: bool, artifact_match: bool) -> &'static str {
    if !artifact_match {
        return "artifact_mismatch";
    }

    match (hash_match, size_match) {
        (true, true) => "manifest_verified",
        (false, true) => "hash_mismatch",
        (true, false) => "size_mismatch",
        (false, false) => "hash_and_size_mismatch",
    }
}

fn runtime_approval_output(approved: bool, reason: &str) -> String {
    format!("runtime.approved={approved}\nruntime.reason={reason}\n")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn approval_reason_accepts_verified_manifest() {
        assert_eq!(approval_reason(true, true, true), "manifest_verified");
    }

    #[test]
    fn approval_reason_rejects_hash_mismatch() {
        assert_eq!(approval_reason(false, true, true), "hash_mismatch");
    }

    #[test]
    fn approval_reason_rejects_size_mismatch() {
        assert_eq!(approval_reason(true, false, true), "size_mismatch");
    }

    #[test]
    fn approval_reason_rejects_hash_and_size_mismatch() {
        assert_eq!(
            approval_reason(false, false, true),
            "hash_and_size_mismatch"
        );
    }

    #[test]
    fn approval_reason_rejects_artifact_mismatch() {
        assert_eq!(approval_reason(true, true, false), "artifact_mismatch");
    }

    #[test]
    fn optional_artifact_match_skips_missing_integrity_fields() {
        let raw = r#"{"agent_report":"reports\\dbyte-agent-release.txt"}"#;

        assert!(
            optional_artifact_match(
                raw,
                "agent_report",
                "agent_report_sha256",
                "agent_report_size_bytes"
            )
            .unwrap()
        );
    }

    #[test]
    fn optional_artifact_match_rejects_partial_integrity_fields() {
        let raw = r#"{"agent_report":"reports\\dbyte-agent-release.txt","agent_report_sha256":"0000000000000000000000000000000000000000000000000000000000000000"}"#;
        let error = optional_artifact_match(
            raw,
            "agent_report",
            "agent_report_sha256",
            "agent_report_size_bytes",
        )
        .unwrap_err();

        assert_eq!(
            error,
            "agent_report_sha256 and agent_report_size_bytes must be provided together"
        );
    }

    #[test]
    fn optional_artifact_match_accepts_matching_file_integrity() {
        let path = temp_artifact_path("match");
        fs::write(&path, b"release-report").unwrap();

        let hash = sha256_file(&path).unwrap();
        let size = file_size(&path).unwrap();
        let raw = artifact_report_json(&path, &hash, size);

        assert!(
            optional_artifact_match(
                &raw,
                "agent_report",
                "agent_report_sha256",
                "agent_report_size_bytes",
            )
            .unwrap()
        );

        fs::remove_file(path).ok();
    }

    #[test]
    fn optional_artifact_match_rejects_mismatched_file_integrity() {
        let path = temp_artifact_path("mismatch");
        fs::write(&path, b"release-report").unwrap();

        let size = file_size(&path).unwrap();
        let wrong_hash = "0000000000000000000000000000000000000000000000000000000000000000";
        let raw = artifact_report_json(&path, wrong_hash, size);

        assert!(
            !optional_artifact_match(
                &raw,
                "agent_report",
                "agent_report_sha256",
                "agent_report_size_bytes",
            )
            .unwrap()
        );

        fs::remove_file(path).ok();
    }

    #[test]
    fn runtime_approval_output_is_stable_for_approved_runtime() {
        assert_eq!(
            runtime_approval_output(true, "manifest_verified"),
            "runtime.approved=true\nruntime.reason=manifest_verified\n"
        );
    }

    #[test]
    fn runtime_approval_output_is_stable_for_rejected_runtime() {
        assert_eq!(
            runtime_approval_output(false, "hash_mismatch"),
            "runtime.approved=false\nruntime.reason=hash_mismatch\n"
        );
    }

    fn temp_artifact_path(label: &str) -> String {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let mut path = std::env::temp_dir();
        path.push(format!(
            "dbyte-agent-check-{label}-{}-{stamp}.txt",
            std::process::id()
        ));

        path.to_string_lossy().into_owned()
    }

    fn artifact_report_json(path: &str, hash: &str, size: u64) -> String {
        format!(
            r#"{{"agent_report":"{}","agent_report_sha256":"{}","agent_report_size_bytes":{}}}"#,
            json_escape(path),
            hash,
            size
        )
    }

    fn json_escape(value: &str) -> String {
        value.replace('\\', "\\\\").replace('"', "\\\"")
    }
}
