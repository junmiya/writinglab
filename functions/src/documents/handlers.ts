import { buildLogContext, logDocumentLoad, logDocumentSave } from '../common/logging';
import {
  getDocumentStore,
  type CharacterProfile,
  type DocumentSettings,
  type ScriptDocumentPatch,
} from './repository';

interface ApiResult {
  statusCode: number;
  body: unknown;
}

const documentStore = getDocumentStore();

class DocumentApiError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string) {
    super(code);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asRecord(value: unknown, code: string): Record<string, unknown> {
  if (!isObject(value)) {
    throw new DocumentApiError(400, code);
  }

  return value;
}

function asOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new DocumentApiError(400, `INVALID_${field.toUpperCase()}`);
  }

  return value;
}

function parseSettings(value: unknown): DocumentSettings {
  const record = asRecord(value, 'INVALID_SETTINGS');
  const lineLength = record.lineLength;
  const pageCount = record.pageCount;

  if (typeof lineLength !== 'number' || !Number.isInteger(lineLength) || lineLength <= 0) {
    throw new DocumentApiError(400, 'INVALID_LINE_LENGTH');
  }
  if (typeof pageCount !== 'number' || !Number.isInteger(pageCount) || pageCount <= 0) {
    throw new DocumentApiError(400, 'INVALID_PAGE_COUNT');
  }

  return {
    lineLength,
    pageCount,
  };
}

function parseCharacters(value: unknown): CharacterProfile[] {
  if (!Array.isArray(value)) {
    throw new DocumentApiError(400, 'INVALID_CHARACTERS');
  }

  return value.map((item: unknown) => {
    const record = asRecord(item, 'INVALID_CHARACTER_ITEM');
    const id = asOptionalString(record.id, 'character_id');
    const name = asOptionalString(record.name, 'character_name');
    if (!id || !name) {
      throw new DocumentApiError(400, 'INVALID_CHARACTER_ITEM');
    }

    const parsed: CharacterProfile = {
      id,
      name,
    };

    const optionalKeys = ['age', 'traits', 'background', 'relationships', 'notes'] as const;
    for (const key of optionalKeys) {
      const val = asOptionalString(record[key], `character_${key}`);
      if (val !== undefined) {
        parsed[key] = val;
      }
    }

    return parsed;
  });
}

function parseCreateBody(body: unknown): {
  title: string;
  authorName: string;
  settings: DocumentSettings;
} {
  const record = asRecord(body, 'INVALID_DOCUMENT_BODY');
  const title = asOptionalString(record.title, 'title');
  const authorName = asOptionalString(record.authorName, 'author_name');
  if (!title || !title.trim()) {
    throw new DocumentApiError(400, 'TITLE_REQUIRED');
  }
  if (!authorName || !authorName.trim()) {
    throw new DocumentApiError(400, 'AUTHOR_NAME_REQUIRED');
  }

  return {
    title,
    authorName,
    settings: parseSettings(record.settings),
  };
}

function parsePatchBody(body: unknown): {
  patch: ScriptDocumentPatch;
  expectedVersion?: number;
  changedFields: string[];
} {
  const record = asRecord(body, 'INVALID_DOCUMENT_PATCH');

  const patch: ScriptDocumentPatch = {};
  const changedFields: string[] = [];

  const title = asOptionalString(record.title, 'title');
  if (title !== undefined) {
    patch.title = title;
    changedFields.push('title');
  }

  const authorName = asOptionalString(record.authorName, 'author_name');
  if (authorName !== undefined) {
    patch.authorName = authorName;
    changedFields.push('authorName');
  }

  const synopsis = asOptionalString(record.synopsis, 'synopsis');
  if (synopsis !== undefined) {
    patch.synopsis = synopsis;
    changedFields.push('synopsis');
  }

  const content = asOptionalString(record.content, 'content');
  if (content !== undefined) {
    patch.content = content;
    changedFields.push('content');
  }

  if (record.settings !== undefined) {
    patch.settings = parseSettings(record.settings);
    changedFields.push('settings');
  }

  if (record.characters !== undefined) {
    patch.characters = parseCharacters(record.characters);
    changedFields.push('characters');
  }

  let expectedVersion: number | undefined;
  if (record.expectedVersion !== undefined) {
    if (
      typeof record.expectedVersion !== 'number' ||
      !Number.isInteger(record.expectedVersion) ||
      record.expectedVersion <= 0
    ) {
      throw new DocumentApiError(400, 'INVALID_EXPECTED_VERSION');
    }
    expectedVersion = record.expectedVersion;
  }

  if (expectedVersion === undefined) {
    return { patch, changedFields };
  }

  return { patch, expectedVersion, changedFields };
}

