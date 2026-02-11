# Environment Schema

This file defines required environment variables for local development and CI.

## Shared

- `NODE_ENV`: runtime mode (`development`, `test`, `production`)
- `LOG_LEVEL`: logging verbosity (`debug`, `info`, `warn`, `error`)

## Frontend (`frontend/.env`)

- `VITE_APP_ENV`: frontend environment name
- `VITE_FIREBASE_API_KEY`: Firebase Web API key
- `VITE_FIREBASE_AUTH_DOMAIN`: Firebase auth domain
- `VITE_FIREBASE_PROJECT_ID`: Firebase project id
- `VITE_FIREBASE_APP_ID`: Firebase app id
- `VITE_ENABLE_DEBUG_PANEL`: optional feature flag

## Functions (`functions/.env`)

- `DOCUMENTS_FIREBASE_PROJECT_ID`: Firebase project id for function runtime
- `FUNCTIONS_REGION`: Cloud Functions region (default `us-central1`)
- `DOCUMENT_STORE_BACKEND`: document repository backend (`memory` or `firestore`)
- `FIRESTORE_DOCUMENTS_COLLECTION`: optional collection name override (default `documents`)
- `OPENAI_API_KEY`: OpenAI provider key (server-side only)
- `GEMINI_API_KEY`: Google Gemini provider key (server-side only)
- `ANTHROPIC_API_KEY`: Anthropic provider key (server-side only)
- `ADVICE_TIMEOUT_MS`: outbound advice timeout budget in milliseconds

## Security Notes

- Provider keys MUST NOT be placed in frontend env files.
- Production values MUST be sourced from secure runtime configuration.
