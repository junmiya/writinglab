# Release Rollback Runbook

## Scope

Use this runbook when a release introduces high-impact regressions in:
- Document persistence or data shape
- Advice provider routing
- Export behavior
- Access-control enforcement

## Pre-Release Guardrails

1. Keep schema changes additive whenever possible.
2. Version serialized document payloads before rollout.
3. Ensure release notes include rollback command set and owner.
4. Confirm last known-good artifact identifiers are recorded.

## Rollback Triggers

- Save failure rate exceeds 5% for 5 minutes.
- Advice generation failure rate exceeds 10% for 5 minutes.
- Export endpoint returns 5xx above 5% for 5 minutes.
- Unauthorized access incident or rule misconfiguration detected.

## Rollback Procedure

1. Declare rollback in incident channel and assign incident lead.
2. Freeze deployments and capture current logs with correlation IDs.
3. Revert hosting/functions to last known-good release artifacts.
4. Reapply last known-good Firestore rules if access regression is confirmed.
5. Disable newly introduced risky feature flags.
6. Validate critical smoke checks:
   - login + document read/write
   - advice generation A/B panels
   - export execution
7. Publish rollback completion note with impact window and next actions.

## Data Recovery Notes

- If data shape changed, run backward compatibility adapter before re-enabling writes.
- Preserve failed payload samples and migration logs for postmortem.

## Ownership

- Release Owner: Feature on-call engineer
- Approver: Maintainer with production deployment access
- Postmortem SLA: Within 2 business days
