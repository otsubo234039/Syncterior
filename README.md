# Syncterior

ROOM/PLAN — React Three Fiber 3D家具配置シミュレーター

## ディレクトリ構成

```text
.
├── frontend/          # React / Vite / React Three Fiber
│   ├── src/           # UI・3D表示・スタイル
│   ├── index.html
│   ├── package.json   # フロントエンド専用の依存関係・コマンド
│   └── package-lock.json
├── backend/           # バックエンド（未実装）
│   ├── src/
│   └── README.md
├── .gitignore
└── README.md
```

フロントエンドとバックエンドは、それぞれのディレクトリで依存関係・設定・起動・ビルドを管理します。バックエンドの実行環境は未選定です。実装時は `backend/` に専用の依存関係定義やロックファイルを配置してください。

## フロントエンドの起動方法
Node.js 20.19 以降を用意し、リポジトリのルートから次を実行します。

```bash
cd frontend
npm install
npm run dev
```

表示されたローカルURLをブラウザで開きます。

ビルドとビルド結果の確認も `frontend/` で実行します。

```bash
npm run build
npm run preview
```

ビルド成果物は `frontend/dist/` に出力されます。バックエンドについては [backend/README.md](backend/README.md) を参照してください。

## 実装内容
- React + Vite + React Three Fiber / Three.js
- ワンルーム、1LDK、ファミリー向けの3種類の間取り
- ソファ、ベッド、ローテーブル、デスク、椅子、テレビ台、冷蔵庫、フロアランプ
- 家具の選択、追加、移動、90度回転、削除、色変更
- 一般的な家具・家電寸法をメートル単位で表示
- OrbitControlsによる3D視点操作、レスポンシブなUI

## 操作
- 左側の間取りカードで部屋を切り替え
- 家具カタログを押して配置
- 3D内の家具をクリックして選択
- 選択した家具をドラッグして移動
- 「90°回転」で向きを変更
- プロパティ欄で位置と色を調整
- 右上のゴミ箱ボタンで選択中の家具を削除

## 注意
これは初期プロトタイプです。寸法は一般的な目安で、実際の住宅図面・製品寸法との一致は保証しません。現段階では家具の永続保存、壁・ドア・窓の個別編集、衝突判定、実際の不動産図面の取り込みは未実装です。
