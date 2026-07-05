# ScenarioLab MCP server（読み取り専用 / Phase 1a）

定額プランの MCP ホスト（Claude Desktop / ChatGPT Desktop 等）から、自分の**絵コンテのカット情報**を読み取れるようにする MCP サーバーです。ホスト側の画像生成にそのまま渡せる「プロンプト案」を返すので、**ホストの定額枠だけ**で絵コンテのラフを描けます（ScenarioLab 側の API 費用ゼロ）。

- 仕様: [`specs/004-mcp-server/spec.md`](../specs/004-mcp-server/spec.md)
- トランスポート: stdio（ローカル起動のみ・ネットワーク非公開）
- アクセス範囲: `ownerId == 自分` の絵コンテのみ（他ユーザーには一切アクセスしない）

## 提供ツール

| ツール                         | 用途                                              |
| ------------------------------ | ------------------------------------------------- |
| `scenariolab_list_storyboards` | 自分の絵コンテ作品を一覧                          |
| `scenariolab_list_cuts`        | 指定作品のシーン→カット構造（未着画カットの特定） |
| `scenariolab_get_cut_context`  | 1カットの作画コンテキスト＋生成プロンプト案       |

> 画像の**書き戻し**（`attach_image`）は保存先の決定（Firebase Storage / アプリのローカルファイル）待ちで Phase 1b に分離しています。現状は、生成した画像をアプリの絵コンテ画面の「**貼り付け**」ボタンで取り込みます（FR-119）。

## セットアップ

### 1. サービスアカウント鍵

Firebase コンソール → プロジェクト設定 → サービスアカウント → 「新しい秘密鍵の生成」で JSON を取得し、**リポジトリ外**（例: `~/.config/scenario-lab-secrets/`）に保存します。鍵は絶対にコミットしないでください。

### 2. 自分の UID

ScenarioLab にログインした状態で、Firebase コンソール → Authentication → ユーザー、から自分の UID を控えます。

### 3. ビルド

```bash
npm install                       # リポジトリ直下（ワークスペース）
npm run build --workspace @scenario-lab/mcp-server
```

`dist/index.js` が生成されます。`node dist/index.js --help` で必要な環境変数を確認できます。

### 4. MCP ホストに登録

Claude Desktop の設定ファイル（`claude_desktop_config.json`）例:

```json
{
  "mcpServers": {
    "scenariolab": {
      "command": "node",
      "args": ["/絶対パス/ScenarioLab/mcp-server/dist/index.js"],
      "env": {
        "SCENARIOLAB_OWNER_UID": "あなたの Firebase Auth UID",
        "SCENARIOLAB_SERVICE_ACCOUNT": "/Users/you/.config/scenario-lab-secrets/xxx.json"
      }
    }
  }
}
```

| 環境変数                      | 必須 | 説明                                                                            |
| ----------------------------- | ---- | ------------------------------------------------------------------------------- |
| `SCENARIOLAB_OWNER_UID`       | ✅   | 自分の Firebase Auth UID                                                        |
| `SCENARIOLAB_SERVICE_ACCOUNT` | ✅   | サービスアカウント鍵(JSON)の絶対パス（`GOOGLE_APPLICATION_CREDENTIALS` でも可） |
| `SCENARIOLAB_PROJECT_ID`      | —    | 既定 `scenario-lab-studio`                                                      |

## 使い方（定額プランのループ）

1. ホストで「◯◯の絵コンテのカット一覧を見せて」→ `scenariolab_list_cuts`
2. 「このカットを描いて」→ `scenariolab_get_cut_context` が `promptDraft` を返す
3. ホストの画像生成（定額枠）でラフを作成
4. 画像をコピー → ScenarioLab の絵コンテ画面で「**貼り付け**」→ 該当カットに取り込み

## 開発

```bash
npm run dev --workspace @scenario-lab/mcp-server        # tsx watch
npm run typecheck --workspace @scenario-lab/mcp-server
npx @modelcontextprotocol/inspector node dist/index.js  # 手動検査（要 env）
```
