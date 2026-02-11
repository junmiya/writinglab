import { readSession } from './authService';
import {
  InMemoryDocumentRepository,
  type ScriptDocument,
  type ScriptDocumentPatch,
} from './documentRepository';
import { isFunctionsApiConfigured, requestFunctionsJson } from './functionsApi';

const repository = new InMemoryDocumentRepository();

export interface DocumentSummary {
  id: string;
  title: string;
  authorName: string;
  updatedAt: string;
  version: number;
}

function resolveLocalOwnerId(): string {
  return readSession()?.user.uid ?? 'local-dev-user';
}

export async function listDocuments(): Promise<DocumentSummary[]> {
  if (isFunctionsApiConfigured()) {
    return requestFunctionsJson<DocumentSummary[]>('GET', '/api/documents');
  }

  const documents = await repository.list(resolveLocalOwnerId());
  return documents.map((document) => ({
    id: document.id,
    title: document.title,
    authorName: document.authorName,
    updatedAt: document.updatedAt,
    version: document.version,
  }));
}

export async function createDocument(input: {
  title: string;
  authorName: string;
  settings: ScriptDocument['settings'];
}): Promise<ScriptDocument> {
  if (isFunctionsApiConfigured()) {
    return requestFunctionsJson<ScriptDocument>('POST', '/api/documents', input);
  }

  return repository.create(resolveLocalOwnerId(), input);
}

export async function loadDocument(id: string): Promise<ScriptDocument | null> {
  if (isFunctionsApiConfigured()) {
    try {
      return await requestFunctionsJson<ScriptDocument>(
        'GET',
        `/api/documents/${encodeURIComponent(id)}`,
      );
    } catch (error) {
      const code = error instanceof Error ? error.message : String(error);
      if (code === 'DOCUMENT_NOT_FOUND' || code === 'HTTP_404') {
        return null;
      }

      throw error;
    }
  }

  return repository.get(resolveLocalOwnerId(), id);
}

export async function saveDocument(
  id: string,
  patch: ScriptDocumentPatch,
): Promise<ScriptDocument> {
  if (isFunctionsApiConfigured()) {
    return requestFunctionsJson<ScriptDocument>(
      'PATCH',
      `/api/documents/${encodeURIComponent(id)}`,
      patch,
    );
  }

  return repository.update(resolveLocalOwnerId(), id, patch);
}
