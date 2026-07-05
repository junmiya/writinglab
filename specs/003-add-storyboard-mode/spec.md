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

### Session 4 — 2026-07-05（画面再設計＋画像生成）

| # | 質問 | 確定事項 | 反映先 |
|---|---|---|---|
| Q4 | カット行の配置 | **絵（画面）→ 指示欄 → セリフ欄** の順に横並び。No.＋秒数は左端の細列、シーン一覧は左レール、AI パネルは下部折りたたみ（モックアップ承認済み） | FR-118 / US6 |
| Q5 | フレームのアスペクト比 | 16:9 固定ではなく **プリセット2種（16:9 TV/アニメ・2.35:1 シネスコ）＋カスタム比率入力** | FR-113 |
| Q6 | 絵の生成 | **OpenAI GPT Image（最新世代、ユーザー指定: GPT Image 2。モデル ID は実装時に確認）** で生成し、**生成後に議論（フィードバック）→ 修正を繰り返せる**。バージョン履歴・採用/差し戻し | FR-115/116 |
| Q7 | カメラ指示 | **ドロップダウン選択**: サイズ（開始→終了の遷移対応、例 WS→MS）＋カメラワーク＋自由記述 | FR-114 |
| Q8 | 費用・キー | C案方針に従い **BYOK**（ユーザー自身の OpenAI API キーを設定画面で入力・ローカル保存）。従量費用はユーザー負担 | FR-115 |

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

### User Story 6 — 画面再設計・カメラ指示・画像生成と修正議論（Priority: P1.5, Session 4）

演出家として、整理されたカット表（絵→指示→セリフ）でカメラ指示をドロップダウン選択し、絵枠に AI で画像を生成、フィードバックで修正を重ねて採用したい。

**Acceptance Scenarios**:
1. **Given** 書式設定、**When** アスペクトを 16:9 / 2.35:1 / カスタム（例 1.85:1）で切替、**Then** 全カットの絵枠と以後の生成サイズが追従し、既存データ・既存画像は破壊されない（FR-113）。
2. **Given** カットの指示欄、**When** サイズ開始 WS・終了 MS・ワーク T.U を選択、**Then** 構造化保存され、カット表に「WS→MS / T.U」と表示、AI アドバイスと画像生成プロンプトに反映される（FR-114）。
3. **Given** OpenAI キー設定済みのカット、**When**「画像を生成」を押す、**Then** 構図メモ＋カメラ指示＋アスペクトからプロンプトが組成され、絵コンテ風ラフ画像が枠に表示される（FR-115）。
4. **Given** 生成済みの画像、**When** 議論スレッドに「ローアングルにして人物を左へ」と入力、**Then** 画像編集 API で新バージョンが追加され、履歴から任意版を採用/差し戻しできる（FR-116）。
5. **Given** API エラー/不正応答、**When** 生成・修正が失敗、**Then** 採用中の画像とカットデータは不変で、エラーメッセージのみ表示（FR-116/SC-103 準拠）。
6. **Given** キー未設定、**When** 絵枠を見る、**Then** 生成ボタンは無効で「設定画面で OpenAI API キーを入力」と案内される（FR-115 BYOK）。
7. **Given** 再設計後の画面、**When** カット行を見る、**Then** 左から No.＋秒数／絵／指示／セリフの順で、シーン一覧は左レール、AI パネルは下部折りたたみになっている（FR-118）。

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

#### Session 4 追加（画面再設計＋画像生成）

