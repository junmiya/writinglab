# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

<!-- speckit:start:unreleased -->
### Added

- Initialized monorepo workspaces for `frontend` and `functions`
- Added TypeScript, ESLint, Prettier, Vitest tooling and CI check scripts
- Added foundational auth/session, document repository contracts, and security rules
- Added dual-advice provider boundary, structured logging, rate limiting, and redaction
- Added MVP UI components for editor, advice, structure, and diff/export flows
- Added contract, integration, and unit test coverage for MVP scope
- Added spec kit artifacts for `001-build-scenario-writing`
- Added frontend and functions local runtime wiring (`vite`, functions local HTTP server)
- Added functions document CRUD API implementation and frontend document create/save/load workflow
- Added functions advice model listing endpoint (`GET /api/advice/models`)
- Added frontend dynamic advice model loading from API with fallback behavior
- Added switchable functions document store backend (`memory` / `firestore`)
- Added GitHub Actions CI workflow (`.github/workflows/ci.yml`)
- Added Firebase deploy configuration with functions build/output entrypoint
<!-- speckit:end:unreleased -->
