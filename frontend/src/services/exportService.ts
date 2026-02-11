import { isFunctionsApiConfigured, postFunctionsJson } from './functionsApi';

export interface ExportInput {
  documentId?: string;
  title: string;
  authorName: string;
  content: string;
}

export interface ExportPayload {
  fileName: string;
  content: string;
  mimeType: string;
}

function assertRequiredMetadata(input: ExportInput): void {
  if (!input.title.trim() || !input.authorName.trim()) {
    throw new Error('EXPORT_METADATA_REQUIRED');
  }
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9-_]/g, '_');
}

export function createExportPayload(input: ExportInput): ExportPayload {
  assertRequiredMetadata(input);

  const fileName = `${sanitizeFileName(input.title)}.docx`;
  const content = [`# ${input.title}`, `Author: ${input.authorName}`, '', input.content].join('\n');

  return {
    fileName,
    content,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
}

export async function requestExport(input: ExportInput): Promise<ExportPayload> {
  if (!isFunctionsApiConfigured()) {
    return createExportPayload(input);
  }

  const documentId = input.documentId && input.documentId.trim() ? input.documentId : 'local-draft';
  return postFunctionsJson<ExportPayload>(
    `/api/documents/${encodeURIComponent(documentId)}/export`,
    {
      title: input.title,
      authorName: input.authorName,
      content: input.content,
    },
  );
}
