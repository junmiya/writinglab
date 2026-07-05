# Tasks: 絵コンテモード追加（storyboard）

**Input**: [spec.md](./spec.md)（承認済み実装計画は `/Users/muli/.claude/plans/smooth-snacking-rose.md` 由来。plan の要点は spec に統合済み）

## Phase 1: 基盤（contentType 3値化 + modes/storyboard）

- [x] T101 `frontend/src/types/storyboard.ts` 新規: StoryboardCut/Scene/Content/Settings 型＋createEmpty ヘルパー（FR-102/104/105）
- [x] T102 ContentType union 3値化: `frontend/src/lib/firebase/firestoreService.ts` / `frontend/src/stores/editorStore.ts` / `frontend/src/modes/types.ts` と `resolveScriptContentType`/`resolveContentType`（未知値→screenplay 維持、FR-101）
- [x] T103 `FirestoreScript` に `storyboardContent`/`storyboardSettings`/`storyboardDiscussion`/`sourceScriptId` 追加＋`updateScript` allow-list（FR-106）
- [x] T104 `frontend/src/modes/storyboard/` 新規: defaults/toolbar/structure/prompts/exportProfile → `modes/index.ts` 登録（FR-101）
- [x] T105 `FeatureFlags.storyboardMode`（firestoreService/FeatureFlagsContext/AdminUsersPage）（FR-112）
- [x] T106 CatalogPage: モーダル3択化（絵コンテ）＋バッジ（「絵コンテ」）＋新規タイトル
- [x] T107 [P] resolve 3値のユニットテスト＋既存 screenplay.snapshot 回帰緑

## Phase 2: エディタ MVP（US1/US2）

- [x] T110 `editorStore.ts`: EditorState に storyboard フィールド、シーン/カット CRUD（add/update/remove/move/renumber）、カット番号自動採番、合計尺計算（FR-102/105）
- [x] T111 [P] `frontend/src/components/editor/SceneList.tsx`（ChapterList パターン）
- [x] T112 `frontend/src/components/editor/StoryboardEditor.tsx`: 書式設定（用紙切替）＋SceneList＋カット表（anime 5欄 / film フレーム主体）＋合計表示（FR-104/105）
- [x] T113 `EditorPage.tsx`: storyboard 分岐（ヘッダ「絵コンテエディタ」）＋load/save 拡張（FR-106）
- [x] T114 [P] ユニットテスト: カット CRUD・採番・合計尺（`frontend/tests/unit/storyboard.test.ts`）
- [x] T115 [P] 統合テスト: 作成→編集→保存→再ロード往復（`frontend/tests/integration/storyboardCreateAndPersist.test.ts`）

## Phase 3: AI（US3/US4）

- [x] T120 汎用化: `AiAdvicePanel`（experts props）/`AiDiscussionPanel`（roleA/roleB props）を新設し、novel を移行（挙動不変、FR-109）
- [x] T121 `modes/storyboard/prompts.ts`: アドバイス3ロール（演出家/撮影/編集）＋対話（監督 vs 編集技師）（FR-107/108）
- [x] T122 StoryboardEditor に AI アドバイス（カット表上下・タブ）＋対話批評（履歴永続化・介入）配線
- [x] T123 `frontend/src/services/storyboardGenerateService.ts`: 脚本選択→AI JSON 生成→検証→反映（上書き確認・失敗時非破壊・sourceScriptId 保存）（FR-110）
- [x] T124 [P] テスト: 生成 JSON パース堅牢性・プロンプト混線防止

## Phase 4: バックアップ＋仕上げ（US5）

- [x] T130 `frontend/src/services/storyboardBackupService.ts`: JSON v1（完全復元）＋Markdown（シーン見出し＋カット表）（FR-111）
- [x] T131 StoryboardEditor にバックアップ UI（3ボタン）
- [x] T132 [P] バックアップ往復テスト
- [ ] T133 検証一式（typecheck/lint/test/build）＋手動 quickstart＋PR ready→マージ

## Notes

- 同一ファイル直列: `firestoreService.ts`（T102/T103）、`editorStore.ts`（T102/T110）、`EditorPage.tsx`（T113）
- 画像添付・AI画像生成・docx/PDF・コンテスト対応はスコープ外（spec §4）
