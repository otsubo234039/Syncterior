# シンクテリア：シミュレーター画面の文言一覧・必要性の判断

2026-11-17。LPは対象外。現在の作業ツリー（製品名をシンクテリアに変更済み）を対象に、ソースから表示条件を確認した文言監査です。下表は監査時の文言です。2026-11-17、利用者の指示で「削除候補」22項目を削除しました。続いて「短くする」58項目も適用しました。

## 見方

- **残す**：操作・対象・値の識別に必要。
- **短縮済み**：情報は必要だが、現状の文章量や重複を減らせる。
- **必要時だけ**：情報は必要。ヘルプ、初回案内、操作中、該当エラー時などへ表示を絞る。現在すでに条件付きのものも含む。
- **削除済み**：他の表示で意味が伝わるか、装飾目的であり、本文からなくせる。

ボタン・入力ラベル・見出し・選択肢・通常の状態通知・ダイアログ・アプリ固有のエラーを対象にしています。数値や名前は `{…}` で可変部分を示します。商品寸法・座標・色コード・URLなどの個別値、装飾記号、ブラウザ標準のファイル選択文言・入力検証・離脱確認、画面に見えない読み上げ専用ラベルは個別列挙しません。数値の単位は対応する項目に含めます。表中の行は画面内で別々に現れる文言であり、すべてが同時に表示されるわけではありません。

**判断の中心**：文字量の主因は、保存・3D反映・下絵・操作方法を説明する段落が繰り返し常設されていることです。操作名を消すより、重複段落と正常時の長い通知を整理する効果が大きいと判断します。保存先・データが置き換わる影響・概算精度・編集権限・失敗からの復帰方法は、必要な場所に短く残します。

## A 共通ヘッダー・フッター

| ID | 監査時の文言 | 表示条件・場所 | 判断 | 理由・整理案 | 出典 |
| --- | --- | --- | --- | --- | --- |
| T001 | シンクテリア | 常時（ページタイトルはタブ） | **残す** | 製品の識別に必要。 | [app-layout.jsx](/workspaces/Syncterior/frontend/src/components/layout/app-layout.jsx:7) |
| T002 | FLOOR PLAN & INTERIOR | 常時（ページタイトルはタブ） | **削除済み** | 装飾的な英語。見出しや機能名と重複し、次の操作に役立たない。 | [app-layout.jsx](/workspaces/Syncterior/frontend/src/components/layout/app-layout.jsx:7) |
| T003 | 編集モード | 常時（ページタイトルはタブ） | **削除済み** | 図面モード・3Dの選択表示と重複する。 | [app-layout.jsx](/workspaces/Syncterior/frontend/src/components/layout/app-layout.jsx:7) |
| T004 | プロトタイプ | 常時（ページタイトルはタブ） | **必要時だけ** | 常設の目立つバッジではなく、製品情報内でよい。制約の案内は操作箇所へ残す。 | [app-layout.jsx](/workspaces/Syncterior/frontend/src/components/layout/app-layout.jsx:7) |
| T005 | シンクテリア © 2026 | 常時（ページタイトルはタブ） | **残す** | フッターの控えめな表示でよい。 | [app-layout.jsx](/workspaces/Syncterior/frontend/src/components/layout/app-layout.jsx:9) |
| T006 | 寸法は一般的なサイズを参考にした概算です。実際の製品寸法とは異なる場合があります。 | 常時（ページタイトルはタブ） | **短縮済み** | 「家具寸法は目安です」。誤解防止の注意は一か所に残す。 | [app-layout.jsx](/workspaces/Syncterior/frontend/src/components/layout/app-layout.jsx:9) |
| T007 | BUILT FOR YOUR SPACE | 常時（ページタイトルはタブ） | **削除済み** | 装飾的な英語。見出しや機能名と重複し、次の操作に役立たない。 | [app-layout.jsx](/workspaces/Syncterior/frontend/src/components/layout/app-layout.jsx:9) |
| T008 | シンクテリア / 3Dレイアウト | 常時（ページタイトルはタブ） | **残す** | ブラウザのタブで製品と画面を識別するため必要。 | [index.html](/workspaces/Syncterior/frontend/index.html:2) |

## B 図面モード・新規作成・読込

| ID | 監査時の文言 | 表示条件・場所 | 判断 | 理由・整理案 | 出典 |
| --- | --- | --- | --- | --- | --- |
| T009 | DRAW YOUR SPACE | 図面モード（状態により切替） | **削除済み** | 装飾的な英語。見出しや機能名と重複し、次の操作に役立たない。 | [drawing-workspace.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/drawing-workspace.jsx:24) |
| T010 | 図面モード | 図面モード（状態により切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [drawing-workspace.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/drawing-workspace.jsx:25) |
| T011 | 2D図面を作成・保存し、同じ図面から3Dを表示します。 | 図面モード（状態により切替） | **削除済み** | 画面タイトル・保存ボタン・3D表示ボタンと重複する。 | [drawing-workspace.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/drawing-workspace.jsx:25) |
| T012 | 未保存の変更があります | 図面モード（状態により切替） | **短縮済み** | 「未保存」。情報を失わず短くできる。 | [drawing-workspace.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/drawing-workspace.jsx:26) |
| T013 | 図面は保存済みです | 図面モード（状態により切替） | **短縮済み** | 「保存済み」。状態表示は必要。 | [drawing-workspace.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/drawing-workspace.jsx:26) |
| T014 | 図面の新規作成・読込・画像変換 | 「図面の新規作成・読込・画像変換」を展開中 | **短縮済み** | 「新規作成・読み込み」。機能が見つかる名称は必要だが長い。 | [drawing-workspace.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/drawing-workspace.jsx:28) |
| T015 | 保存した図面を開く | 「図面の新規作成・読込・画像変換」を展開中 | **残す** | 操作名・入力項目・状態の識別に必要。 | [drawing-workspace.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/drawing-workspace.jsx:30) |
| T016 | 図面ファイルを開く | 「図面の新規作成・読込・画像変換」を展開中 | **残す** | 操作名・入力項目・状態の識別に必要。 | [drawing-workspace.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/drawing-workspace.jsx:31) |
| T017 | 図面ファイルは1MB以下を選択してください。 | 対応する操作の失敗時だけ | **必要時だけ** | ファイルサイズが超過した時の対処に必要。通常時は不要。 | [drawing-workspace.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/drawing-workspace.jsx:35) |
| T018 | 図面ファイルを書き出す | 「図面の新規作成・読込・画像変換」を展開中 | **短縮済み** | 「ファイルに保存」。ブラウザ保存との区別は残す。 | [drawing-workspace.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/drawing-workspace.jsx:40) |
| T019 | 新しい図面を作成 | 「図面の新規作成・読込・画像変換」を展開中 | **短縮済み** | 「新規作成」。展開内のフォームで意味が分かる。 | [drawing-workspace.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/drawing-workspace.jsx:42) |
| T020 | 図面名と有効な寸法を指定してください。幅・奥行きは1〜100m、高さは0.5〜10mです。 | 対応する操作の失敗時だけ | **短縮済み** | 入力不備のある項目にだけ理由と範囲を示す。 | [drawing-workspace.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/drawing-workspace.jsx:46) |
| T021 | 新しい図面名 | 「図面の新規作成・読込・画像変換」を展開中 | **短縮済み** | 「図面名」。新規作成の文脈内で「新しい」は不要。 | [drawing-workspace.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/drawing-workspace.jsx:49) |
| T022 | 新しい図面 | 「図面の新規作成・読込・画像変換」を展開中 | **残す** | 新規図面名の初期値。説明文ではない。 | [drawing-workspace.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/drawing-workspace.jsx:49) |
| T023 | 図面の幅 (m) | 「図面の新規作成・読込・画像変換」を展開中 | **残す** | 操作名・入力項目・状態の識別に必要。 | [drawing-workspace.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/drawing-workspace.jsx:50) |
| T024 | 図面の奥行き (m) | 「図面の新規作成・読込・画像変換」を展開中 | **残す** | 操作名・入力項目・状態の識別に必要。 | [drawing-workspace.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/drawing-workspace.jsx:51) |
| T025 | 新しい壁の高さ (m) | 「図面の新規作成・読込・画像変換」を展開中 | **短縮済み** | 「壁の高さ (m)」。入力対象を残し重複語を落とす。 | [drawing-workspace.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/drawing-workspace.jsx:52) |
| T026 | 新規作成 | 「図面の新規作成・読込・画像変換」を展開中 | **残す** | 操作名・入力項目・状態の識別に必要。 | [drawing-workspace.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/drawing-workspace.jsx:53) |
| T027 | 同じ図面の修正として3Dへ反映します。現在の家具を維持します。 | 図面モード（状態により切替） | **必要時だけ** | 3Dへ反映する直前に「家具を引き継ぎます」でよい。常時の説明は不要。 | [drawing-workspace.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/drawing-workspace.jsx:64) |
| T028 | 新しい図面から家具なしの3Dを作成します。現在の間取り・家具配置は3D表示時に置き換わります。 | 図面モード（状態により切替） | **必要時だけ** | 配置が置き換わることは重要。3D表示ボタンの近くで、該当時だけ短く示す。 | [drawing-workspace.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/drawing-workspace.jsx:65) |
| T029 | 画像の取り込み後、「図面へ変換」で編集を始められます。 | 図面モード（状態により切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [drawing-workspace.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/drawing-workspace.jsx:68) |
| T030 | 図面の保存はこのブラウザ内です。図面ファイルで別のブラウザにも持ち出せます。下絵・編集履歴は保存しません。同じ図面の修正では家具の位置・寸法を維持し、収まらない変更は拒否します。新規作成・別の画像や図面ファイルの取り込みでは家具なしの3Dを作成します。 | 図面モード（状態により切替） | **必要時だけ** | 複数の制約が一段落に混在し、上の通知とも重複。保存の説明と3D反映の注意を分けて各操作箇所へ置く。 | [drawing-workspace.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/drawing-workspace.jsx:69) |

