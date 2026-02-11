import { describe, expect, it } from 'vitest';

import {
  createDocument,
  listDocuments,
  loadDocument,
  saveDocument,
} from '../../src/services/documentService';

describe('documentService', () => {
  it('supports create/list/load/save flow in local fallback mode', async () => {
    const created = await createDocument({
      title: 'Draft A',
      authorName: 'Writer',
      settings: { lineLength: 20, pageCount: 10 },
    });

    const list = await listDocuments();
    expect(list.some((item) => item.id === created.id)).toBe(true);

    const loaded = await loadDocument(created.id);
    expect(loaded?.title).toBe('Draft A');

    const saved = await saveDocument(created.id, {
      content: 'updated content',
    });
    expect(saved.version).toBeGreaterThanOrEqual(2);
    expect(saved.content).toBe('updated content');
  });

  it('returns null for unknown id in local fallback mode', async () => {
    const loaded = await loadDocument('doc_missing');
    expect(loaded).toBeNull();
  });
});
