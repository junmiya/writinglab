import { requireSession } from './authService';
import {
  InMemoryDocumentRepository,
  type ScriptDocument,
  type ScriptDocumentPatch,
} from './documentRepository';

const repository = new InMemoryDocumentRepository();

export async function listDocuments(): Promise<ScriptDocument[]> {
  const session = await requireSession();
  return repository.list(session.user.uid);
}

export async function createDocument(input: {
  title: string;
  authorName: string;
  settings: ScriptDocument['settings'];
}): Promise<ScriptDocument> {
  const session = await requireSession();
  return repository.create(session.user.uid, input);
}

export async function loadDocument(id: string): Promise<ScriptDocument | null> {
  const session = await requireSession();
  return repository.get(session.user.uid, id);
}

export async function saveDocument(
  id: string,
  patch: ScriptDocumentPatch,
): Promise<ScriptDocument> {
  const session = await requireSession();
  return repository.update(session.user.uid, id, patch);
}