## C 図面の編集

| ID | 監査時の文言 | 表示条件・場所 | 判断 | 理由・整理案 | 出典 |
| --- | --- | --- | --- | --- | --- |
| T031 | この変更は適用できません。床の交差、壁の長さ、開口の重なりやはみ出しを確認してください。 | 対応する操作の失敗時だけ | **短縮済み** | 必要なエラーだが、今回失敗した対象の原因だけに絞ると対処しやすい。 | [floor-plan-editor.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-editor.jsx:41) |
| T032 | 選択・頂点を動かす | 図面モード（選択・ツール・下絵の有無に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-editor.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-editor.jsx:107) |
| T033 | 壁を追加 | 図面モード（選択・ツール・下絵の有無に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-editor.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-editor.jsx:107) |
| T034 | 線を消す | 図面モード（選択・ツール・下絵の有無に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-editor.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-editor.jsx:107) |
| T035 | 扉を追加 | 図面モード（選択・ツール・下絵の有無に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-editor.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-editor.jsx:107) |
| T036 | 窓を追加 | 図面モード（選択・ツール・下絵の有無に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-editor.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-editor.jsx:107) |
| T037 | 2D図面を編集 | 図面モード（選択・ツール・下絵の有無に応じて切替） | **削除済み** | 上位の「図面モード」と重複。編集領域の区切りが必要なら短い見出しにする。 | [floor-plan-editor.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-editor.jsx:113) |
| T038 | 図面情報：{図面名} / 壁の高さ {高さ} m | 図面モード（選択・ツール・下絵の有無に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-editor.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-editor.jsx:114) |
| T039 | 図面名 | 図面モード（選択・ツール・下絵の有無に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-editor.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-editor.jsx:117) |
| T040 | 壁の高さ (m) | 図面モード（選択・ツール・下絵の有無に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-editor.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-editor.jsx:118) |
| T041 | 図面情報を更新 | 図面モード（選択・ツール・下絵の有無に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-editor.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-editor.jsx:119) |
| T042 | グリッドを見ながら「壁を追加」で2点を指定し、「線を消す」で不要な壁の線を押します。ここでの変更はまだ保存されません。 | 図面モード（選択・ツール・下絵の有無に応じて切替） | **必要時だけ** | 編集ツールに応じた一行の案内と保存状態へ分ける。常時の複数操作説明は不要。 | [floor-plan-editor.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-editor.jsx:122) |
| T043 | 手直しを元に戻す | 図面モード（選択・ツール・下絵の有無に応じて切替） | **短縮済み** | 「元に戻す」。編集ツール内なので「手直しを」は不要。 | [floor-plan-editor.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-editor.jsx:129) |
| T044 | 手直しをやり直す | 図面モード（選択・ツール・下絵の有無に応じて切替） | **短縮済み** | 「やり直す」。同上。 | [floor-plan-editor.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-editor.jsx:133) |
| T045 | 下絵を表示 | 図面モード（選択・ツール・下絵の有無に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-editor.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-editor.jsx:135) |
| T046 | 下絵の濃さ | 図面モード（選択・ツール・下絵の有無に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-editor.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-editor.jsx:136) |
| T047 | 下絵の位置・縮尺は固定 | 図面モード（選択・ツール・下絵の有無に応じて切替） | **必要時だけ** | 操作できない理由を説明するヘルプでよい。常時読ませる必要は薄い。 | [floor-plan-editor.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-editor.jsx:136) |
| T048 | 下絵がありません。新しい画像は「間取り画像を図面へ変換」から読み込めます。 | 図面モード（選択・ツール・下絵の有無に応じて切替） | **削除済み** | 画像なしの作図も通常の使い方。「ありません」が毎回出ると不足やエラーに見える。画像入力の入口があれば十分。 | [floor-plan-editor.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-editor.jsx:137) |
| T049 | グリッドを表示 | 図面モード（選択・ツール・下絵の有無に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-editor.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-editor.jsx:138) |
| T050 | 1目盛 {数値} m・太線 {数値} m | 図面モード（選択・ツール・下絵の有無に応じて切替） | **残す** | 寸法・計測結果の確認に必要。単位と対象が分かる表示は残す。 | [floor-plan-editor.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-editor.jsx:139) |
| T051 | 壁の終点を指定してください。 | 図面モード（選択・ツール・下絵の有無に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-editor.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-editor.jsx:140) |
| T052 | 壁の始点を指定してください。 | 図面モード（選択・ツール・下絵の有無に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-editor.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-editor.jsx:140) |
| T053 | 同じ壁上で開口の終点を指定してください。 | 図面モード（選択・ツール・下絵の有無に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-editor.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-editor.jsx:140) |
| T054 | 壁上で開口の始点を指定してください。 | 図面モード（選択・ツール・下絵の有無に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-editor.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-editor.jsx:140) |
| T055 | 消したい壁の線を押してください。元に戻すこともできます。 | 図面モード（選択・ツール・下絵の有無に応じて切替） | **短縮済み** | 「消す壁を選択」。元に戻すボタンの説明は重複。 | [floor-plan-editor.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-editor.jsx:140) |
| T056 | 壁や床、扉・窓を選択してください。白い点はドラッグ・矢印キーで動かせます。 | 図面モード（選択・ツール・下絵の有無に応じて切替） | **短縮済み** | 「選択して白い点を動かす」。ドラッグ・キー操作の詳細は初回やヘルプへ。 | [floor-plan-editor.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-editor.jsx:140) |
| T057 | Escで途中の操作を取り消せます。 | 図面モード（選択・ツール・下絵の有無に応じて切替） | **必要時だけ** | 操作途中やショートカット一覧で表示すればよい。 | [floor-plan-editor.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-editor.jsx:140) |
| T058 | 選択した開口を削除 | 図面モード（選択・ツール・下絵の有無に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-editor.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-editor.jsx:174) |
| T059 | 選択した壁を削除 | 図面モード（選択・ツール・下絵の有無に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-editor.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-editor.jsx:174) |
| T060 | 頂点{番号}を編集 | 図面モード（選択・ツール・下絵の有無に応じて切替） | **削除済み** | 選択された点の強調表示で分かるなら番号の文章は不要。 | [floor-plan-editor.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-editor.jsx:176) |
| T061 | 辺{番号}に頂点を追加 | 図面モード（選択・ツール・下絵の有無に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-editor.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-editor.jsx:180) |
| T062 | 頂点{番号}を削除 | 図面モード（選択・ツール・下絵の有無に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-editor.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-editor.jsx:183) |
| T063 | 図面を保存 | 図面モード（選択・ツール・下絵の有無に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-editor.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-editor.jsx:187) |
| T064 | 図面から3Dを表示 | 図面モード（選択・ツール・下絵の有無に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-editor.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-editor.jsx:188) |
| T065 | {幅} m × {奥行き} m | 図面モード（選択・ツール・下絵の有無に応じて切替） | **残す** | 寸法・計測結果の確認に必要。単位と対象が分かる表示は残す。 | [floor-plan-editor.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-editor.jsx:120) |

