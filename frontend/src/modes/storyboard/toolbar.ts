import type { ToolbarActionDef } from '../types';

/**
 * Storyboard toolbar actions (FR-102). Structural actions handled by the editor
 * store (like novel's chapter/section); templates are unused for those.
 */
export const STORYBOARD_TOOLBAR_ACTIONS: ToolbarActionDef[] = [
  { id: 'scene', label: 'シーンを追加', template: '' },
  { id: 'cut', label: 'カットを追加', template: '' },
];
