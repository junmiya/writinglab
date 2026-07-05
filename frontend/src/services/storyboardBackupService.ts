import type { StoryboardContent, StoryboardSettings } from '../types/storyboard';
import type { NovelDiscussionMessage } from '../types/novel';
import { downloadTextFile, backupFilename } from './novelBackupService';

export { downloadTextFile, backupFilename };

/**
 * Storyboard backup (specs/003 FR-111): full-fidelity JSON for lossless restore +
 * human-readable Markdown (scene headings + cut tables). Same pattern as
 * novelBackupService.
 */

const BACKUP_FORMAT = 'scenario-lab-storyboard';
const BACKUP_VERSION = 1 as const;

export interface StoryboardBackupInput {
  title: string;
  authorName: string;
  synopsis: string;
  storyboardContent: StoryboardContent;
  storyboardSettings: StoryboardSettings;
  storyboardDiscussion?: NovelDiscussionMessage[];
  sourceScriptId?: string;
}

export interface StoryboardBackup extends StoryboardBackupInput {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  contentType: 'storyboard';
  exportedAt: string;
}

export function serializeStoryboardBackupJson(input: StoryboardBackupInput): string {
  const backup: StoryboardBackup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    contentType: 'storyboard',
    exportedAt: new Date().toISOString(),
    ...input,
  };
  return JSON.stringify(backup, null, 2);
}

export function parseStoryboardBackupJson(text: string): StoryboardBackup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('JSON の解析に失敗しました（ファイルが壊れている可能性があります）');
  }
  const obj = data as Partial<StoryboardBackup>;
  if (obj.format !== BACKUP_FORMAT) {
    throw new Error('絵コンテバックアップ形式ではありません');
  }
  if (obj.version !== BACKUP_VERSION) {
    throw new Error(`未対応のバックアップバージョンです: ${String(obj.version)}`);
  }
  if (!obj.storyboardContent || !obj.storyboardSettings) {
    throw new Error('バックアップに必要なフィールドが欠けています');
  }
  return obj as StoryboardBackup;
}

function mdEscape(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

/** Human-readable Markdown (not re-importable — use JSON for restore). */
export function buildStoryboardMarkdown(input: StoryboardBackupInput): string {
  const lines: string[] = [];
  lines.push(`# ${input.title || '無題の絵コンテ'}`);
  if (input.authorName) lines.push(`\n著者: ${input.authorName}`);
  if (input.synopsis.trim()) lines.push('\n## あらすじ\n', input.synopsis);

  const scenes = [...input.storyboardContent.scenes].sort((a, b) => a.order - b.order);
  if (scenes.length === 0) {
    lines.push('\n（カット未作成）');
  }
  for (const [i, scene] of scenes.entries()) {
    lines.push(`\n## ${scene.title || `シーン${i + 1}`}`);
    const cuts = [...scene.cuts].sort((a, b) => a.order - b.order);
    if (cuts.length === 0) {
      lines.push('\n（カットなし）');
      continue;
    }
    lines.push('\n| カット | 画面 | 内容 | セリフ／音 | 秒数 |', '| --- | --- | --- | --- | --- |');
    for (const c of cuts) {
      lines.push(
        `| ${mdEscape(c.cutNumber)} | ${mdEscape(c.picture)} | ${mdEscape(c.action)} | ${mdEscape(c.dialogue)} | ${c.timeSec ?? ''} |`,
      );
    }
  }
  return lines.join('\n');
}
