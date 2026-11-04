# Frontend

React / Vite / React Three Fiberで実装した家具配置シミュレーターです。

```bash
npm install
npm run dev
npm run build
npm run preview
npm test
```

## 構成

Bulletproof Reactの考え方に沿って、機能単位にコードをまとめています。

```text
src/
├── main.jsx                     # Reactの起動
├── app/
│   ├── app.jsx                  # アプリ全体の構成
│   └── styles.css               # 全体のスタイル
├── components/
│   └── layout/app-layout.jsx    # 共通ヘッダー・フッター
└── features/
    └── room-planner/
        ├── index.js             # 機能外に公開する入口
        ├── components/          # 画面UI・3D描画
        ├── hooks/               # 家具配置の状態管理と操作
        ├── data/                # 間取り・家具カタログの定義
        └── utils/               # 初期家具の生成
```

## 依存関係と追加方法

- `app`は共通レイアウトと各機能を組み合わせます。機能の利用は`features/<機能名>/index.js`を経由します。
- `features`内のコードは同じ機能内のモジュールや共通コードを参照します。他の機能の内部ファイルは直接参照しません。
- `components`には機能に依存しない共通UIを配置します。`app`や`features`は参照しません。
- 家具配置の状態と操作は`useRoomPlanner`に集約し、UI・3Dコンポーネントにはpropsで渡します。
- 家具を追加する場合は`data/catalog.js`、`planner-sidebar.jsx`のアイコン対応表、`furniture.jsx`の形状を更新します。間取りは`data/plans.js`に追加します。
- 共通化が必要になった時点で共通モジュールを追加します。未使用の層やディレクトリは用意しません。

現在はJavaScriptのまま構成を整理しています。ディレクトリ間の依存ルールは運用上の規約で、Lintによる強制は行っていません。

## 家具移動中の視点固定

家具を左ボタンまたはタッチで押している間、`useFurnitureDrag`がOrbitControlsを無効にします。ボタンを離す・操作をキャンセルする・ウィンドウがフォーカスを失う・家具がアンマウントされると、元の視点操作の状態に戻ります。家具以外の場所では従来どおり視点を操作できます。

移動先はドラッグ開始時の高さに固定した水平面とポインターのレイの交点から計算し、つかんだ位置と家具の中心とのオフセットを保持します。壁や他の家具の表面座標に切り替わって家具が飛ぶのを防ぎます。

ドラッグの開始・終了、中断時の復帰、表面座標が切り替わった際の移動先の安定性は、`utils/__tests__/furniture-drag.test.js`で検証しています。追加のテスト用依存関係は不要です。
