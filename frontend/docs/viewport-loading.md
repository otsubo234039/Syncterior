# 3Dの読み込み表示（Issue #67）

通常3D・一人称の表示準備を、3D領域の中央に置く緑のリングと「3Dを読み込み中…」で示します。画面全体は覆わず、図面・平面図への切り替えは利用できます。新しいUIライブラリや画像素材は追加していません。

## 選定

[CarbonのLoadingパターン](https://www.carbondesignsystem.com/building-blocks/core/patterns/loading)を参考に、形が未確定の3D領域には待機中を表すリングを採用しました。アプリの緑と背景色に合わせ、立方体のアイコンと短い文言だけを表示します。実際の処理全体の割合を取得できないため、進捗率や架空の残り時間は表示しません。

[WAI-ARIAのstatus](https://www.w3.org/TR/wai-aria-1.2/#status)に従う状態通知を使い、描画側のコンテナーに`aria-busy`を付けます。通知自体はbusyなコンテナーの外に置きます。[W3CのC39](https://www.w3.org/WAI/WCAG22/Techniques/css/C39)を参考に、`prefers-reduced-motion: reduce`では回転を止めます。

## 完了と後始末

- 遅延読み込みする3Dモジュールの取得中は、ReactのSuspenseで同じ待機UIを出します。
- モジュール取得後もCanvas内の素材が揃うまで待機UIを継続します。現在の家具は手続き的な形状で、非同期の素材取得は主に環境HDRです。
- `SceneReady`は素材と同じSuspense内に置き、描画の直前に呼ばれる`useFrame`から次のブラウザフレームへ通知を予約します。`onCreated`やファイルの取得完了だけで表示を終えません。
- 準備完了後は待機UIを外し、寸法表示・削除・視点移動を利用できるようにします。停止中のWebGL描画を増やさず、進捗確認用のポーリングもしません。
- モード切り替え・アンマウント時は通知待ちのrequestAnimationFrameを解除します。準備状態は家具の配置・保存・共有へ含めません。
- モジュール・素材の取得失敗は3D領域で受け止め、待機UIを終了します。「平面図で続ける」から編集を継続できます。

参照：[React Suspense](https://react.dev/reference/react/Suspense)、[React Three Fiber Canvas](https://r3f.docs.pmnd.rs/api/canvas)。

## 検証

`viewport-loading.spec.js`はモジュール取得を、`viewport-loading.3d.spec.js`は実際のCanvasのHDR取得をPromiseで保留し、待機表示・完了・中断・失敗を確認します。固定秒数のsleepは使いません。デスクトップ・モバイル幅の画像と、動きを減らす設定も確認します。

UI用ビューポートのスタブは次のmicrotaskで準備完了を通知し、Canvasは生成しません。素材取得と初回描画の確認は実WebGLで行います。

このR3F配布版はcatchしたエラーも`reportError`へ通知します。HDR取得の503を注入する1ケースだけ、`expectedPageErrors`でファイル名・取得元・HTTPステータス・通知件数まで検証します。通常のテストはブラウザエラー0件を維持し、この1件以外のエラーが出ても失敗させます。

コマンド：`npm run test:unit --prefix frontend`、`npm run build --prefix frontend`、`npm run test:e2e --prefix frontend`。

検証結果（2026-11-17実行、2026-11-19レポート確認）：本番ビルド、ユニットテスト17ファイル、通常E2E156件（UI128件・実WebGL28件）が成功しました。失敗・リトライによる成功・スキップはいずれも0件です。デスクトップ・モバイル幅の表示画像も確認済みです。CI・実機操作は未確認です。
