# Contract: Advice API

## Endpoint: Generate Dual Advice

- **Method**: `POST`
- **Path**: `/api/advice/generate`
- **Auth**: Required
- **Request Body**:
  - `documentId` (string)
  - `scope` (`full` | `partial`)
  - `selectedText` (string, optional)
  - `panelA` (object: provider, preset)
  - `panelB` (object: provider, preset)
- **Response**:
  - `responseA` (text)
  - `responseB` (text)
  - `structureFeedback` (object)
  - `emotionalFeedback` (object)
  - `requestId` (string)

## Endpoint: List Available Models

- **Method**: `GET`
- **Path**: `/api/advice/models`
- **Auth**: Required
- **Response**: Enabled model descriptors for user selection

## Error Contract

- `400 Bad Request`: invalid panel config or missing context fields
- `401 Unauthorized`: missing or invalid auth
- `403 Forbidden`: document access denied
- `429 Too Many Requests`: advice rate limit reached
- `502 Provider Error`: upstream provider failure
- `500 Internal Error`: unexpected server failure with log correlation id
