# Feature Specification: 絵コンテモード追加（storyboard）

**Feature Branch**: `003-add-storyboard-mode`
**Created**: 2026-07-05
**Status**: Approved (Session 3 で方針確定)
**Input**: User description: "シナリオ、小説ときた。絵コンテモードの対応を進めたい"

---

## Clarifications

### Session 3 — 2026-07-05

| # | 質問 | 確定事項 | 反映先 |
|---|---|---|---|
| Q1 | 絵（画面欄）の扱い | **MVP は字コンテ（テキスト描写）**。画像添付（要 Firebase Storage）・AI 画像生成は後続 | FR-103 / スコープ外 |
| Q2 | 脚本からの変換 | **含める**: 既存脚本を選び AI がカット割り（シーン/カット/内容/セリフ/秒数）を自動生成 | FR-110 / US3 |
| Q3 | 用紙フォーマット | **アニメ標準5欄＋映画式の両対応**（設定でプリセット切替） | FR-104 |

---

## 0. 背景と目的

Scenario Lab は脚本（screenplay）・小説（novel）の 2 モードを提供している。第 3 のモードとして**絵コンテ（storyboard）**を追加し、映像制作の pre-production（脚本→絵コンテ）までを 1 サービスで完結できるようにする。

**採用アーキテクチャ**: 002 と同一（A案）。`contentType` に `'storyboard'` を追加し、`frontend/src/modes/storyboard/` プロファイルで差分を吸収。脚本・小説モードはリグレッションゼロ。

---

## 1. User Scenarios & Testing *(mandatory)*

### User Story 1 — 絵コンテを新規作成し、シーン/カットで執筆できる（Priority: P1）🎯 MVP

演出家・映像作家として、カタログから「絵コンテ」を選んで新規作成し、シーン＞カットの構造でカット表（画面・内容・セリフ・秒数）を書き、保存・再読み込みできる。

**Independent Test**: 絵コンテ新規作成→シーン追加→カット追加（5欄入力）→保存→再ロードで完全復元。既存脚本・小説は従来どおり開ける。

**Acceptance Scenarios**:
1. **Given** カタログで「新規作成」、**When**「絵コンテ」を選ぶ、**Then** `contentType: 'storyboard'` で作成され絵コンテエディタが開く。
2. **Given** 絵コンテエディタ、**When** シーンを追加しカットを追加、**Then** カット番号（C-1, C-2…）が自動採番され、5欄（カットNo/画面/内容/セリフ/秒数）を編集できる。
3. **Given** カットを編集した状態、**When** 保存→再読み込み、**Then** 全シーン・カット・秒数が一致し、合計カット数・合計尺（mm:ss）が表示される。
4. **Given** カットの上下移動・削除、**When** 操作する、**Then** カット番号が自動で振り直される。
5. **Given** 既存の脚本・小説、**When** 開く、**Then** 従来モードのエディタで開く（互換）。

### User Story 2 — 用紙フォーマットの切替（Priority: P1）

**Acceptance Scenarios**:
1. **Given** 書式設定、**When** 用紙を「アニメ式」⇄「映画式」で切替、**Then** 表示レイアウトのみ変わりデータは不変（ロスレス）。
2. アニメ式=5欄テーブル縦流れ。映画式=フレーム（画面描写）を大きく表示し、下に内容/セリフ。

### User Story 3 — 脚本からカット割りを AI 生成（Priority: P2）

**Acceptance Scenarios**:
1. **Given** 自分の脚本（screenplay）が 1 件以上ある状態、**When**「脚本からカット割り生成」で脚本を選ぶ、**Then** AI が柱・ト書き・セリフからシーン/カット割り（画面・内容・セリフ・秒数）を生成しカット表へ反映する。
2. **Given** 既存カットがある状態、**When** 生成を実行、**Then** 上書き確認の後に反映する。変換元 `sourceScriptId` が保存される。
3. **Given** AI 応答が不正 JSON、**When** パース失敗、**Then** エラーメッセージのみ表示し既存データは破壊しない。

### User Story 4 — AI アドバイス／対話批評（Priority: P2）

**Acceptance Scenarios**:
1. カット表の上下に AI 評価（**演出家／撮影／編集** のタブ形式）。カット割り・カメラワーク・テンポの観点で講評。
2. AI 対話批評（**監督 vs 編集技師**）: 「確認したいこと」入力、履歴永続化、著者介入で継続（小説と同機能）。

### User Story 5 — バックアップ（Priority: P2）

