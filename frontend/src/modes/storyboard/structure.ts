import type { StructureDef } from '../types';

/**
 * Storyboard structure guide: a dynamic scene list (like novel's chapter list).
 * Segments are derived at runtime from StoryboardContent.scenes (title + cut
 * count + total seconds); this static definition only declares the kind.
 */
export const STORYBOARD_STRUCTURE: StructureDef = {
  kind: 'chapterList',
  segments: [],
};