## D 画像取込・サイズ合わせ

| ID | 監査時の文言 | 表示条件・場所 | 判断 | 理由・整理案 | 出典 |
| --- | --- | --- | --- | --- | --- |
| T066 | OpenCVで壁候補を解析しています… | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **短縮済み** | 「画像を解析中…」。エンジン名は利用者の判断に不要。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:51) |
| T067 | {数値・状態}で壁候補を{数値・状態}本抽出しました。部屋候補は{数値・状態}件です。床は仮の長方形です。実測した一辺、または帖数が分かる部屋を指定してください。 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **短縮済み** | 「解析できました。サイズを合わせてください」＋「床は仮形状」の注意へ。エンジン名・壁候補本数・候補件数は詳細表示でよい。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:64) |
| T068 | 画像を読み込めませんでした。 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **必要時だけ** | 読込失敗時に必要。可能なら再選択の導線を添える。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:66) |
| T069 | 間取り画像を図面へ変換 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:103) |
| T070 | 画像は端末内で解析します。自動抽出は概算です。一辺の実測値、または部屋の帖数から縦横比を保って間取り全体のサイズを合わせます。 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **短縮済み** | 「画像を読み込み、一辺の長さか帖数でサイズを合わせます」。端末内処理・概算の説明は該当箇所の補足へ分ける。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:104) |
| T071 | 図面への変換は個人編集中に利用できます。 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:105) |
| T072 | 間取り画像 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:107) |
| T073 | 画像を再解析 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:110) |
| T074 | 解析を中止しました。 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:112) |
| T075 | 解析を中止 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:112) |
| T076 | 帖数が分かる部屋の候補を選ぶか、輪郭を順に指定してください。L字や斜めの辺にも対応します。広告の帖数なら壁の中心を目安に輪郭を調整します。 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **短縮済み** | 「帖数が分かる部屋を選択」。手動輪郭・壁心の説明は選択方式や補足へ分ける。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:164) |
| T077 | 帖数が分かる長方形の部屋を、対角の2点で囲んでください。広告の帖数なら壁の中心を目安にします。余白・廊下・隣の部屋は含めません。 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **短縮済み** | 「部屋の対角2点を選択」。面積を囲む範囲の注意はヘルプへ。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:164) |
| T078 | 測った壁の内側の角から角まで、始点・終点を指定してください。部屋の境界や青い壁の区切りに合わせる必要はありません。 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **短縮済み** | 「実測した区間の始点と終点を選択」。認識線に依存しない説明はヘルプへ。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:164) |
| T079 | 点はドラッグ、または選択して矢印キーで微調整できます。 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **必要時だけ** | 編集画面にもある操作説明。初回または点の選択中だけでよい。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:165) |
| T080 | 元画像は保存されないため、復元後は認識された形状を表示しています。 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **必要時だけ** | 保存後の見え方を説明する情報。保存の説明か復元時にだけ表示する。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:165) |
| T081 | サイズを合わせる | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:168) |
| T082 | サイズ合わせの方法 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:169) |
| T083 | 一辺の実測値 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:172) |
| T084 | 部屋の帖数（概算） | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:173) |
| T085 | 帖数の対象 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:176) |
| T086 | 自動認識した部屋 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:177) |
| T087 | 輪郭を指定 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:177) |
| T088 | 長方形を指定 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:177) |
| T089 | 認識した輪郭と帖数の範囲が合っているか確認してください。扉や壁の欠落で隣室とつながる場合は、輪郭を手動で指定できます。帖数には地域・表記による差があり、補正は概算です。 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **短縮済み** | 「部屋の輪郭を確認してください。帖数による補正は概算です」。手動修正の方法は必要時の案内へ。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:179) |
| T090 | 図上の部屋候補を選んでください（{数値・状態}件）。点は動かして修正できます。 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **短縮済み** | 「部屋を選択」。候補件数と点の修正方法は常設不要。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:182) |
| T091 | 部屋候補が見つかりません。「輪郭を指定」でもサイズを合わせられます。 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:182) |
| T092 | 輪郭を閉じる | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:184) |
| T093 | 最後の点を取り消す | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:185) |
| T094 | 輪郭を選び直す | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:186) |
| T095 | 始点を指定 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:189) |
| T096 | 終点を指定 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:190) |
| T097 | 2点を選び直す | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:191) |
| T098 | 部屋候補を選ぶか、交差しない輪郭を3〜64点で指定して閉じてください。 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:193) |
| T099 | 部屋の輪郭を選択しました。この部屋の帖数を入力してください。 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **短縮済み** | 選択済みであることは図から分かる。「帖数を入力」または「実測値を入力」だけでよい。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:193) |
| T100 | {始点／終点}を図面上で指定してください。 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:193) |
| T101 | 2点が近すぎます。離れた位置を指定してください。 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:193) |
| T102 | 対象の長方形を選択しました。この部屋の帖数を入力してください。 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **短縮済み** | 選択済みであることは図から分かる。「帖数を入力」または「実測値を入力」だけでよい。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:193) |
| T103 | 計測区間を選択しました。実際に測った長さを入力してください。 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **短縮済み** | 選択済みであることは図から分かる。「帖数を入力」または「実測値を入力」だけでよい。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:193) |
| T104 | 有効な計測区間または部屋の輪郭を指定してください。 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:196) |
| T105 | {有効な輪郭と正の帖数・1帖の面積／有効な長方形と正の帖数・1帖の面積／有効な2点と長さ}を指定してください。補正後の幅・奥行きは1〜100m、壁厚は0.05〜1mの範囲が必要です。 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **短縮済み** | 入力の不備と、補正後の寸法制限が一つの長文に混在。失敗した条件だけを示す。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:200) |
| T106 | 指定した帖数の面積に合っています（概算）。 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **短縮済み** | 成功・取消の短い通知で十分。「図面へ変換」の説明を毎回繰り返さない。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:201) |
| T107 | 指定した長さに合っています。 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **短縮済み** | 成功・取消の短い通知で十分。「図面へ変換」の説明を毎回繰り返さない。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:201) |
| T108 | 指定した帖数から全体のサイズを概算で補正しました。「図面へ変換」で編集画面に反映できます。 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **短縮済み** | 成功・取消の短い通知で十分。「図面へ変換」の説明を毎回繰り返さない。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:202) |
| T109 | 指定した一辺に合わせて全体のサイズを補正しました。「図面へ変換」で編集画面に反映できます。 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **短縮済み** | 成功・取消の短い通知で十分。「図面へ変換」の説明を毎回繰り返さない。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:202) |
| T110 | 選択した部屋の帖数 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:205) |
| T111 | 1帖の面積 (m²) | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:206) |
| T112 | 初期値は1帖＝1.62m²の目安です。地域や図面の換算値が分かる場合は変更してください。 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **短縮済み** | 「1帖＝1.62m²（変更可）」と地域差の補足で十分。換算値の入力自体は残す。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:207) |
| T113 | 指定した部屋の目標面積：{面積} m²（概算） | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **残す** | 寸法・計測結果の確認に必要。単位と対象が分かる表示は残す。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:208) |
| T114 | 測った一辺の長さ (m) | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:209) |
| T115 | この帖数で全体を補正 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **短縮済み** | 「サイズを合わせる」。方式と対象は直前の入力項目で分かる。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:210) |
| T116 | この長さで全体を補正 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **短縮済み** | 「サイズを合わせる」。同上。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:210) |
| T117 | 補正前のサイズに戻しました。「図面へ変換」で編集画面に反映できます。 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **短縮済み** | 成功・取消の短い通知で十分。「図面へ変換」の説明を毎回繰り返さない。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:212) |
| T118 | サイズ補正を取り消す | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:212) |
| T119 | 自動認識直後の床は仮の長方形です。変換後、図面モードで壁・床・扉・窓を確認・修正し、図面として保存してください。この操作では3D配置を変更しません。 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **短縮済み** | 「床は仮の長方形です。変換後に確認・修正してください」。保存・3Dへの影響の説明は他所と重複。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:215) |
| T120 | 編集可能な図面へ変換しました。 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **短縮済み** | 成功・取消の短い通知で十分。「図面へ変換」の説明を毎回繰り返さない。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:218) |
| T121 | 図面へ変換 | 画像変換を展開中（解析・選択方式・補正状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [floor-plan-importer.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/floor-plan-importer.jsx:221) |