**Acceptance Scenarios**:
1. JSON バックアップ（`scenario-lab-storyboard` v1）→ 復元で完全一致。Markdown 書き出し（シーン見出し＋カット表）。

### Edge Cases

- `contentType` 未設定の既存ドキュメント → `'screenplay'` フォールバック（不変）。
- シーンゼロ／カットゼロ → 空状態ヒント表示。合計尺は 0:00。
- 秒数未入力カット → 合計尺計算では 0 扱い（null 許容）。
- AI 生成 JSON のパース失敗 → 既存データ非破壊でエラー表示のみ。
- 絵コンテはコンテスト・グループへ提出不可（UI 非表示、後続仕様）。

---

## 2. Requirements *(mandatory)*

### Functional Requirements

- **FR-101**: System MUST `contentType` に `'storyboard'` を追加し、`modes/storyboard/` プロファイル経由でツールバー・構成・プロンプト・デフォルトを解決する。未知値→`'screenplay'` フォールバックは維持。
- **FR-102**: System MUST シーン＞カットの 2 階層でカット表を管理し、カット番号を自動採番（編集可）、追加・削除・並替で振り直す。
- **FR-103**: System MUST 画面欄を**テキスト描写**で提供する（MVP）。画像添付・AI 画像生成はスコープ外（後続: Firebase Storage 導入とセット）。
- **FR-104**: System MUST 用紙プリセット（`anime` 5欄 / `film` フレーム主体）を書式設定で切替可能とし、切替はデータ不変（表示のみ）。
- **FR-105**: System MUST カットに秒数（null 許容）を持たせ、合計カット数・合計尺（mm:ss）を表示する。
- **FR-106**: System MUST 保存・再読み込みで全構造を復元する（Firestore: `storyboardContent`/`storyboardSettings`/`storyboardDiscussion`/`sourceScriptId`）。
- **FR-107**: System MUST AI アドバイス（演出家/撮影/編集・タブ形式）をカット表の上下に提供する。
- **FR-108**: System MUST AI 対話批評（監督 vs 編集技師、履歴永続化・著者介入つき）を提供する。
- **FR-109**: System MUST 汎用 AI パネル（`AiAdvicePanel`/`AiDiscussionPanel`）を導入し、小説モードも同パネルに移行する（挙動不変）。
- **FR-110**: System MUST 「脚本からカット割り生成」を提供する: 自分の screenplay を選択→AI が JSON でシーン/カット割りを生成→検証して反映（既存データは上書き確認、失敗時非破壊）。
- **FR-111**: System MUST JSON（完全復元）＋ Markdown（可読）バックアップを提供する。
- **FR-112**: System MUST `FeatureFlags.storyboardMode`（既定 true）で絵コンテ UI を即時オフできる。

### Constitution Alignment

- **CA-001**: US1 のみで MVP 成立。US 単位で独立テスト可能。
- **CA-002**: 脚本・小説モードは無変更（AI パネル汎用化は同値リファクタ、既存テストで担保）。
- **CA-003**: AI 呼び出しは既存 `callAi` 経路。Firestore は `ownerId` ベース・`contentType` 不変性ルールは値非依存で適用済み。
- **CA-005**: rollback タグ `pre-storyboard-impl`＋`storyboardMode` フラグ。構造化された段階コミット。

### Key Entities

- **StoryboardCut**: `id`, `order`, `cutNumber`, `picture`（テキスト描写）, `action`, `dialogue`, `timeSec: number|null`
- **StoryboardScene**: `id`, `title`, `order`, `cuts[]`
- **StoryboardContent**: `scenes[]`（ドキュメント内ネスト）
- **StoryboardSettings**: `paperFormat: 'anime'|'film'`
- **FirestoreScript 拡張**: `storyboardContent?`, `storyboardSettings?`, `storyboardDiscussion?`, `sourceScriptId?`

## 3. Success Criteria

- **SC-101**: 新規ユーザーが絵コンテ作成→カット 1 件保存まで **10 分以内**。
- **SC-102**: 保存成功率 **95% 以上**、再ロード完全復元。
- **SC-103**: 脚本→カット割り生成の成功率（パース成功）**90% 以上**、失敗時データ非破壊 100%。
- **SC-104**: 既存脚本・小説モードへの本仕様起因の不具合報告 **30 日間ゼロ件**。
- **SC-105**: AI 応答（アドバイス 3 タブ）**15 秒以内**。

## 4. スコープ外（後続）

画像添付（Firebase Storage 導入）、AI 画像生成、絵コンテ用紙の docx/PDF エクスポート、コンテスト・グループの storyboard 対応。
