# Scenario Writing Lab

MVP web app for screenplay drafting with vertical writing support, secure document storage,
and dual AI feedback workflows.

<!-- speckit:start:installation -->
## Installation

```bash
npm install
cp .env.example .env
cp frontend/.env.example frontend/.env
cp functions/.env.example functions/.env
```

Required runtime prerequisites:
- Node.js 20+
- Firebase project configuration for Auth/Firestore/Functions
- `frontend/.env` must point `VITE_FUNCTIONS_BASE_URL` to the local/prod Functions endpoint
<!-- speckit:end:installation -->

<!-- speckit:start:features -->
## Features

- Vertical screenplay editor with formatting helper actions
- Character table and structure guidance panels
- Dual AI advice with independent model selection and partial advice
- Document save/load with ownership boundaries
- Export workflow and revision diff support
<!-- speckit:end:features -->

<!-- speckit:start:usage -->
## Usage

```bash
npm run dev:functions
npm run dev:frontend
```

Run quality checks in a separate shell:

```bash
npm run ci:check
```

For feature-specific validation flow, see:
- `specs/001-build-scenario-writing/quickstart.md`
- `specs/001-build-scenario-writing/quickstart-validation.md`
<!-- speckit:end:usage -->