## E 3D・家具配置

| ID | 監査時の文言 | 表示条件・場所 | 判断 | 理由・整理案 | 出典 |
| --- | --- | --- | --- | --- | --- |
| T122 | OBJECT SETTINGS | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **削除済み** | 装飾的な英語。見出しや機能名と重複し、次の操作に役立たない。 | [furniture-properties.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/furniture-properties.jsx:11) |
| T123 | 家具を選択してください | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [furniture-properties.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/furniture-properties.jsx:11) |
| T124 | 90° 回転 | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [furniture-properties.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/furniture-properties.jsx:11) |
| T125 | 幅 (W) | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [furniture-properties.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/furniture-properties.jsx:13) |
| T126 | 奥行 (D) | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [furniture-properties.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/furniture-properties.jsx:13) |
| T127 | 高さ (H) | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [furniture-properties.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/furniture-properties.jsx:13) |
| T128 | 左右位置 (X) | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [furniture-properties.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/furniture-properties.jsx:14) |
| T129 | 前後位置 (Z) | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [furniture-properties.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/furniture-properties.jsx:17) |
| T130 | 色 | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [furniture-properties.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/furniture-properties.jsx:20) |
| T131 | 左のカタログから家具を追加するか、3Dビュー内の家具をクリックしてください。 | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **短縮済み** | 「家具を選択してください」と重複。「カタログから追加」程度の補助でよい。 | [furniture-properties.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/furniture-properties.jsx:23) |
| T132 | 平面図 | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [planner-canvas.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/planner-canvas.jsx:29) |
| T133 | 3D | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [planner-canvas.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/planner-canvas.jsx:30) |
| T134 | 一人称 | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [planner-canvas.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/planner-canvas.jsx:31) |
| T135 | 初期視点 | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [planner-canvas.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/planner-canvas.jsx:32) |
| T136 | 正面 | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [planner-canvas.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/planner-canvas.jsx:33) |
| T137 | 歩ける場所が見つかりません。家具や床・壁を確認し、3Dまたは平面図へ戻って調整してください。 | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **短縮済み** | 「歩ける場所がありません。家具や床を調整してください」。失敗時の案内は必要。 | [planner-canvas.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/planner-canvas.jsx:34) |
| T138 | 3Dプレビューを読み込んでいます… | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [planner-canvas.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/planner-canvas.jsx:34) |
| T139 | 平面図・1目盛 {数値・状態} m | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **必要時だけ** | 表示モードはボタンで分かる。操作説明・目盛りだけを必要な方式で示す。 | [planner-canvas.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/planner-canvas.jsx:37) |
| T140 | 一人称・画面を選んでWASD／矢印キーで移動、ドラッグで見回す、Escで終了 | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **短縮済み** | 「WASD／矢印：移動・ドラッグ：視点・Esc：終了」。一人称中の案内は必要。 | [planner-canvas.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/planner-canvas.jsx:37) |
| T141 | 3D・ドラッグで視点を変更 | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **必要時だけ** | 表示モードはボタンで分かる。操作説明・目盛りだけを必要な方式で示す。 | [planner-canvas.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/planner-canvas.jsx:37) |
| T142 | 寸法表示 | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [planner-canvas.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/planner-canvas.jsx:38) |
| T143 | 選択を削除 | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [planner-canvas.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/planner-canvas.jsx:38) |
| T144 | 間取りを選ぶ | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [planner-sidebar.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/planner-sidebar.jsx:24) |
| T145 | 部屋のベースを選択してください | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **削除済み** | 見出し「間取りを選ぶ」で十分。 | [planner-sidebar.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/planner-sidebar.jsx:24) |
| T146 | 家具・家電を追加 | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [planner-sidebar.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/planner-sidebar.jsx:29) |
| T147 | 選択すると壁に収まる位置に配置 | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **必要時だけ** | 初回の操作案内にまとめる。 | [planner-sidebar.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/planner-sidebar.jsx:29) |
| T148 | 選択すると部屋の中央に配置 | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **必要時だけ** | 初回の操作案内としては有用。カタログ付近に常設しなくてもよい。 | [planner-sidebar.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/planner-sidebar.jsx:29) |
| T149 | 家具は床と壁に収まる位置へ追加します。図面から作成した間取りは個人保存のみ対応しています。 | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **必要時だけ** | 追加先と共有制限が混在。追加の失敗時・共有を開いた時へ分離する。 | [planner-sidebar.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/planner-sidebar.jsx:34) |
| T150 | 家具は200点まで配置できます。 | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [planner-sidebar.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/planner-sidebar.jsx:35) |
| T151 | 家具はドラッグで移動、選択後に回転できます。寸法は一般的な製品の目安です。 | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **削除済み** | ドラッグ案内はプレビュー下と重複。寸法の注意もフッターと重複する。 | [planner-sidebar.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/planner-sidebar.jsx:36) |
| T152 | 図面モード | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [room-planner.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-planner.jsx:18) |
| T153 | 3D・家具配置 | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [room-planner.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-planner.jsx:19) |
| T154 | 図面を作成・保存 → 3Dで確認・家具を配置 | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **削除済み** | モード名と各操作ボタンが同じ手順を示している。初回案内へ移せる。 | [room-planner.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-planner.jsx:20) |
| T155 | 保存した個人配置を消去 | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **必要時だけ** | 操作は残すが、通常の作業画面より保存管理メニューへ置くのがよい。 | [room-planner.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-planner.jsx:30) |
| T156 | 共有された部屋を開けませんでした | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [room-planner.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-planner.jsx:33) |
| T157 | 共有された部屋を読み込んでいます… | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [room-planner.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-planner.jsx:33) |
| T158 | 接続が完了すると、最新の配置が表示されます。 | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **削除済み** | 読み込み中の見出しと重複し、利用者が行う操作もない。 | [room-planner.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-planner.jsx:34) |
| T159 | 個人編集に戻る | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [room-planner.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-planner.jsx:35) |
| T160 | YOUR SPACE | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **削除済み** | 装飾的な英語。見出しや機能名と重複し、次の操作に役立たない。 | [room-planner.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-planner.jsx:38) |
| T161 | {間取り名} / 3Dレイアウト | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **短縮済み** | 間取り名は必要。「/ 3Dレイアウト」は表示モードで分かる。 | [room-planner.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-planner.jsx:38) |
| T162 | ROOM SIZE | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **短縮済み** | 「面積」に統一すると日本語UIと揃う。 | [room-planner.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-planner.jsx:40) |
| T163 | FURNITURE | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **短縮済み** | 「家具数」に統一すると意味が明確。 | [room-planner.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-planner.jsx:41) |
| T164 | 壁・床・開口の作成や画像の変換は「図面モード」で行います。 | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **削除済み** | 上のモード切り替えと「図面の編集へ」があれば説明は重複。 | [room-planner.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-planner.jsx:44) |
| T165 | 図面の編集へ | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **残す** | 直接操作できる導線。上部モード切り替えとの重複を整理する場合でも、少なくとも一方は残す。 | [room-planner.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-planner.jsx:44) |
| T166 | TIP | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **削除済み** | 装飾的な英語。見出しや機能名と重複し、次の操作に役立たない。 | [room-planner.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-planner.jsx:48) |
| T167 | 壁・床・開口の変更は図面モードで編集してから3Dへ反映 | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **削除済み** | 直上の案内と重複。同じ画面で二度説明する必要がない。 | [room-planner.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-planner.jsx:48) |
| T168 | 家具をクリックして選択、ドラッグして配置を調整 | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **必要時だけ** | 初回・家具未選択時の一か所に残す。 | [room-planner.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-planner.jsx:48) |
| T169 | 接続が戻るまで配置の編集を一時停止しています | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [room-planner.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-planner.jsx:48) |
| T170 | 左ドラッグ：回転 | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [room-planner.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-planner.jsx:49) |
| T171 | スクロール：ズーム | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [room-planner.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-planner.jsx:49) |
| T172 | {幅}m × {奥行き}m | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **残す** | 寸法・計測結果の確認に必要。単位と対象が分かる表示は残す。 | [planner-sidebar.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/planner-sidebar.jsx:27) |
| T173 | {幅} × {奥行き} × {高さ} m | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **残す** | 寸法・計測結果の確認に必要。単位と対象が分かる表示は残す。 | [planner-sidebar.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/planner-sidebar.jsx:32) |
| T174 | {幅／奥行き} m | 3D・家具配置（表示方式・選択・保存・共有状態に応じて切替） | **残す** | 寸法・計測結果の確認に必要。単位と対象が分かる表示は残す。 | [planner-canvas.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/planner-canvas.jsx:39) |

