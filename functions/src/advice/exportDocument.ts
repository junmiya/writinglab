import { buildLogContext, logError, logInfo } from '../common/logging';

export interface ExportDocumentInput {
  correlationId: string;
  ownerId: string;
  documentId: string;
  title: string;
  authorName: string;
  content: string;
}

export interface ExportDocumentResult {
  statusCode: number;
  body:
    | {
        fileName: string;
        mimeType: string;
        content: string;
      }
    | {
        error: string;
        correlationId: string;
      };
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9-_]/g, '_');
}

function validateExportInput(input: ExportDocumentInput): void {
  if (!input.title.trim() || !input.authorName.trim()) {
    throw new Error('EXPORT_METADATA_REQUIRED');
  }

  if (!input.content.trim()) {
    throw new Error('EXPORT_CONTENT_REQUIRED');
  }
}

export async function handleExportDocument(
  input: ExportDocumentInput,
): Promise<ExportDocumentResult> {
  const startMs = Date.now();
  const context = buildLogContext({
    correlationId: input.correlationId,
    feature: 'export',
    operation: 'handleExportDocument',
    ownerId: input.ownerId,
    documentId: input.documentId,
  });

  try {
    validateExportInput(input);

    const result = {
      fileName: `${sanitizeFileName(input.title)}.docx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      content: [`# ${input.title}`, `Author: ${input.authorName}`, '', input.content].join('\n'),
    };

    logInfo('EXPORT_SUCCEEDED', context, {
      fileName: result.fileName,
      byteLength: result.content.length,
      elapsedMs: Date.now() - startMs,
    });

    return {
      statusCode: 200,
      body: result,
    };
  } catch (error) {
    logError('EXPORT_FAILED', context, {
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      statusCode: 400,
      body: {
        error: error instanceof Error ? error.message : 'EXPORT_FAILED',
        correlationId: context.correlationId,
      },
    };
  }
}
