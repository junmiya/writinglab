# Tasks: 登場人物リスト＋画像、カット生成での参照（005）

**Input**: [spec.md](./spec.md)

## Phase A: データモデル

- [x] T201 `types/storyboard.ts`: `StoryboardCharacter`（id/name/description/image?）、`StoryboardContent.characters?`、`StoryboardCut.characterIds?`（任意・後方互換）
- [x] T202 `editorStore.ts`: 登場人物 CRUD（add/update/remove/move）＋`toggleCutCharacter`。`removeCharacter` は参照カットから自動リンク解除。`updateCut` allow-list に `characterIds`
- [x] T203 `stripStoryboardImages` を拡張し、カット画像＋人物画像を除去（FR-203）。バックアップは内包で往復

## Phase B: 共通画像スタジオ＋人物パネル

- [x] T204 `ImageStudio.tsx` 新設: 操作行（生成/添付/貼り付け/プロンプト）＋バージョン履歴＋議論修正ループを汎用化（`ImageStudioControls`）。`blobToB64`/`adoptedVersion`/`emptyImage` 共用
- [x] T205 `CutImagePanel.tsx` を `ImageStudioControls` へ委譲するよう再構成（挙動不変＋参照画像対応）
- [x] T206 `CharacterPanel.tsx` 新設: 名前＋容姿＋ポートレート枠＋スタジオ。並べ替え/削除

## Phase C: 画像サービス（参照生成・プロンプト）

- [x] T207 `openaiImageService.ts`: `generateWithReferences`（gpt-image-1 edits 複数参照画像）、`buildCharacterPrompt`、`buildImagePrompt` に登場人物パラメータ追加
- [x] T208 `characterGenerateService.ts`: 脚本（登場人物表＋本文）→ AI JSON → `[{name,description}]`（防御的パース・非破壊、FR-204）

## Phase D: エディタ配線

- [x] T209 `StoryboardEditor.tsx`: 「登場人物」セクション（カード grid＋追加＋脚本から生成）
- [x] T210 カット行に登場人物マルチ選択チップ（`toggleCutCharacter`）＋`referencedCharacters` を CutImagePanel へ（anime/film 両方）

## Phase E: MCP 連携

- [x] T211 `mcp-server`: `StoryboardCharacter`/`characterIds` 型追加、`buildImagePrompt` に登場人物、`get_cut_context` が参照人物（name/description）を出力＋プロンプトへ反映

## Phase F: テスト・検証

- [x] T212 ユニット: 登場人物 CRUD・リンク解除・strip・バックアップ往復・`buildCharacterPrompt`・`buildImagePrompt`（登場人物行）（66 passed）
- [x] T213 コンポーネント（happy-dom）: `CharacterPanel` の名前/容姿/操作ボタン/プロンプト/採用画像表示（22 passed）
- [x] T214 検証一式: typecheck 3ws / lint 0 / build（frontend＋mcp）/ MCP stdio スモーク（get_cut_context に characters）
- [ ] T215 実機確認（ユーザー）: 人物追加→画像添付/生成→カットで参照→BYOK 生成が参照画像を反映（SC-202、要 OpenAI キー）

## Notes

- 画像は Firestore 非保存（FR-203）。人物の name/description は保存されるため MCP から参照可。
- カット参照の自動推定（AI）・人物の作品横断ライブラリ化は後続（spec §5）。