## F 共有バー・共有ダイアログ

| ID | 監査時の文言 | 表示条件・場所 | 判断 | 理由・整理案 | 出典 |
| --- | --- | --- | --- | --- | --- |
| T175 | 個人で編集中 | 3D・家具配置の共有バー（接続状態により切替） | **削除済み** | ヘッダーの編集表示や共有していない状態と重複。共同編集時の接続状態は残す。 | [room-sharing.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-sharing.jsx:5) |
| T176 | 共有リンクを作成中 | 3D・家具配置の共有バー（接続状態により切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [room-sharing.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-sharing.jsx:5) |
| T177 | 部屋に接続中 | 3D・家具配置の共有バー（接続状態により切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [room-sharing.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-sharing.jsx:5) |
| T178 | 共同編集中 | 3D・家具配置の共有バー（接続状態により切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [room-sharing.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-sharing.jsx:6) |
| T179 | 再接続中 | 3D・家具配置の共有バー（接続状態により切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [room-sharing.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-sharing.jsx:6) |
| T180 | 接続できません | 3D・家具配置の共有バー（接続状態により切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [room-sharing.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-sharing.jsx:6) |
| T181 | コピーできませんでした。リンク欄を選択して手動でコピーしてください。 | 3D・家具配置の共有バー（接続状態により切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [room-sharing.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-sharing.jsx:31) |
| T182 | 参加人数を確認中 | 3D・家具配置の共有バー（接続状態により切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [room-sharing.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-sharing.jsx:41) |
| T183 | {数値・状態}人が参加中 | 3D・家具配置の共有バー（接続状態により切替） | **残す** | 寸法・計測結果の確認に必要。単位と対象が分かる表示は残す。 | [room-sharing.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-sharing.jsx:41) |
| T184 | 間取りを変更中 | 3D・家具配置の共有バー（接続状態により切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [room-sharing.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-sharing.jsx:41) |
| T185 | 変更を同期中 | 3D・家具配置の共有バー（接続状態により切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [room-sharing.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-sharing.jsx:41) |
| T186 | 変更は同期済み | 3D・家具配置の共有バー（接続状態により切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [room-sharing.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-sharing.jsx:41) |
| T187 | リンクを共有して、一緒に部屋づくり | 3D・家具配置の共有バー（接続状態により切替） | **削除済み** | 「部屋を共有」ボタンと意味が重複する販促文。 | [room-sharing.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-sharing.jsx:42) |
| T188 | 再接続 | 3D・家具配置の共有バー（接続状態により切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [room-sharing.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-sharing.jsx:45) |
| T189 | 共有リンク | 3D・家具配置の共有バー（接続状態により切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [room-sharing.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-sharing.jsx:47) |
| T190 | 部屋を共有 | 3D・家具配置の共有バー（接続状態により切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [room-sharing.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-sharing.jsx:47) |
| T191 | 接続が戻るまで編集を一時停止しています。未送信の変更は再接続後に送信します。 | 3D・家具配置の共有バー（接続状態により切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [room-sharing.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-sharing.jsx:52) |
| T192 | 未送信の変更を破棄して退出 | 3D・家具配置の共有バー（接続状態により切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [room-sharing.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-sharing.jsx:53) |
| T193 | 個人編集に切り替える | 3D・家具配置の共有バー（接続状態により切替） | **残す** | 操作名・入力項目・状態の識別に必要。 | [room-sharing.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-sharing.jsx:53) |
| T194 | CREATE TOGETHER | 共有ダイアログ内（開いた時だけ） | **削除済み** | 装飾的な英語。見出しや機能名と重複し、次の操作に役立たない。 | [room-sharing.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-sharing.jsx:57) |
| T195 | この部屋を、一緒につくる | 共有ダイアログ内（開いた時だけ） | **短縮済み** | 「部屋を共有」。ダイアログの目的を直接示す。 | [room-sharing.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-sharing.jsx:58) |
| T196 | 共有リンクを知っている人は、同じ部屋の家具や間取りを編集できます。選択中の家具や視点は、自分の画面だけで変わります。 | 共有ダイアログ内（開いた時だけ） | **短縮済み** | 「リンクを知っている人が編集できます」。視点と選択の仕様はヘルプへ。 | [room-sharing.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-sharing.jsx:59) |
| T197 | 編集用リンク | 共有ダイアログ内（開いた時だけ） | **残す** | 操作名・入力項目・状態の識別に必要。 | [room-sharing.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-sharing.jsx:61) |
| T198 | コピー済み | 共有ダイアログ内（開いた時だけ） | **残す** | 操作名・入力項目・状態の識別に必要。 | [room-sharing.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-sharing.jsx:62) |
| T199 | コピー | 共有ダイアログ内（開いた時だけ） | **残す** | 操作名・入力項目・状態の識別に必要。 | [room-sharing.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-sharing.jsx:62) |
| T200 | このリンクには編集権限があります。共有する相手を確認してください。 | 共有ダイアログ内（開いた時だけ） | **短縮済み** | 「リンクを知っている人が編集できます」に統合。権限の説明は必ず一か所残す。 | [room-sharing.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-sharing.jsx:63) |
| T201 | 図面から作成した間取りの共有は未対応です。個人編集と保存は利用できます。 | 共有ダイアログ内（開いた時だけ） | **残す** | 操作名・入力項目・状態の識別に必要。 | [room-sharing.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-sharing.jsx:66) |
| T202 | 共同編集は現在利用できません。個人での編集は引き続き利用できます。 | 共有ダイアログ内（開いた時だけ） | **残す** | 操作名・入力項目・状態の識別に必要。 | [room-sharing.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-sharing.jsx:67) |
| T203 | リンクを作成中… | 共有ダイアログ内（開いた時だけ） | **残す** | 操作名・入力項目・状態の識別に必要。 | [room-sharing.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-sharing.jsx:69) |
| T204 | 共有リンクを作成 | 共有ダイアログ内（開いた時だけ） | **残す** | 操作名・入力項目・状態の識別に必要。 | [room-sharing.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-sharing.jsx:69) |
| T205 | 退出後は個人用の部屋として編集できます。 | 共有ダイアログ内（開いた時だけ） | **必要時だけ** | 退出操作に添える補足へ。通常は表示し続けなくてよい。 | [room-sharing.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-sharing.jsx:71) |
| T206 | 共同編集から退出 | 共有ダイアログ内（開いた時だけ） | **残す** | 操作名・入力項目・状態の識別に必要。 | [room-sharing.jsx](/workspaces/Syncterior/frontend/src/features/room-planner/components/room-sharing.jsx:71) |

