import { requireSession } from './authService';
import {
  InMemoryDocumentRepository,
  type ScriptDocument,
  type ScriptDocumentPatch,
} from './documentRepository';
import { isFunctionsApiConfigured, requestFunctionsJson } from './functionsApi';

const repository = new InMemoryDocumentRepository();

export async function listDocuments(): Promise<ScriptDocument[]> {
  if (isFunctionsApiConfigured()) {
    return requestFunctionsJson<ScriptDocument[]>('GET', '/api/documents');
  }

  const session = await requireSession();
  return repository.list(session.user.uid);
}

export async function createDocument(input: {
  title: string;
  authorName: string;
  settings: ScriptDocument['settings'];
}): Promise<ScriptDocument> {
  if (isFunctionsApiConfigured()) {
    return requestFunctionsJson<ScriptDocument>('POST', '/api/documents', input);
  }

  const session = await requireSession();
  return repository.create(session.user.uid, input);
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

  const session = await requireSession();
  return repository.get(session.user.uid, id);
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

  const session = await requireSession();
  return repository.update(session.user.uid, id, patch);
}