- **FR-113（アスペクト比）**: System MUST フレームのアスペクト比を書式設定で選択可能とする。プリセット **16:9（TV/アニメ）** と **2.35:1（シネスコ/映画）** に加え、**カスタム比率**（横:縦の数値入力、例 1.85:1、4:3）を許容する。比率はカット表の絵枠表示・画像生成サイズ・レターボックス表示に一貫適用され、**変更してもデータは不変**（表示と生成パラメータのみ）。
- **FR-114（カメラ指示ドロップダウン）**: System MUST 各カットにカメラ指示を**構造化フィールド**として持たせ、ドロップダウンで選択できるようにする。
  - **サイズ**: `ELS(大ロング)/LS(ロング)/FS(フル)/KS(ニー)/WS(ウエスト)/MS(ミディアム)/BS(バスト)/CU(アップ)/ECU(ドアップ)` の開始サイズ＋**任意の終了サイズ**（例 **WS→MS** のような寄り/引きの遷移を表現）。
  - **カメラワーク**: `FIX / PAN左 / PAN右 / TILT UP / TILT DOWN / T.U(トラックアップ) / T.B(トラックバック) / ZOOM IN / ZOOM OUT / FOLLOW / 手持ち / その他`。
  - 併せて**自由記述メモ**（picture フィールド）を維持。既存カット（フィールド未設定）は空欄として後方互換。選択値は AI アドバイス・画像生成プロンプトに構造化されて渡る。
- **FR-115（画像生成・GPT Image）**: System MUST カットの絵枠に **OpenAI GPT Image（最新世代。実装時にモデル ID 確認）** による画像生成を提供する。
  - プロンプトは **構図メモ（picture）＋カメラ指示（FR-114）＋アスペクト比（FR-113）＋スタイル**（既定: 絵コンテ用モノクロラフ／鉛筆線画。カラー等へ変更可）から自動組成。
  - **BYOK**: OpenAI API キーは設定画面でユーザーが入力し、**ローカルにのみ保存**（サーバー送信しない）。キー未設定時は生成 UI を無効化し案内を表示。従量費用はユーザー負担。
  - 生成サイズは選択アスペクトに最も近い API 対応サイズを自動選択し、枠内はレターボックスで表示。
- **FR-116（生成後の議論・修正ループ）**: System MUST 生成画像に対して**カット単位の議論スレッド**を提供する。
  - ユーザーがフィードバック（例:「もっとローアングルに」「人物を左に寄せて」）を入力 → **画像編集 API（前バージョン画像＋修正指示）** で新バージョンを生成。
  - **バージョン履歴**（サムネイル一覧）から任意の版を**採用/差し戻し/削除**できる。採用版がカット表の絵枠に表示される。
  - 生成失敗・API エラー時は既存の採用版とデータを**破壊しない**（エラーメッセージのみ）。
- **FR-117（画像の保存方針）**: 画像は Firestore ドキュメントに保存しない（1MB 制限）。**アプリ版はローカルファイル、Web 版はセッション内保持＋JSON バックアップへの base64 内包**で永続化する（Firebase Storage 導入は後続。導入時にクラウド保存へ拡張）。
- **FR-118（画面再設計）**: System MUST 承認済みモックアップに従い絵コンテ画面を再配置する。
  - カット行: 左から **No.＋秒数（細列）→ 絵（アスペクト比準拠の枠）→ 指示欄（カメラドロップダウン＋内容）→ セリフ・音欄**。
  - シーン一覧は左レール、AI 評価・AI 対話批評は**下部の折りたたみセクション**、書式設定・バックアップ等の低頻度機能はヘッダーメニューへ集約。
  - 列幅比の初期値: 絵=約4割、指示:セリフ=1:1（実装後の実機確認で調整可）。
- **FR-119（画像の添付・Session 4 追補）**: System MUST 絵枠へ**ローカル画像の取り込み**を提供する（API キー不要。ChatGPT 等の定額プランで生成した絵の受け皿）。
  - 経路は 2 つ: **ファイル選択**（`image/*`）と**クリップボード貼り付け**（Clipboard API。権限拒否時はエラーメッセージのみ）。
  - **プロンプト提示**: 「プロンプト」ボタンで、API 経路と同一組成（`buildImagePrompt` = 構図＋カメラ指示＋アスペクト＋スタイル）を表示・コピーできる。ChatGPT 等の定額プランに貼り付けて生成 → 画像をコピー → 「貼り付け」で取り込む導線。
  - 添付画像は生成画像と同じ **バージョン履歴**（FR-116）に「添付: ファイル名」として追加され、採用/差し戻し/削除・修正ループ（画像編集 API）の起点にできる。
  - `CutImageVersion.mime?`（省略時 `image/png`）で JPEG/WebP 等を保持し、表示・編集 API・JSON バックアップ（FR-117）で MIME を維持する。非画像ファイルは拒否（データ非破壊）。