## G 間取り・家具の名称と値

| ID | 監査時の文言 | 表示条件・場所 | 判断 | 理由・整理案 | 出典 |
| --- | --- | --- | --- | --- | --- |
| T207 | 2人掛けソファ | カタログ・間取りカード・選択中の名称 | **残す** | 選択対象の名前。説明文と区別して残す。 | [catalog.js](/workspaces/Syncterior/frontend/src/features/room-planner/data/catalog.js:3) |
| T208 | ダブルベッド | カタログ・間取りカード・選択中の名称 | **残す** | 選択対象の名前。説明文と区別して残す。 | [catalog.js](/workspaces/Syncterior/frontend/src/features/room-planner/data/catalog.js:10) |
| T209 | ローテーブル | カタログ・間取りカード・選択中の名称 | **残す** | 選択対象の名前。説明文と区別して残す。 | [catalog.js](/workspaces/Syncterior/frontend/src/features/room-planner/data/catalog.js:17) |
| T210 | デスク | カタログ・間取りカード・選択中の名称 | **残す** | 選択対象の名前。説明文と区別して残す。 | [catalog.js](/workspaces/Syncterior/frontend/src/features/room-planner/data/catalog.js:24) |
| T211 | ダイニングチェア | カタログ・間取りカード・選択中の名称 | **残す** | 選択対象の名前。説明文と区別して残す。 | [catalog.js](/workspaces/Syncterior/frontend/src/features/room-planner/data/catalog.js:31) |
| T212 | テレビ台＋TV | カタログ・間取りカード・選択中の名称 | **残す** | 選択対象の名前。説明文と区別して残す。 | [catalog.js](/workspaces/Syncterior/frontend/src/features/room-planner/data/catalog.js:38) |
| T213 | 冷蔵庫 | カタログ・間取りカード・選択中の名称 | **残す** | 選択対象の名前。説明文と区別して残す。 | [catalog.js](/workspaces/Syncterior/frontend/src/features/room-planner/data/catalog.js:45) |
| T214 | フロアランプ | カタログ・間取りカード・選択中の名称 | **残す** | 選択対象の名前。説明文と区別して残す。 | [catalog.js](/workspaces/Syncterior/frontend/src/features/room-planner/data/catalog.js:52) |
| T215 | ワンルーム | カタログ・間取りカード・選択中の名称 | **残す** | 選択対象の名前。説明文と区別して残す。 | [plans.js](/workspaces/Syncterior/frontend/src/features/room-planner/data/plans.js:3) |
| T216 | 一人暮らし向け・22.7㎡ | カタログ・間取りカード・選択中の名称 | **短縮済み** | 面積は必要。用途の説明はなくても間取りを選べる。 | [plans.js](/workspaces/Syncterior/frontend/src/features/room-planner/data/plans.js:7) |
| T217 | 寝室とLDKを分けた間取り・38.9㎡ | カタログ・間取りカード・選択中の名称 | **短縮済み** | 面積だけでよい。現在のプリセット形状では実際の部屋分割の保証にも注意が必要。 | [plans.js](/workspaces/Syncterior/frontend/src/features/room-planner/data/plans.js:19) |
| T218 | ファミリー | カタログ・間取りカード・選択中の名称 | **残す** | 選択対象の名前。説明文と区別して残す。 | [plans.js](/workspaces/Syncterior/frontend/src/features/room-planner/data/plans.js:27) |
| T219 | ゆとりあるリビング・55.4㎡ | カタログ・間取りカード・選択中の名称 | **短縮済み** | 面積だけでよい。販促的な形容は操作の助けにならない。 | [plans.js](/workspaces/Syncterior/frontend/src/features/room-planner/data/plans.js:31) |
| T220 | 1LDK | カタログ・間取りカード・選択中の名称 | **残す** | 選択対象の名前。説明文と区別して残す。 | [plans.js](/workspaces/Syncterior/frontend/src/features/room-planner/data/plans.js:15) |

## H 操作後の通知・説明

| ID | 監査時の文言 | 表示条件・場所 | 判断 | 理由・整理案 | 出典 |
| --- | --- | --- | --- | --- | --- |
| T221 | 保存した個人配置を復元しました。 | 対応する操作後・初期状態（通知は次の通知まで残る） | **必要時だけ** | 短い一時通知にして、作業中に文章として常設しない。 | [use-room-planner.js](/workspaces/Syncterior/frontend/src/features/room-planner/hooks/use-room-planner.js:22) |
| T222 | 個人編集はこのブラウザに自動保存されます。 | 対応する操作後・初期状態（通知は次の通知まで残る） | **短縮済み** | 「このブラウザに自動保存」。保存先を知る情報は必要。 | [use-room-planner.js](/workspaces/Syncterior/frontend/src/features/room-planner/hooks/use-room-planner.js:22) |
| T223 | 個人配置をこのブラウザに保存しました。 | 対応する操作後・初期状態（通知は次の通知まで残る） | **必要時だけ** | 短い一時通知にして、作業中に文章として常設しない。 | [use-room-planner.js](/workspaces/Syncterior/frontend/src/features/room-planner/hooks/use-room-planner.js:30) |
| T224 | 保存した図面を開きました。 | 対応する操作後・初期状態（通知は次の通知まで残る） | **必要時だけ** | 短い一時通知にして、作業中に文章として常設しない。 | [use-room-planner.js](/workspaces/Syncterior/frontend/src/features/room-planner/hooks/use-room-planner.js:47) |
| T225 | 図面を作成し、3Dを開かずに保存できます。 | 対応する操作後・初期状態（通知は次の通知まで残る） | **削除済み** | 画面説明・保存ボタンと重複する。 | [use-room-planner.js](/workspaces/Syncterior/frontend/src/features/room-planner/hooks/use-room-planner.js:47) |
| T226 | 2D図面から生成した間取り・壁や床の変更は図面モードで行えます | 対応する操作後・初期状態（通知は次の通知まで残る） | **削除済み** | 生成元の説明と編集場所が他の案内に重複する。 | [use-room-planner.js](/workspaces/Syncterior/frontend/src/features/room-planner/hooks/use-room-planner.js:55) |
| T227 | この家具が床と壁に収まる位置が見つかりませんでした。 | 対応する操作後・初期状態（通知は次の通知まで残る） | **必要時だけ** | 対応する状態・結果を伝える。一時通知にし、正常時に長文を残さない。 | [use-room-planner.js](/workspaces/Syncterior/frontend/src/features/room-planner/hooks/use-room-planner.js:83) |
| T228 | 保存した個人配置を消去しました。画面の配置は残り、次の個人編集から再び保存します。 | 対応する操作後・初期状態（通知は次の通知まで残る） | **短縮済み** | 「保存データを削除しました」。画面の配置が残る点は削除操作の説明へ。 | [use-room-planner.js](/workspaces/Syncterior/frontend/src/features/room-planner/hooks/use-room-planner.js:95) |
| T229 | 共有から退出しました。個人保存は変更していません。次の編集から保存します。 | 対応する操作後・初期状態（通知は次の通知まで残る） | **短縮済み** | 「共同編集から退出しました」。個人保存への影響は退出時の補足へ。 | [use-room-planner.js](/workspaces/Syncterior/frontend/src/features/room-planner/hooks/use-room-planner.js:99) |
| T230 | 図面を開きました。「図面を保存」でこのブラウザに保存できます。 | 対応する操作後・初期状態（通知は次の通知まで残る） | **短縮済み** | 「図面を開きました」。保存ボタンの使い方を毎回繰り返さない。 | [use-room-planner.js](/workspaces/Syncterior/frontend/src/features/room-planner/hooks/use-room-planner.js:113) |
| T231 | 新しい画像へ切り替えました。サイズを合わせて「図面へ変換」を押してください。 | 対応する操作後・初期状態（通知は次の通知まで残る） | **必要時だけ** | 対応する状態・結果を伝える。一時通知にし、正常時に長文を残さない。 | [use-room-planner.js](/workspaces/Syncterior/frontend/src/features/room-planner/hooks/use-room-planner.js:120) |
| T232 | 図面をこのブラウザに保存しました。3Dを開かなくても復元できます。 | 対応する操作後・初期状態（通知は次の通知まで残る） | **短縮済み** | 「図面を保存しました」。復元方法の説明はヘルプへ。 | [use-room-planner.js](/workspaces/Syncterior/frontend/src/features/room-planner/hooks/use-room-planner.js:126) |
| T233 | 家具が新しい床や壁に収まりません。家具を移動・削除してから3Dへ反映してください。図面はそのまま保存できます。 | 対応する操作後・初期状態（通知は次の通知まで残る） | **必要時だけ** | 対応する状態・結果を伝える。一時通知にし、正常時に長文を残さない。 | [use-room-planner.js](/workspaces/Syncterior/frontend/src/features/room-planner/hooks/use-room-planner.js:137) |

