# Spec: ScenarioLab MCP サーバー（C案 Phase 1）

**Status**: ドラフト（未承認・実装前にレビュー必須 / 憲章 I: Spec-Driven Delivery）
**前提**: specs/003 FR-119（画像の添付）実装済み。C案（アプリファースト・個人利用から開始）。

## 1. 目的と経済性

ユーザーの**定額プラン AI（Claude Desktop / ChatGPT Desktop 等の MCP ホスト）**から
ScenarioLab のカット情報を読み取り、ホスト側で生成した絵コンテ画像を取り込めるようにする。

- **制御の向き**: ホスト（AI クライアント）→ MCP サーバー（ScenarioLab）。
  アプリ側からユーザーの定額枠をプログラム呼び出しすることは**できない**（Session 4 で確認済み）。
  よって「AI がツールを呼ぶ」形にすれば、テキスト生成・画像生成ともユーザーの定額内で完結する。
- BYOK（OpenAI キー従量課金）は**併存**。ワンクリック生成が欲しい場面は BYOK、
  コストゼロ運用は MCP 経由 + 添付（FR-119）。

## 2. User Stories

- **US-M1（読み取り）**: 私は Claude/ChatGPT に「S1 C-3 の絵コンテ画像を描いて」と頼むと、
  AI が `get_cut_context` で構図メモ・カメラ指示・アスペクト比・スタイル指定を取得し、
  定額枠の画像生成でラフを作ってくれる。
- **US-M2（書き込み）**: 生成された画像を AI が `attach_image` で該当カットの
  バージョン履歴（FR-116/119 と同一パイプライン）へ追加してくれる。
- **US-M3（一覧）**: 「どの絵コンテがある？」→ `list_storyboards` / `list_cuts` で
  作品・シーン・カットを列挙し、未着画（画像なし）カットを教えてくれる。

## 3. ツール定義（MVP）

| ツール | 引数 | 返り値 | 備考 |
|---|---|---|---|
| `list_storyboards` | なし | `{ id, title, sceneCount, cutCount }[]` | contentType==='storyboard' のみ |
| `list_cuts` | `scriptId` | シーン→カットの階層（cutNumber, picture 有無, image 有無, timeSec） | 未着画カットの特定用 |
| `get_cut_context` | `scriptId, cutId` | `{ cutNumber, picture, action, dialogue, camera（formatCamera 文字列）, aspect: {w,h}, style（既定: 絵コンテ用モノクロラフ）, promptDraft（buildImagePrompt 相当） }` | ホスト AI がそのまま画像生成に使える形 |
| `attach_image` | `scriptId, cutId, filePath または dataB64, mime, note?` | `{ versionId }` | FR-119 と同じ検証（image/* のみ・非破壊） |

## 4. アーキテクチャ

```
Claude/ChatGPT Desktop（定額）
   │ MCP (stdio)
   ▼
scenariolab-mcp（Node, リポジトリ内 workspace: mcp-server/）
   │ firebase-admin（読み取り: Firestore scripts）
   │ 画像書き込み: §5 の選択肢による
   ▼
ScenarioLab データ
```

- **トランスポート**: stdio（ローカル起動のみ。ネットワーク非公開）
- **認証**: サービスアカウント鍵を `~/.config/scenario-lab-secrets/` から読む
  （リポジトリ外・gitignore 済みの既存運用に合わせる）。`ownerId == 自分` のドキュメントのみ対象。
- **既存資産の再利用**: `formatCamera` / `buildImagePrompt` / `resolveFrameAspect` /
  バックアップ JSON スキーマ（`scenario-lab-storyboard` v1）をそのまま import
  （frontend の純関数群は Node で動く）。

## 5. `attach_image` の画像保存先（要決定）

| 案 | 内容 | 実装コスト | Web 版で見える | アプリ版適合 | 追加費用 | 評価 |
|---|---|---|---|---|---|---|
| **S1: Firebase Storage** | Storage バケット導入、カットに `imageUrl` | 中（storage.rules・UI 読込対応） | ◎ 即反映 | ○ | Storage 従量（微少） | **8/10** |
| S2: アプリローカルファイル | Tauri 版で `dataB64`→ファイルパス差替（FR-117 想定済み） | 中（アプリ化とセット） | ✕（アプリ専用） | ◎ | なし | 7/10（アプリ化後は本命） |
| S3: バックアップ JSON 経由 | MCP が JSON バックアップを生成→ユーザーが復元 | 小 | △ 手動復元 | △ | なし | 5/10 |
| S4: Firestore に base64 | 1MB 制限に抵触しやすい | 小 | ○ | ○ | — | 2/10（FR-117 違反） |

**おすすめ**: **Phase 1a は読み取り専用（`list_*` + `get_cut_context`）で即着手**し、
書き込みは「Web 継続なら S1 / アプリ化着手なら S2」をアプリ化判断時に決める。
理由: 読み取り 3 ツールだけでも「ChatGPT で描いて→貼り付けボタン（FR-119）で取り込み」の
ループが成立し、新規インフラゼロで定額運用が始められるため。

## 6. フェーズ

- **Phase 1a（読み取り・インフラ追加なし）**: `mcp-server/` workspace 新設、
  `list_storyboards` / `list_cuts` / `get_cut_context`。取り込みは FR-119 の貼り付けボタン（手動）。
- **Phase 1b（書き込み）**: `attach_image`。保存先は §5 の決定に従う。
- **Phase 2（アプリ統合）**: Tauri 版に MCP サーバーを同梱、画像はローカルファイル（S2）。

## 7. Success Criteria

- **SC-M1**: Claude Desktop から「C-1 の画像コンテキストをちょうだい」→ 正しい構図・カメラ・比率が 5 秒以内に返る。
- **SC-M2**: 画像生成〜取り込みまで ScenarioLab 側の API 費用 **0 円**（定額枠のみ）。
- **SC-M3**: MCP サーバー経由で他ユーザーのドキュメントにアクセスできた事例 0 件。

## 8. スコープ外

グループ・コンテスト連携、Maya/Blender 等の制作ツール接続（別 spec）、リモート MCP（SSE/HTTP）公開。
