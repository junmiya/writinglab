export interface AuthUser {
  uid: string;
  email?: string;
  displayName?: string;
}

export interface AuthSession {
  user: AuthUser;
  idToken: string;
  issuedAt: number;
  expiresAt: number;
}

const SESSION_STORAGE_KEY = 'swl.auth.session';

function isAuthSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<AuthSession>;
  return (
    typeof candidate.idToken === 'string' &&
    typeof candidate.issuedAt === 'number' &&
    typeof candidate.expiresAt === 'number' &&
    typeof candidate.user?.uid === 'string'
  );
}

function isExpired(session: AuthSession, now = Date.now()): boolean {
  return session.expiresAt <= now;
}

export function readSession(): AuthSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isAuthSession(parsed)) {
      clearSession();
      return null;
    }

    if (isExpired(parsed)) {
      clearSession();
      return null;
    }

    return parsed;
  } catch {
    clearSession();
    return null;
  }
}

export function writeSession(session: AuthSession): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

export async function requireSession(): Promise<AuthSession> {
  const session = readSession();
  if (!session) {
    throw new Error('AUTH_REQUIRED');
  }

  return session;
}

export async function bootstrapAuthSession(): Promise<AuthSession | null> {
  return readSession();
}