## I 読込・保存・通信のエラー通知

| ID | 監査時の文言 | 表示条件・場所 | 判断 | 理由・整理案 | 出典 |
| --- | --- | --- | --- | --- | --- |
| T234 | 共同編集は現在利用できません。個人での編集は引き続き利用できます。 | エラー発生時だけ | **必要時だけ** | 原因と次の行動を知らせるため必要。正常時の文字量を減らす目的では削除しない。 | [room-api.js](/workspaces/Syncterior/frontend/src/features/room-planner/api/room-api.js:13) |
| T235 | 共有サーバーに接続できません。接続を確認してください。 | エラー発生時だけ | **必要時だけ** | 原因と次の行動を知らせるため必要。正常時の文字量を減らす目的では削除しない。 | [room-api.js](/workspaces/Syncterior/frontend/src/features/room-planner/api/room-api.js:21) |
| T236 | 共同編集に接続できませんでした。しばらくしてから再試行してください。 | エラー発生時だけ | **必要時だけ** | 原因と次の行動を知らせるため必要。正常時の文字量を減らす目的では削除しない。 | [room-api.js](/workspaces/Syncterior/frontend/src/features/room-planner/api/room-api.js:27) |
| T237 | 部屋を読み込めませんでした。 | エラー発生時だけ | **必要時だけ** | 原因と次の行動を知らせるため必要。正常時の文字量を減らす目的では削除しない。 | [room-api.js](/workspaces/Syncterior/frontend/src/features/room-planner/api/room-api.js:29) |
| T238 | 図面の形状が不正です。 | エラー発生時だけ | **短縮済み** | 内部データの名前だけでは対処できない。ファイルの再読込・別画像など次の行動を示す。 | [drawing-document.js](/workspaces/Syncterior/frontend/src/features/room-planner/utils/drawing-document.js:24) |
| T239 | 図面IDが不正です。 | エラー発生時だけ | **短縮済み** | 内部データの名前だけでは対処できない。ファイルの再読込・別画像など次の行動を示す。 | [drawing-document.js](/workspaces/Syncterior/frontend/src/features/room-planner/utils/drawing-document.js:25) |
| T240 | 図面データが大きすぎます。 | エラー発生時だけ | **必要時だけ** | 原因と次の行動を知らせるため必要。正常時の文字量を減らす目的では削除しない。 | [drawing-document.js](/workspaces/Syncterior/frontend/src/features/room-planner/utils/drawing-document.js:27) |
| T241 | 図面ファイルを読み込めません。正しいJSONファイルを選択してください。 | エラー発生時だけ | **必要時だけ** | 原因と次の行動を知らせるため必要。正常時の文字量を減らす目的では削除しない。 | [drawing-document.js](/workspaces/Syncterior/frontend/src/features/room-planner/utils/drawing-document.js:35) |
| T242 | 対応していない図面、または不正な図面データです。 | エラー発生時だけ | **必要時だけ** | 原因と次の行動を知らせるため必要。正常時の文字量を減らす目的では削除しない。 | [drawing-document.js](/workspaces/Syncterior/frontend/src/features/room-planner/utils/drawing-document.js:38) |
| T243 | 保存した図面を読み込めませんでした。新規作成や図面ファイルから編集を続けられます。 | エラー発生時だけ | **必要時だけ** | 原因と次の行動を知らせるため必要。正常時の文字量を減らす目的では削除しない。 | [drawing-document.js](/workspaces/Syncterior/frontend/src/features/room-planner/utils/drawing-document.js:51) |
| T244 | 図面を保存できませんでした。編集を続けるか、図面ファイルを書き出してください。 | エラー発生時だけ | **必要時だけ** | 原因と次の行動を知らせるため必要。正常時の文字量を減らす目的では削除しない。 | [drawing-document.js](/workspaces/Syncterior/frontend/src/features/room-planner/utils/drawing-document.js:55) |
| T245 | 画像の解析結果が不正です。 | エラー発生時だけ | **短縮済み** | 内部データの名前だけでは対処できない。ファイルの再読込・別画像など次の行動を示す。 | [floor-plan-detection.js](/workspaces/Syncterior/frontend/src/features/room-planner/utils/floor-plan-detection.js:9) |
| T246 | 壁候補が多すぎます。図面の周囲の余白を減らすか、手動で壁を指定してください。 | エラー発生時だけ | **短縮済み** | 再試行方法は必要。手動編集の入口が図面モードであることを正確に示す。 | [floor-plan-detection.js](/workspaces/Syncterior/frontend/src/features/room-planner/utils/floor-plan-detection.js:44) |
| T247 | 取込間取り | エラー発生時だけ | **必要時だけ** | 原因と次の行動を知らせるため必要。正常時の文字量を減らす目的では削除しない。 | [floor-plan-detection.js](/workspaces/Syncterior/frontend/src/features/room-planner/utils/floor-plan-detection.js:67) |
| T248 | 間取りを生成できませんでした。余白の少ない画像をお試しください。 | エラー発生時だけ | **必要時だけ** | 原因と次の行動を知らせるため必要。正常時の文字量を減らす目的では削除しない。 | [floor-plan-detection.js](/workspaces/Syncterior/frontend/src/features/room-planner/utils/floor-plan-detection.js:71) |
| T249 | JPEG・PNG・WebPの10MB以下の画像を選択してください。 | エラー発生時だけ | **必要時だけ** | 原因と次の行動を知らせるため必要。正常時の文字量を減らす目的では削除しない。 | [floor-plan-image.js](/workspaces/Syncterior/frontend/src/features/room-planner/utils/floor-plan-image.js:7) |
| T250 | 画像を読み込めませんでした。ファイルが壊れていないか確認してください。 | エラー発生時だけ | **必要時だけ** | 原因と次の行動を知らせるため必要。正常時の文字量を減らす目的では削除しない。 | [floor-plan-image.js](/workspaces/Syncterior/frontend/src/features/room-planner/utils/floor-plan-image.js:11) |
| T251 | 画像は各辺32〜8192px、合計2000万画素以下にしてください。 | エラー発生時だけ | **必要時だけ** | 原因と次の行動を知らせるため必要。正常時の文字量を減らす目的では削除しない。 | [floor-plan-image.js](/workspaces/Syncterior/frontend/src/features/room-planner/utils/floor-plan-image.js:14) |
| T252 | 解析を中止しました。 | エラー発生時だけ | **必要時だけ** | 原因と次の行動を知らせるため必要。正常時の文字量を減らす目的では削除しない。 | [floor-plan-image.js](/workspaces/Syncterior/frontend/src/features/room-planner/utils/floor-plan-image.js:31) |
| T253 | 画像解析が時間内に完了しませんでした。再試行してください。 | エラー発生時だけ | **必要時だけ** | 原因と次の行動を知らせるため必要。正常時の文字量を減らす目的では削除しない。 | [floor-plan-image.js](/workspaces/Syncterior/frontend/src/features/room-planner/utils/floor-plan-image.js:32) |
| T254 | 画像解析を起動できませんでした。再試行してください。 | エラー発生時だけ | **必要時だけ** | 原因と次の行動を知らせるため必要。正常時の文字量を減らす目的では削除しない。 | [floor-plan-image.js](/workspaces/Syncterior/frontend/src/features/room-planner/utils/floor-plan-image.js:33) |
| T255 | 保存した個人配置を読み込めませんでした。初期配置で編集を続けられます。 | エラー発生時だけ | **必要時だけ** | 原因と次の行動を知らせるため必要。正常時の文字量を減らす目的では削除しない。 | [local-room-storage.js](/workspaces/Syncterior/frontend/src/features/room-planner/utils/local-room-storage.js:34) |
| T256 | 個人配置を保存できませんでした。この画面では編集を続けられます。 | エラー発生時だけ | **必要時だけ** | 原因と次の行動を知らせるため必要。正常時の文字量を減らす目的では削除しない。 | [local-room-storage.js](/workspaces/Syncterior/frontend/src/features/room-planner/utils/local-room-storage.js:51) |
| T257 | 保存した個人配置を消去できませんでした。この画面の配置は残っています。 | エラー発生時だけ | **必要時だけ** | 原因と次の行動を知らせるため必要。正常時の文字量を減らす目的では削除しない。 | [local-room-storage.js](/workspaces/Syncterior/frontend/src/features/room-planner/utils/local-room-storage.js:59) |
| T258 | 画像解析に失敗しました。別の画像か手動編集をお試しください。 ({数値・状態}) | エラー発生時だけ | **短縮済み** | 解析失敗と再試行方法は必要。末尾の内部例外は利用者向け本文から分離する。 | [opencv-worker.js](/workspaces/Syncterior/frontend/src/features/room-planner/utils/opencv-worker.js:412) |
| T259 | 共有データを読み込めませんでした。 | エラー発生時だけ | **必要時だけ** | 原因と次の行動を知らせるため必要。正常時の文字量を減らす目的では削除しない。 | [room-session.js](/workspaces/Syncterior/frontend/src/features/room-planner/utils/room-session.js:35) |
| T260 | 間取りの変更により未送信の操作を取り消しました。 | エラー発生時だけ | **必要時だけ** | 原因と次の行動を知らせるため必要。正常時の文字量を減らす目的では削除しない。 | [room-session.js](/workspaces/Syncterior/frontend/src/features/room-planner/utils/room-session.js:44) |
| T261 | 共有された部屋が見つかりません。 | エラー発生時だけ | **必要時だけ** | 原因と次の行動を知らせるため必要。正常時の文字量を減らす目的では削除しない。 | [room-session.js](/workspaces/Syncterior/frontend/src/features/room-planner/utils/room-session.js:74) |
| T262 | 変更を送信できません。再接続しています。 | エラー発生時だけ | **必要時だけ** | 原因と次の行動を知らせるため必要。正常時の文字量を減らす目的では削除しない。 | [room-session.js](/workspaces/Syncterior/frontend/src/features/room-planner/utils/room-session.js:77) |
| T263 | 共有データを読み込めませんでした。再接続してください。 | エラー発生時だけ | **必要時だけ** | 原因と次の行動を知らせるため必要。正常時の文字量を減らす目的では削除しない。 | [room-session.js](/workspaces/Syncterior/frontend/src/features/room-planner/utils/room-session.js:112) |
| T264 | 共有リンクが正しくありません。 | エラー発生時だけ | **必要時だけ** | 原因と次の行動を知らせるため必要。正常時の文字量を減らす目的では削除しない。 | [room-session.js](/workspaces/Syncterior/frontend/src/features/room-planner/utils/room-session.js:124) |
| T265 | 取り込んだ間取りの共有はまだ利用できません。個人編集と保存は利用できます。 | エラー発生時だけ | **必要時だけ** | 原因と次の行動を知らせるため必要。正常時の文字量を減らす目的では削除しない。 | [room-session.js](/workspaces/Syncterior/frontend/src/features/room-planner/utils/room-session.js:170) |
| T266 | 共同編集は現在利用できません。個人での編集は引き続き利用できます。 | エラー発生時だけ | **必要時だけ** | 原因と次の行動を知らせるため必要。正常時の文字量を減らす目的では削除しない。 | [room-session.js](/workspaces/Syncterior/frontend/src/features/room-planner/utils/room-session.js:174) |
| T267 | 共有リンクを作成できませんでした。 | エラー発生時だけ | **必要時だけ** | 原因と次の行動を知らせるため必要。正常時の文字量を減らす目的では削除しない。 | [room-session.js](/workspaces/Syncterior/frontend/src/features/room-planner/utils/room-session.js:182) |

