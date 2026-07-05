/**
 * Firestore access for the MCP server via firebase-admin. All reads are scoped
 * to the configured owner UID, enforcing that the server never exposes another
 * user's documents (spec SC-M3).
 */

import { initializeApp, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { ServerConfig } from './config.js';
import type { StoryboardContent, StoryboardSettings } from './storyboard.js';

export interface StoryboardScriptDoc {
  id: string;
  title: string;
  ownerId: string;
  contentType: string;
  storyboardContent: StoryboardContent;
  storyboardSettings?: StoryboardSettings;
}

let app: App | undefined;
let firestore: Firestore | undefined;

function db(config: ServerConfig): Firestore {
  if (!firestore) {
    // cert() accepts a path to the service-account JSON file directly.
    app = initializeApp({
      credential: cert(config.serviceAccountPath),
      projectId: config.projectId,
    });
    firestore = getFirestore(app);
  }
  return firestore;
}

function emptyContent(): StoryboardContent {
  return { scenes: [] };
}

/** List the owner's storyboard scripts (contentType === 'storyboard'). */
export async function listStoryboards(
  config: ServerConfig,
): Promise<Array<{ id: string; title: string; sceneCount: number; cutCount: number }>> {
  const snap = await db(config)
    .collection('scripts')
    .where('ownerId', '==', config.ownerUid)
    .where('contentType', '==', 'storyboard')
    .get();

  return snap.docs.map((d) => {
    const data = d.data();
    const content = (data.storyboardContent as StoryboardContent | undefined) ?? emptyContent();
    const cutCount = content.scenes.reduce((s, sc) => s + (sc.cuts?.length ?? 0), 0);
    return {
      id: d.id,
      title: (data.title as string | undefined) ?? '(無題)',
      sceneCount: content.scenes.length,
      cutCount,
    };
  });
}

/**
 * Fetch a single storyboard script, verifying ownership. Returns null when the
 * document does not exist; throws when it exists but belongs to another user.
 */
export async function getStoryboardScript(
  config: ServerConfig,
  scriptId: string,
): Promise<StoryboardScriptDoc | null> {
  const doc = await db(config).collection('scripts').doc(scriptId).get();
  if (!doc.exists) return null;
  const data = doc.data() ?? {};
  if (data.ownerId !== config.ownerUid) {
    throw new Error('この絵コンテにアクセスする権限がありません（所有者が異なります）');
  }
  return {
    id: doc.id,
    title: (data.title as string | undefined) ?? '(無題)',
    ownerId: data.ownerId as string,
    contentType: (data.contentType as string | undefined) ?? 'screenplay',
    storyboardContent: (data.storyboardContent as StoryboardContent | undefined) ?? emptyContent(),
    ...(data.storyboardSettings
      ? { storyboardSettings: data.storyboardSettings as StoryboardSettings }
      : {}),
  };
}
