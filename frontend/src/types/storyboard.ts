/**
 * Storyboard-mode data structures (specs/003-add-storyboard-mode).
 * Body is a 2-level hierarchy: scene > cut (same pattern as novel's chapter > section).
 * Stored nested inside the script document, not as separate collections.
 * MVP is 字コンテ: the picture column is a text description (FR-103); an optional
 * imageUrl will be added later together with Firebase Storage.
 */

/** One cut (frame) in a scene. */
export interface StoryboardCut {
  id: string;
  order: number;
  /** Display cut number like "C-1". Auto-numbered on add/move/remove but editable. */
  cutNumber: string;
  /** 画面: composition / camera-work described as text (MVP; image attach is a follow-up). */
  picture: string;
  /** 内容: action, acting, direction notes. */
  action: string;
  /** セリフ / 音・SE. */
  dialogue: string;
  /** 秒数. null = 未入力 (treated as 0 in totals). */
  timeSec: number | null;
}

export interface StoryboardScene {
  id: string;
  title: string;
  order: number;
  cuts: StoryboardCut[];
}

export interface StoryboardContent {
  scenes: StoryboardScene[];
}

/** Paper preset: anime = classic 5-column sheet; film = frame-first layout. */
export interface StoryboardSettings {
  paperFormat: 'anime' | 'film';
}

export const DEFAULT_STORYBOARD_SETTINGS: StoryboardSettings = {
  paperFormat: 'anime',
};

export function createEmptyStoryboardContent(): StoryboardContent {
  return { scenes: [] };
}