### Constitution Alignment

- **CA-001**: US1 のみで MVP 成立。US 単位で独立テスト可能。
- **CA-002**: 脚本・小説モードは無変更（AI パネル汎用化は同値リファクタ、既存テストで担保）。
- **CA-003**: AI 呼び出しは既存 `callAi` 経路。Firestore は `ownerId` ベース・`contentType` 不変性ルールは値非依存で適用済み。
- **CA-005**: rollback タグ `pre-storyboard-impl`＋`storyboardMode` フラグ。構造化された段階コミット。

### Key Entities

- **StoryboardCut**: `id`, `order`, `cutNumber`, `picture`（テキスト描写）, `action`, `dialogue`, `timeSec: number|null`
- **StoryboardScene**: `id`, `title`, `order`, `cuts[]`
- **StoryboardContent**: `scenes[]`（ドキュメント内ネスト）
- **StoryboardSettings**: `paperFormat: 'anime'|'film'`、`frameAspect: { preset: '16:9'|'2.35:1'|'custom'; w: number; h: number }`（Session 4・FR-113）
- **StoryboardCut 拡張（Session 4）**: `cameraSizeStart?/cameraSizeEnd?: 'ELS'|'LS'|'FS'|'KS'|'WS'|'MS'|'BS'|'CU'|'ECU'`、`cameraWork?: 'FIX'|'PAN_L'|'PAN_R'|'TILT_UP'|'TILT_DOWN'|'TU'|'TB'|'ZOOM_IN'|'ZOOM_OUT'|'FOLLOW'|'HANDHELD'|'OTHER'`（FR-114）、`image?: CutImage`（FR-115/116）
- **CutImage**: `versions: { id, dataB64（アプリ版はファイルパス）, mime?（省略時 image/png・FR-119）, prompt, createdAt }[]`、`adoptedId?: string`、`chat: { role: 'user'|'ai', text, versionId?, timestamp }[]`。Firestore 非保存・JSON バックアップに内包（FR-117）
- **AppSettings（ローカルのみ）**: `openaiApiKey`（BYOK、FR-115）、`imageStyle`（既定: 絵コンテ風モノクロラフ）
- **FirestoreScript 拡張**: `storyboardContent?`, `storyboardSettings?`, `storyboardDiscussion?`, `sourceScriptId?`

## 3. Success Criteria

- **SC-101**: 新規ユーザーが絵コンテ作成→カット 1 件保存まで **10 分以内**。
- **SC-102**: 保存成功率 **95% 以上**、再ロード完全復元。
- **SC-103**: 脚本→カット割り生成の成功率（パース成功）**90% 以上**、失敗時データ非破壊 100%。
- **SC-104**: 既存脚本・小説モードへの本仕様起因の不具合報告 **30 日間ゼロ件**。
- **SC-105**: AI 応答（アドバイス 3 タブ）**15 秒以内**。
- **SC-106**（Session 4）: アスペクト切替・レイアウト再設計によるデータ損失 **0 件**（切替は表示のみ）。
- **SC-107**（Session 4）: 画像生成〜表示まで **30 秒以内**（1 枚）。修正ループ 1 往復も同等。
- **SC-108**（Session 4）: 生成・修正の失敗時に採用画像/カットデータが破壊された事例 **0 件**。API キーが端末外へ送信された事例 **0 件**（BYOK・ローカル保存）。

## 4. スコープ外（後続）

画像のクラウド保存（Firebase Storage 導入。ローカル添付は FR-119 で対応済み）、絵コンテ用紙の docx/PDF エクスポート、コンテスト・グループの storyboard 対応、ScenarioLab MCP サーバー（`get_cut_context` / `attach_image`、C案 Phase 1）。
