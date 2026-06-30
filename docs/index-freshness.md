# Index Freshness

The dashboard treats `index_ts_unix` as the generation time for `reports\dbyte-agent-index.json`.

Freshness window:

```text
300 seconds
```

Healthy state:

```text
Index age: fresh
```

Stale state:

```text
Health: attention
Reason: index_stale_artifact
Next: refresh_index
Index age: stale_artifact
```

Simple rule: when the index is stale, regenerate local reports with the full gate before using the dashboard state.
