import { describe, expect, it } from 'vitest';
import { createExportPayload, requestExport } from '../../src/services/exportService';

describe('exportService', () => {
  it('fails when required metadata is missing', () => {
    expect(() => createExportPayload({ title: '', authorName: 'a', content: 'body' })).toThrow(
      'EXPORT_METADATA_REQUIRED',
    );
  });

  it('creates docx payload with sanitized filename', () => {
    const result = createExportPayload({ title: 'My Script!', authorName: 'A', content: 'body' });
    expect(result.fileName).toBe('My_Script_.docx');
    expect(result.mimeType).toContain(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
  });

  it('uses local payload fallback when functions API is not configured', async () => {
    const result = await requestExport({
      documentId: 'doc-local',
      title: 'Draft',
      authorName: 'Writer',
      content: 'body',
    });

    expect(result.fileName).toBe('Draft.docx');
    expect(result.content).toContain('Author: Writer');
  });
});
