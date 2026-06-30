# Report Index Fields

`reports\dbyte-agent-index.json` is a read-only inventory of local DBYTE agent report files.

## Top-level fields

| Field | Meaning |
| --- | --- |
| `index_schema` | Report index schema version. |
| `index_scope` | Must be `read_only`. |
| `index_ts_unix` | Unix timestamp when the index was generated. |
| `index_status` | `ok` when all required reports are present, otherwise `attention`. |
| `report_count` | Number of report entries tracked by the index. |
| `missing_required_count` | Number of required report entries missing from disk. |
| `reports` | Array of report entries. |

## Report entry fields

| Field | Meaning |
| --- | --- |
| `name` | Stable report label for operator display. |
| `kind` | Report format, such as `json` or `text`. |
| `path` | Local report path relative to the repository root. |
| `required` | `true` means the full agent gate expects the file to exist. |
| `exists` | Whether the file was present when the index was generated. |
| `status` | `present` or `missing`. |
| `sha256` | SHA256 hash when present, otherwise `<missing>`. |
| `size_bytes` | File size in bytes when present, otherwise `0`. |

Simple rule: if `missing_required_count` is not `0`, the operator should regenerate reports with `npm run verify` before trusting dashboard status.
