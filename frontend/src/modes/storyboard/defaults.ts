import type { EditorSettings } from '../../stores/editorStore';

/**
 * Storyboard defaults. The classic layout metrics (lineLength etc.) are not
 * meaningful for cut tables; kept for ModeProfile compatibility.
 */
export const STORYBOARD_DEFAULT_SETTINGS: EditorSettings = {
  lineLength: 20,
  linesPerPage: 20,
  pageCount: 10,
};
