import { describe, it, expect } from 'vitest';
import {
  createInitialEditorState,
  addScene,
  addCut,
  updateCut,
  type EditorState,
} from '../../src/stores/editorStore';
import {
  resolveScriptContentType,
  type FirestoreScript,
} from '../../src/lib/firebase/firestoreService';

/**
 * specs/003 US1: storyboard create → scene/cut edit → save → reload reconstructs the
 * full structure. Mirrors the EditorPage save/load mapping without Firestore.
 */

function toFirestore(state: EditorState): Partial<FirestoreScript> {
  return {
    contentType: state.contentType,
    title: state.title,
    ...(state.storyboardContent ? { storyboardContent: state.storyboardContent } : {}),
    ...(state.storyboardSettings ? { storyboardSettings: state.storyboardSettings } : {}),
    ...(state.sourceScriptId ? { sourceScriptId: state.sourceScriptId } : {}),
  };
}

function fromFirestore(doc: Partial<FirestoreScript>): EditorState {
  const contentType = resolveScriptContentType(doc.contentType);
  const base = createInitialEditorState(contentType);
  return {
    ...base,
    title: doc.title ?? '',
    ...(contentType === 'storyboard'
      ? {
          storyboardContent: doc.storyboardContent ?? { scenes: [] },
          storyboardSettings: doc.storyboardSettings ?? { paperFormat: 'anime' },
          ...(doc.sourceScriptId ? { sourceScriptId: doc.sourceScriptId } : {}),
        }
      : {}),
  };
}

describe('US1 storyboard create → edit → save → reload', () => {
  it('creates a storyboard with defaults', () => {
    const state = createInitialEditorState('storyboard');
    expect(state.contentType).toBe('storyboard');
    expect(state.storyboardContent?.scenes).toEqual([]);
    expect(state.storyboardSettings?.paperFormat).toBe('anime');
  });

  it('round-trips scenes/cuts/settings through save/reload', () => {
    let state = createInitialEditorState('storyboard');
    state = { ...state, title: 'PV コンテ', sourceScriptId: 'script-123' };
    let sc = state.storyboardContent!;
    sc = addScene(sc, '屋上（夕）', 'scn-1');
    sc = addCut(sc, 'scn-1', 'cut-a');
    sc = updateCut(sc, 'scn-1', 'cut-a', {
      picture: 'フェンス越しロング、PAN右',
      action: '少女が振り向く',
      dialogue: '「……来たんだ」',
      timeSec: 3,
    });
    state = {
      ...state,
      storyboardContent: sc,
      storyboardSettings: { paperFormat: 'film' },
    };

    const reloaded = fromFirestore(toFirestore(state));
    expect(reloaded.contentType).toBe('storyboard');
    expect(reloaded.title).toBe('PV コンテ');
    expect(reloaded.storyboardContent).toEqual(state.storyboardContent);
    expect(reloaded.storyboardContent?.scenes[0]?.cuts[0]?.cutNumber).toBe('C-1');
    expect(reloaded.storyboardSettings?.paperFormat).toBe('film');
    expect(reloaded.sourceScriptId).toBe('script-123');
  });

  it('legacy docs without contentType stay screenplay (no storyboard fields)', () => {
    const reloaded = fromFirestore({ title: '旧脚本' });
    expect(reloaded.contentType).toBe('screenplay');
    expect(reloaded.storyboardContent).toBeUndefined();
  });
});
