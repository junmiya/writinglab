import { randomUUID } from 'node:crypto';

import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

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

type DocumentStoreBackend = 'memory' | 'firestore';

interface DocumentStore {
  listByOwner(ownerId: string): Promise<ScriptDocument[]>;
  getById(id: string): Promise<ScriptDocument | null>;
  create(
    ownerId: string,
    input: {
      title: string;
      authorName: string;
      settings: DocumentSettings;
    },
  ): Promise<ScriptDocument>;
  update(id: string, patch: ScriptDocumentPatch): Promise<ScriptDocument>;
}

interface FirestoreDocumentRecord {
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

const DEFAULT_COLLECTION = 'documents';
let cachedStore: DocumentStore | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function makeDocumentId(): string {
  return `doc_${randomUUID().slice(0, 8)}`;
}

function readBackend(): DocumentStoreBackend {
  return process.env.DOCUMENT_STORE_BACKEND === 'firestore' ? 'firestore' : 'memory';
}

function readCollectionName(): string {
  const configured = process.env.FIRESTORE_DOCUMENTS_COLLECTION;
  return configured && configured.trim().length > 0 ? configured.trim() : DEFAULT_COLLECTION;
}

function readProjectId(): string | undefined {
  const configured = process.env.DOCUMENTS_FIREBASE_PROJECT_ID;
  return configured && configured.trim().length > 0 ? configured.trim() : undefined;
}

function buildPatchRecord(patch: ScriptDocumentPatch): Partial<FirestoreDocumentRecord> {
  const record: Partial<FirestoreDocumentRecord> = {};
  if (patch.title !== undefined) {
    record.title = patch.title;
  }
  if (patch.authorName !== undefined) {
    record.authorName = patch.authorName;
  }
  if (patch.synopsis !== undefined) {
    record.synopsis = patch.synopsis;
  }
  if (patch.content !== undefined) {
    record.content = patch.content;
  }
  if (patch.settings !== undefined) {
    record.settings = patch.settings;
  }
  if (patch.characters !== undefined) {
    record.characters = patch.characters;
  }

  return record;
}

function fromFirestore(
  id: string,
  data: FirebaseFirestore.DocumentData | undefined,
): ScriptDocument | null {
  if (!data) {
    return null;
  }

  if (
    typeof data.ownerId !== 'string' ||
    typeof data.title !== 'string' ||
    typeof data.authorName !== 'string' ||
    typeof data.synopsis !== 'string' ||
    typeof data.content !== 'string' ||
    typeof data.createdAt !== 'string' ||
    typeof data.updatedAt !== 'string' ||
    typeof data.version !== 'number' ||
    !data.settings ||
    typeof data.settings !== 'object' ||
    typeof (data.settings as { lineLength?: unknown }).lineLength !== 'number' ||
    typeof (data.settings as { pageCount?: unknown }).pageCount !== 'number' ||
    !Array.isArray(data.characters)
  ) {
    return null;
  }

  return {
    id,
    ownerId: data.ownerId,
    title: data.title,
    authorName: data.authorName,
    synopsis: data.synopsis,
    content: data.content,
    settings: {
      lineLength: (data.settings as { lineLength: number }).lineLength,
      pageCount: (data.settings as { pageCount: number }).pageCount,
    },
    characters: data.characters as CharacterProfile[],
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    version: data.version,
  };
}

class InMemoryDocumentStore implements DocumentStore {
  private readonly store = new Map<string, ScriptDocument>();

  async listByOwner(ownerId: string): Promise<ScriptDocument[]> {
    return [...this.store.values()]
      .filter((doc) => doc.ownerId === ownerId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getById(id: string): Promise<ScriptDocument | null> {
    return this.store.get(id) ?? null;
  }

  async create(
    ownerId: string,
    input: {
      title: string;
      authorName: string;
      settings: DocumentSettings;
    },
  ): Promise<ScriptDocument> {
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

  async update(id: string, patch: ScriptDocumentPatch): Promise<ScriptDocument> {
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

class FirestoreDocumentStore implements DocumentStore {
  private readonly db: Firestore;
  private readonly collectionName: string;

  constructor(db: Firestore, collectionName: string) {
    this.db = db;
    this.collectionName = collectionName;
  }

  async listByOwner(ownerId: string): Promise<ScriptDocument[]> {
    const snapshot = await this.db
      .collection(this.collectionName)
      .where('ownerId', '==', ownerId)
      .orderBy('updatedAt', 'desc')
      .get();

    return snapshot.docs
      .map((doc) => fromFirestore(doc.id, doc.data()))
      .filter((doc): doc is ScriptDocument => doc !== null);
  }

  async getById(id: string): Promise<ScriptDocument | null> {
    const doc = await this.db.collection(this.collectionName).doc(id).get();
    return fromFirestore(doc.id, doc.data());
  }

  async create(
    ownerId: string,
    input: {
      title: string;
      authorName: string;
      settings: DocumentSettings;
    },
  ): Promise<ScriptDocument> {
    const id = makeDocumentId();
    const createdAt = nowIso();
    const record: FirestoreDocumentRecord = {
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

    await this.db.collection(this.collectionName).doc(id).set(record);
    return {
      id,
      ...record,
    };
  }

  async update(id: string, patch: ScriptDocumentPatch): Promise<ScriptDocument> {
    const ref = this.db.collection(this.collectionName).doc(id);

    const updated = await this.db.runTransaction(async (txn) => {
      const currentDoc = await txn.get(ref);
      const current = fromFirestore(currentDoc.id, currentDoc.data());
      if (!current) {
        throw new Error('DOCUMENT_NOT_FOUND');
      }

      const nextVersion = current.version + 1;
      const partial = buildPatchRecord(patch);
      const nextUpdatedAt = nowIso();

      txn.update(ref, {
        ...partial,
        updatedAt: nextUpdatedAt,
        version: nextVersion,
      });

      return {
        ...current,
        ...patch,
        updatedAt: nextUpdatedAt,
        version: nextVersion,
      } satisfies ScriptDocument;
    });

    return updated;
  }
}

function createFirestoreStore(): DocumentStore {
  const existing = getApps()[0];
  const projectId = readProjectId();
  const app = existing ?? initializeApp(projectId !== undefined ? { projectId } : undefined);
  const db = getFirestore(app);
  return new FirestoreDocumentStore(db, readCollectionName());
}

function createDocumentStore(): DocumentStore {
  if (readBackend() !== 'firestore') {
    return new InMemoryDocumentStore();
  }

  try {
    return createFirestoreStore();
  } catch (error) {
    console.warn(
      `DOCUMENT_STORE_BACKEND=firestore initialization failed, fallback to memory: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return new InMemoryDocumentStore();
  }
}

export function getDocumentStore(): DocumentStore {
  if (!cachedStore) {
    cachedStore = createDocumentStore();
  }

  return cachedStore;
}