function documentAccessError(correlationId: string, error: unknown): ApiResult {
  if (error instanceof DocumentApiError) {
    return {
      statusCode: error.statusCode,
      body: { error: error.code, correlationId },
    };
  }

  return {
    statusCode: 500,
    body: { error: 'DOCUMENT_INTERNAL_ERROR', correlationId },
  };
}

export async function handleListDocuments(input: {
  correlationId: string;
  ownerId: string;
}): Promise<ApiResult> {
  const documents = (await documentStore.listByOwner(input.ownerId)).map((doc) => ({
    id: doc.id,
    title: doc.title,
    authorName: doc.authorName,
    updatedAt: doc.updatedAt,
    version: doc.version,
  }));

  return {
    statusCode: 200,
    body: documents,
  };
}

export async function handleCreateDocument(input: {
  correlationId: string;
  ownerId: string;
  body: unknown;
}): Promise<ApiResult> {
  try {
    const parsed = parseCreateBody(input.body);
    const created = await documentStore.create(input.ownerId, parsed);
    return {
      statusCode: 201,
      body: created,
    };
  } catch (error) {
    return documentAccessError(input.correlationId, error);
  }
}

export async function handleGetDocument(input: {
  correlationId: string;
  ownerId: string;
  documentId: string;
}): Promise<ApiResult> {
  try {
    const startMs = Date.now();
    const doc = await documentStore.getById(input.documentId);
    if (!doc) {
      throw new DocumentApiError(404, 'DOCUMENT_NOT_FOUND');
    }

    if (doc.ownerId !== input.ownerId) {
      throw new DocumentApiError(403, 'DOCUMENT_ACCESS_DENIED');
    }

    const context = buildLogContext({
      correlationId: input.correlationId,
      feature: 'documents',
      operation: 'getDocument',
      ownerId: input.ownerId,
      documentId: input.documentId,
    });

    logDocumentLoad(context, {
      cacheHit: true,
      version: doc.version,
      elapsedMs: Date.now() - startMs,
    });

    return {
      statusCode: 200,
      body: doc,
    };
  } catch (error) {
    return documentAccessError(input.correlationId, error);
  }
}

export async function handleUpdateDocument(input: {
  correlationId: string;
  ownerId: string;
  documentId: string;
  body: unknown;
}): Promise<ApiResult> {
  const context = buildLogContext({
    correlationId: input.correlationId,
    feature: 'documents',
    operation: 'updateDocument',
    ownerId: input.ownerId,
    documentId: input.documentId,
  });

  try {
    const existing = await documentStore.getById(input.documentId);
    if (!existing) {
      throw new DocumentApiError(404, 'DOCUMENT_NOT_FOUND');
    }

    if (existing.ownerId !== input.ownerId) {
      throw new DocumentApiError(403, 'DOCUMENT_ACCESS_DENIED');
    }

    const { patch, expectedVersion, changedFields } = parsePatchBody(input.body);
    if (expectedVersion !== undefined && expectedVersion !== existing.version) {
      throw new DocumentApiError(409, 'DOCUMENT_VERSION_CONFLICT');
    }

    if (changedFields.length === 0) {
      return {
        statusCode: 200,
        body: existing,
      };
    }

    const startMs = Date.now();
    const updated = await documentStore.update(input.documentId, patch);
    logDocumentSave(context, {
      version: updated.version,
      changedFields,
      elapsedMs: Date.now() - startMs,
    });

    return {
      statusCode: 200,
      body: updated,
    };
  } catch (error) {
    return documentAccessError(input.correlationId, error);
  }
}
