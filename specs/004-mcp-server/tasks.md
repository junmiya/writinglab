# Tasks: ScenarioLab MCP サーバー（C案 Phase 1）

**Input**: [spec.md](./spec.md)

## Phase 1a: 読み取り専用（インフラ追加なし）

- [x] T201 `mcp-server/` ワークスペース新設（`package.json`/`tsconfig.json`、root workspaces 登録、`@modelcontextprotocol/sdk`＋`firebase-admin`＋`zod`）
- [x] T202 `src/storyboard.ts`: frontend からのピュアロジック最小コピー（`formatCamera`/`resolveFrameAspect`/`buildImagePrompt`/`DEFAULT_IMAGE_STYLE`＋型）
- [x] T203 `src/config.ts`: 環境変数の読込・検証（OWNER_UID／サービスアカウント必須、起動時に actionable エラー）
- [x] T204 `src/firestore.ts`: firebase-admin 初期化、`listStoryboards`／`getStoryboardScript`（`ownerId==自分` を強制・SC-M3）
- [x] T205 `src/index.ts`: `registerTool` で3ツール（list_storyboards / list_cuts / get_cut_context）。Zod 入出力スキーマ、`readOnlyHint`、markdown/json 両対応、CHARACTER_LIMIT 切り詰め、stdio 接続、`--help`
- [x] T206 検証: `npm run build` 緑、`node dist/index.js --help`、未設定時の actionable エラー、stdio スモーク（initialize→tools/list に3ツール）
- [x] T207 `README.md`: セットアップ（鍵・UID・Claude Desktop 登録）＋定額プランのループ手順

## Phase 1b: 書き込み（保存先決定後）

- [ ] T210 §5 の保存先を決定（S1 Firebase Storage / S2 アプリローカルファイル）
- [ ] T211 `attach_image`（`script_id`/`cut_id`/`dataB64`|`filePath`/`mime`/`note?`）→ 決定した保存先へ書き込み。FR-119 と同じ検証（image/* のみ・非破壊）

## Phase 2: アプリ統合

- [ ] T220 Tauri 版に MCP サーバーを同梱、画像はローカルファイル（S2）

## Notes

- `mcp-server/` は独立性のため frontend のピュアロジックをコピー（大きな共有はしない）。frontend 側の式を変えたら同期する。
- root CI: `typecheck` はワークスペース横断で mcp-server も対象。lint/format/test スクリプトは未定義なので `--if-present` でスキップ（緑維持）。
- 画像は Firestore 非保存（FR-117）。get_cut_context が返すのは構図・カメラ・比率・プロンプト案（テキストのみ）。
