import type { ExportPresetDef } from '../types';

/**
 * Storyboard paper presets (FR-104). Rendering is handled by StoryboardEditor;
 * docx/PDF export is a follow-up (spec §4).
 */
export const STORYBOARD_EXPORT_PRESETS: ExportPresetDef[] = [
  { id: 'storyboard-anime', label: 'アニメ式（5欄）', writingDirection: 'horizontal' },
  { id: 'storyboard-film', label: '映画式（フレーム主体）', writingDirection: 'horizontal' },
];
