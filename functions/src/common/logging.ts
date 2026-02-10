import { randomUUID } from 'node:crypto';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  correlationId: string;
  feature?: string;
  operation?: string;
  ownerId?: string;
  documentId?: string;
  provider?: string;
}

export interface LogEvent {
  level: LogLevel;
  message: string;
  context: LogContext;
  timestamp: string;
  details?: unknown;
}

export function createCorrelationId(): string {
  return randomUUID();
}

export function buildLogContext(partial: Partial<LogContext>): LogContext {
  const context: LogContext = {
    correlationId: partial.correlationId ?? createCorrelationId(),
  };

  if (partial.feature !== undefined) {
    context.feature = partial.feature;
  }

  if (partial.operation !== undefined) {
    context.operation = partial.operation;
  }

  if (partial.ownerId !== undefined) {
    context.ownerId = partial.ownerId;
  }

  if (partial.documentId !== undefined) {
    context.documentId = partial.documentId;
  }

  if (partial.provider !== undefined) {
    context.provider = partial.provider;
  }

  return context;
}

function emit(level: LogLevel, message: string, context: LogContext, details?: unknown): void {
  const event: LogEvent = {
    level,
    message,
    context,
    details,
    timestamp: new Date().toISOString(),
  };

  const line = JSON.stringify(event);
  if (level === 'warn') {
    console.warn(line);
    return;
  }

  if (level === 'error') {
    console.error(line);
    return;
  }

  console.log(line);
}

export function logInfo(message: string, context: LogContext, details?: unknown): void {
  emit('info', message, context, details);
}

export function logWarn(message: string, context: LogContext, details?: unknown): void {
  emit('warn', message, context, details);
}

export function logError(message: string, context: LogContext, details?: unknown): void {
  emit('error', message, context, details);
}

export function logDocumentLoad(
  context: LogContext,
  details: { cacheHit?: boolean; version?: number; elapsedMs?: number },
): void {
  logInfo('DOCUMENT_LOAD', context, details);
}

export function logDocumentSave(
  context: LogContext,
  details: { version?: number; changedFields?: string[]; elapsedMs?: number },
): void {
  logInfo('DOCUMENT_SAVE', context, details);
}
