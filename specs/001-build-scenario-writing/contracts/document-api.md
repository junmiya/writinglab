# Contract: Document API

## Endpoint: List Documents

- **Method**: `GET`
- **Path**: `/api/documents`
- **Auth**: Required
- **Response**: Array of document summaries owned by caller

## Endpoint: Create Document

- **Method**: `POST`
- **Path**: `/api/documents`
- **Auth**: Required
- **Request Body**:
  - `title` (string)
  - `authorName` (string)
  - `settings` (object)
- **Response**: Created document summary with `id`

## Endpoint: Get Document Detail

- **Method**: `GET`
- **Path**: `/api/documents/{documentId}`
- **Auth**: Required + owner check
- **Response**: Full document payload including characters and settings

## Endpoint: Update Document

- **Method**: `PATCH`
- **Path**: `/api/documents/{documentId}`
- **Auth**: Required + owner check
- **Request Body**: Partial update fields (`synopsis`, `content`, `settings`, metadata)
- **Response**: Updated document payload

## Endpoint: Export Document

- **Method**: `POST`
- **Path**: `/api/documents/{documentId}/export`
- **Auth**: Required + owner check
- **Response**: Download URL or binary payload metadata

## Error Contract

- `401 Unauthorized`: missing or invalid auth
- `403 Forbidden`: ownership mismatch
- `404 Not Found`: unknown document
- `409 Conflict`: stale update version
- `500 Internal Error`: unexpected server failure with log correlation id
