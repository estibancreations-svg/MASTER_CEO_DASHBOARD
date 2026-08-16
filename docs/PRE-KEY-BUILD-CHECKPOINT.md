# Pre-key build checkpoint — 2026-08-15

## Completed

- Builder/authentication behavior is controlled by a deployment flag instead of a hard-coded constant.
- Passwordless sign-in is restricted to existing authorized accounts and includes submission/cooldown states.
- Recovery policy, run, drill and evidence structures are implemented.
- Guarded local encrypted backup and non-production restore scripts are present.
- Provider key installation instructions are complete.
- Physical-device sign-off instructions are complete.
- The 19-section enterprise build specification and schema reference are reconciled.
- Repository setup and operating documentation reflects the current builder release.

## External completion gates

- Provider credentials and provider-by-provider activation evidence.
- Authenticated role/session/write testing after builder mode is deliberately disabled.
- Operator-approved backup destination and non-production restore evidence.
- Physical-device sign-off.

No provider key or database credential is stored in this repository.
