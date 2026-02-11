import { randomUUID } from 'node:crypto';

export interface DocumentSettings {
  lineLength: number;
  pageCount: number;
}

export interface CharacterProfile {
  id: string;
  name: string;
  age?: string;
  traits?: string;
  background?: string;
  relationships?: string;
  notes?: string;
}

export interface ScriptDocument {
  id: string;
  ownerId: string;
  title: string;
  authorName: string;
  synopsis: string;
  content: string;
  settings: DocumentSettings;
  characters: CharacterProfile[];
  createdAt: string;
  updatedAt: string;
  version: number;
}

export type ScriptDocumentPatch = Partial<
  Pick<ScriptDocument, 'title' | 'authorName' | 'synopsis' | 'content' | 'settings' | 'characters'>
>;

function nowIso(): string {
  return new Date().toISOString();
}

function makeDocumentId(): string {
  return `doc_${randomUUID().slice(0, 8)}`;
}

class InMemoryDocumentStore {
  private readonly store = new Map<string, ScriptDocument>();

  listByOwner(ownerId: string): ScriptDocument[] {
    return [...this.store.values()]
      .filter((doc) => doc.ownerId === ownerId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  getById(id: string): ScriptDocument | null {
    return this.store.get(id) ?? null;
  }

  create(
    ownerId: string,
    input: {
      title: string;
      authorName: string;
      settings: DocumentSettings;
    },
  ): ScriptDocument {
    const createdAt = nowIso();
    const document: ScriptDocument = {
      id: makeDocumentId(),
      ownerId,
      title: input.title,
      authorName: input.authorName,
      synopsis: '',
      content: '',
      settings: input.settings,
      characters: [],
      createdAt,
      updatedAt: createdAt,
      version: 1,
    };

    this.store.set(document.id, document);
    return document;
  }

  update(id: string, patch: ScriptDocumentPatch): ScriptDocument {
    const current = this.store.get(id);
    if (!current) {
      throw new Error('DOCUMENT_NOT_FOUND');
    }

    const updated: ScriptDocument = {
      ...current,
      ...patch,
      updatedAt: nowIso(),
      version: current.version + 1,
    };

    this.store.set(id, updated);
    return updated;
  }
}

export const documentStore = new InMemoryDocumentStore();
