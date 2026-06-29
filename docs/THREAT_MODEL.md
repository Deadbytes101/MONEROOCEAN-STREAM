# DBYTE-OCEAN Threat Model

DBYTE-OCEAN is for machines owned or explicitly administered by the operator.

## Allowed Scope

- Local machine supervision.
- Explicit runtime launching.
- Verified binary execution.
- Visible configuration.
- Local event logging.
- Backend comparison.
- Reproducible reports.
- Private systems research.

## Forbidden Scope

The project must not include:

- hidden execution
- unauthorized deployment
- credential theft
- address replacement
- persistence tricks
- hiding activity from a machine owner
- modifying systems without permission
- confusing generated configuration with user-owned configuration

## Security Principles

- Configuration must be explicit.
- Runtime actions must be logged.
- Binaries must be hash-checked.
- Backends must be replaceable.
- Reports must be reproducible.
- Admin actions must leave an audit trail.
- Network services must start closed and be opened deliberately.

## Stop Conditions

Stop if the operator cannot inspect the state.

Stop if a report cannot be reproduced.

Stop if a backend cannot be isolated behind an adapter.