## 集計

文言単位：267件（同じ文でも表示場所が異なるものは別行）。

- 残す：133件
- 削除候補：22件
- 必要時だけ：54件
- 短くする：58件

「必要時だけ」は削除の指示ではありません。すでにエラー時だけ出る通知も含むため、その件数をそのまま削減可能な常時表示数とは扱いません。元の長い段落を複数項目へ分割して改善する場合もあるため、文の数と画面の文字量は同じではありません。

次の指示は「T018は削除」「T045はヘルプへ」「図面モードの短縮案を採用」のようにIDや範囲で指定できます。削除22項目と短縮58項目は対応済みです。「必要時だけ」の項目の表示条件は変更していません。

## 対応状況（2026-11-17）

削除済みのID：T002, T003, T007, T009, T011, T037, T048, T060, T122, T145, T151, T154, T158, T160, T164, T166, T167, T175, T187, T194, T225, T226。

短縮58項目の適用内容は [文言の短縮内容（適用済み）](ui-copy-shortening-proposals.md) を参照してください。「必要時だけ」の項目は今回変更していません。上の件数は監査時の分類数です。

削除22項目を適用した時点の検証：本番ビルドと通常E2E143件（UI122件・実WebGL21件）が成功。デスクトップ・モバイル幅で削除対象22項目の非表示、図面編集・保存・3D表示・共有操作、未適用の短縮候補の代表例が元の文言のまま残ることを確認しました。CI・実機操作は未確認です。

短縮58項目を適用した後の検証：本番ビルド、ユニットテスト16ファイル、通常E2E143件（UI122件・実WebGL21件）が成功しました。デスクトップ・モバイル幅で短縮した操作名・通知を使い、図面編集・サイズ補正・保存・共有・視点操作を確認しました。CI・実機操作は未確認です。
