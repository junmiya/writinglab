#!/usr/bin/env node
/**
 * ScenarioLab MCP server (specs/004-mcp-server, C-plan Phase 1a — read-only).
 *
 * Lets a flat-rate MCP host (Claude/ChatGPT Desktop) read the user's storyboard
 * cuts so it can draw frames under the host's own quota. Three tools:
 *   - scenariolab_list_storyboards : list the user's storyboards
 *   - scenariolab_list_cuts        : list scenes/cuts of one storyboard
 *   - scenariolab_get_cut_context  : full drawing context + prompt for a cut
 *
 * Writing images back (attach_image) is deferred to Phase 1b pending the image
 * storage decision (spec §5); today the app's 貼り付け button imports the result.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { loadConfig, type ServerConfig } from './config.js';
import { listStoryboards, getStoryboardScript } from './firestore.js';
import {
  buildImagePrompt,
  formatCamera,
  resolveFrameAspect,
  countCuts,
  totalSeconds,
  DEFAULT_IMAGE_STYLE,
  type StoryboardCut,
} from './storyboard.js';

const CHARACTER_LIMIT = 25000;

function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const responseFormat = z
  .enum(['markdown', 'json'])
  .default('markdown')
  .describe("出力形式: 'markdown'（人間可読）または 'json'（機械可読）");

function jsonText(value: unknown): string {
  const text = JSON.stringify(value, null, 2);
  if (text.length <= CHARACTER_LIMIT) return text;
  return (
    text.slice(0, CHARACTER_LIMIT) +
    `\n… （${text.length} 文字を ${CHARACTER_LIMIT} 文字に切り詰めました。script_id/cut_id で絞り込んでください）`
  );
}

function registerTools(server: McpServer, config: ServerConfig): void {
  // ── list_storyboards ──
  server.registerTool(
    'scenariolab_list_storyboards',
    {
      title: 'List ScenarioLab storyboards',
      description: `ScenarioLab で自分が所有する絵コンテ（storyboard）作品を一覧する。

Args:
  - response_format ('markdown' | 'json'): 出力形式（既定 'markdown'）

Returns (json): { count, storyboards: [{ id, title, sceneCount, cutCount }] }

Use when: 「どの絵コンテがある？」「絵コンテの一覧」。次に list_cuts / get_cut_context で掘り下げる。`,
      inputSchema: { response_format: responseFormat },
      outputSchema: {
        count: z.number(),
        storyboards: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            sceneCount: z.number(),
            cutCount: z.number(),
          }),
        ),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ response_format }) => {
      try {
        const storyboards = await listStoryboards(config);
        const structured = { count: storyboards.length, storyboards };
        if (storyboards.length === 0) {
          return {
            content: [{ type: 'text', text: '絵コンテがありません。' }],
            structuredContent: structured,
          };
        }
        const text =
          response_format === 'json'
            ? jsonText(structured)
            : [
                `# 絵コンテ一覧（${storyboards.length} 件）`,
                '',
                ...storyboards.map(
                  (s) =>
                    `- **${s.title}** (\`${s.id}\`) — ${s.sceneCount}シーン / ${s.cutCount}カット`,
                ),
              ].join('\n');
        return { content: [{ type: 'text', text }], structuredContent: structured };
      } catch (error) {
        return { content: [{ type: 'text', text: errorText(error) }], isError: true };
      }
    },
  );

  // ── list_cuts ──
  server.registerTool(
    'scenariolab_list_cuts',
    {
      title: 'List cuts of a ScenarioLab storyboard',
      description: `指定した絵コンテのシーン→カット構造を一覧する。未着画（構図メモが空）のカット特定に使う。

Args:
  - script_id (string): 対象の絵コンテ ID（list_storyboards の id）
  - response_format ('markdown' | 'json'): 出力形式（既定 'markdown'）

Returns (json): { scriptId, title, totalCuts, totalSeconds, scenes: [{ id, title, order,
  cuts: [{ id, cutNumber, timeSec, hasPicture, camera }] }] }

Use when: 「S1 のカット一覧」「まだ絵の指定が無いカットは？」。詳細は get_cut_context。`,
      inputSchema: {
        script_id: z.string().min(1, 'script_id は必須です').describe('絵コンテ ID'),
        response_format: responseFormat,
      },
      outputSchema: {
        scriptId: z.string(),
        title: z.string(),
        totalCuts: z.number(),
        totalSeconds: z.number(),
        scenes: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            order: z.number(),
            cuts: z.array(
              z.object({
                id: z.string(),
                cutNumber: z.string(),
                timeSec: z.number().nullable(),
                hasPicture: z.boolean(),
                camera: z.string(),
              }),
            ),
          }),
        ),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ script_id, response_format }) => {
      try {
        const script = await getStoryboardScript(config, script_id);
        if (!script) {
          return {
            content: [{ type: 'text', text: `絵コンテが見つかりません: ${script_id}` }],
            isError: true,
          };
        }
        const scenes = [...script.storyboardContent.scenes]
          .sort((a, b) => a.order - b.order)
          .map((sc) => ({
            id: sc.id,
            title: sc.title || '(無題シーン)',
            order: sc.order,
            cuts: [...sc.cuts]
              .sort((a, b) => a.order - b.order)
              .map((c) => ({
                id: c.id,
                cutNumber: c.cutNumber,
                timeSec: c.timeSec,
                hasPicture: Boolean(c.picture && c.picture.trim()),
                camera: formatCamera(c),
              })),
          }));
        const structured = {
          scriptId: script.id,
          title: script.title,
          totalCuts: countCuts(script.storyboardContent),
          totalSeconds: totalSeconds(script.storyboardContent),
          scenes,
        };
        const text =
          response_format === 'json'
            ? jsonText(structured)
            : [
                `# ${script.title}（${structured.totalCuts}カット / ${formatDuration(structured.totalSeconds)}）`,
                '',
                ...scenes.flatMap((sc) => [
                  `## ${sc.title} (\`${sc.id}\`)`,
                  ...sc.cuts.map(
                    (c) =>
                      `- ${c.cutNumber} (\`${c.id}\`)${c.hasPicture ? '' : ' ⚠️未着画'}` +
                      `${c.camera ? ` — ${c.camera}` : ''}${c.timeSec != null ? ` — ${c.timeSec}s` : ''}`,
                  ),
                  '',
                ]),
              ].join('\n');
        return { content: [{ type: 'text', text }], structuredContent: structured };
      } catch (error) {
        return { content: [{ type: 'text', text: errorText(error) }], isError: true };
      }
    },
  );

  // ── get_cut_context ──
  server.registerTool(
    'scenariolab_get_cut_context',
    {
      title: 'Get drawing context for a ScenarioLab cut',
      description: `1カットの作画コンテキストを取得する。ホスト側の画像生成にそのまま使える形（プロンプト案付き）で返す。

Args:
  - script_id (string): 絵コンテ ID
  - cut_id (string): カット ID（list_cuts の cuts[].id）
  - response_format ('markdown' | 'json'): 出力形式（既定 'markdown'）

Returns (json): { scriptId, sceneId, sceneTitle, cutId, cutNumber, picture, action,
  dialogue, camera, aspect: { w, h }, style, promptDraft }

promptDraft は 構図メモ＋カメラ指示＋アスペクト比＋スタイル から組成済み。定額プランの
画像生成にそのまま渡せる。生成した画像はアプリの「貼り付け」ボタンで取り込む。`,
      inputSchema: {
        script_id: z.string().min(1, 'script_id は必須です').describe('絵コンテ ID'),
        cut_id: z.string().min(1, 'cut_id は必須です').describe('カット ID'),
        response_format: responseFormat,
      },
      outputSchema: {
        scriptId: z.string(),
        sceneId: z.string(),
        sceneTitle: z.string(),
        cutId: z.string(),
        cutNumber: z.string(),
        picture: z.string(),
        action: z.string(),
        dialogue: z.string(),
        camera: z.string(),
        aspect: z.object({ w: z.number(), h: z.number() }),
        style: z.string(),
        promptDraft: z.string(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ script_id, cut_id, response_format }) => {
      try {
        const script = await getStoryboardScript(config, script_id);
        if (!script) {
          return {
            content: [{ type: 'text', text: `絵コンテが見つかりません: ${script_id}` }],
            isError: true,
          };
        }
        let found: { scene: { id: string; title: string }; cut: StoryboardCut } | null = null;
        for (const sc of script.storyboardContent.scenes) {
          const cut = sc.cuts.find((c) => c.id === cut_id);
          if (cut) {
            found = { scene: { id: sc.id, title: sc.title || '(無題シーン)' }, cut };
            break;
          }
        }
        if (!found) {
          return {
            content: [
              {
                type: 'text',
                text: `カットが見つかりません: ${cut_id}（list_cuts で ID を確認してください）`,
              },
            ],
            isError: true,
          };
        }
        const { scene, cut } = found;
        const aspect = resolveFrameAspect(script.storyboardSettings?.frameAspect);
        const structured = {
          scriptId: script.id,
          sceneId: scene.id,
          sceneTitle: scene.title,
          cutId: cut.id,
          cutNumber: cut.cutNumber,
          picture: cut.picture ?? '',
          action: cut.action ?? '',
          dialogue: cut.dialogue ?? '',
          camera: formatCamera(cut),
          aspect: { w: aspect.w, h: aspect.h },
          style: DEFAULT_IMAGE_STYLE,
          promptDraft: buildImagePrompt(cut, aspect),
        };
        const text =
          response_format === 'json'
            ? jsonText(structured)
            : [
                `# ${script.title} / ${scene.title} / ${cut.cutNumber}`,
                '',
                `- アスペクト比: ${aspect.w}:${aspect.h}`,
                `- カメラ: ${structured.camera || '(未設定)'}`,
                `- 構図: ${structured.picture || '(未入力)'}`,
                `- 内容: ${structured.action || '(未入力)'}`,
                `- セリフ/音: ${structured.dialogue || '(なし)'}`,
                '',
                '## 生成プロンプト（そのまま画像生成に使える）',
                '',
                structured.promptDraft,
              ].join('\n');
        return { content: [{ type: 'text', text }], structuredContent: structured };
      } catch (error) {
        return { content: [{ type: 'text', text: errorText(error) }], isError: true };
      }
    },
  );
}

function errorText(error: unknown): string {
  return `Error: ${error instanceof Error ? error.message : String(error)}`;
}

function printHelp(): void {
  process.stdout.write(
    [
      'scenariolab-mcp-server (read-only, Phase 1a)',
      '',
      'Tools: scenariolab_list_storyboards, scenariolab_list_cuts, scenariolab_get_cut_context',
      '',
      'Required environment:',
      '  SCENARIOLAB_OWNER_UID        自分の Firebase Auth UID',
      '  SCENARIOLAB_SERVICE_ACCOUNT  サービスアカウント鍵(JSON)の絶対パス',
      '                               （GOOGLE_APPLICATION_CREDENTIALS でも可）',
      'Optional:',
      '  SCENARIOLAB_PROJECT_ID       既定 scenario-lab-studio',
      '',
      'Runs over stdio; register in your MCP host config. See README.md.',
      '',
    ].join('\n'),
  );
}

async function main(): Promise<void> {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printHelp();
    return;
  }

  let config: ServerConfig;
  try {
    config = loadConfig();
  } catch (error) {
    console.error(errorText(error));
    process.exit(1);
    return;
  }

  const server = new McpServer({ name: 'scenariolab-mcp-server', version: '0.1.0' });
  registerTools(server, config);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('scenariolab-mcp-server running (stdio)');
}

main().catch((error) => {
  console.error(errorText(error));
  process.exit(1);
});
