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

export interface DocumentRepository {
  list(ownerId: string): Promise<ScriptDocument[]>;
  get(ownerId: string, id: string): Promise<ScriptDocument | null>;
  create(
    ownerId: string,
    input: Pick<ScriptDocument, 'title' | 'authorName' | 'settings'>,
  ): Promise<ScriptDocument>;
  update(ownerId: string, id: string, patch: ScriptDocumentPatch): Promise<ScriptDocument>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function assertOwner(ownerId: string, doc: ScriptDocument): void {
  if (doc.ownerId !== ownerId) {
    throw new Error('DOCUMENT_ACCESS_DENIED');
  }
}

function makeId(): string {
  return `doc_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * In-memory reference implementation for UI development and tests.
 * Swap this with Firestore-backed implementation in infrastructure integration.
 */
export class InMemoryDocumentRepository implements DocumentRepository {
  private readonly store = new Map<string, ScriptDocument>();

  async list(ownerId: string): Promise<ScriptDocument[]> {
    return [...this.store.values()]
      .filter((doc) => doc.ownerId === ownerId)
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  }

  async get(ownerId: string, id: string): Promise<ScriptDocument | null> {
    const doc = this.store.get(id);
    if (!doc) {
      return null;
    }

    assertOwner(ownerId, doc);
    return doc;
  }

  async create(
    ownerId: string,
    input: Pick<ScriptDocument, 'title' | 'authorName' | 'settings'>,
  ): Promise<ScriptDocument> {
    const createdAt = nowIso();
    const document: ScriptDocument = {
      id: makeId(),
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

  async update(ownerId: string, id: string, patch: ScriptDocumentPatch): Promise<ScriptDocument> {
    const current = this.store.get(id);
    if (!current) {
      throw new Error('DOCUMENT_NOT_FOUND');
    }

    assertOwner(ownerId, current);

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
