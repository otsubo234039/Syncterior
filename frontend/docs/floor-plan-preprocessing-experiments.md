# 間取り画像の前処理比較

## 結果と採用範囲

全6図面×9方式＝54ケースを、ブラウザ内の実OpenCV WorkerとWebGLで比較した。認識・3D画像は108枚。既存の後段の線抽出・線幅・端点・床処理は固定し、手修正していない。

採用したのは `guarded-clahe`。無彩色画像の透明部分を白へ合成し、不透明かつ外周につながる黒い領域が全画素の10%以上の場合だけCLAHE（clipLimit=2、8×8タイル）を適用する。外側の黒の判定は既存のRGB最大値40未満を維持する。画像名や注釈を実装条件に使用しない。閾値10%は今回選んだ仮説であり、未知の図面での最適値を保証しない。

- 黒背景図面の部分壁網羅率：76.32% → 86.50%（+10.18ポイント）。選択済みの非壁領域の誤検出・開口遮蔽・出っ張り検証点のエラーは増えていない。
- 残り5枚は、製品モデルの壁データ・床・寸法が従来と完全一致した。
- 合成した透明背景の黒枠：従来0本 → 4本、同じ形状の白背景と線・線幅が一致。既存の1px灰色枠も保持する。
- 色付き透明図面は既存処理を維持する。Cottageのポーチ欠落は残る。白補完と色保持でポーチを拾うと、Bedroomの文字を壁へ復活させたため採用しない。

**これは部分注釈の評価であり、図面全体の精度ではない。** 未注釈の家具・扉の細線は残る。黒背景図面にも細かい余分な線があり、認識結果の修正は引き続き必要。床は仮の長方形のまま。基準画像を繰り返し見ているため独立した評価セットではない。

## 条件・不採用案

基準はコミット `b49d9cd` のWorker（`baseline-worker.js`に保存）。OpenCV.js 4.12.0-release.1、長辺1024px以下、既存4枚＋出典付き追加2枚。追加画像の出典は `e2e/fixtures/floor-plans/holdout/sources.json`。注釈は既存 `references.json` と追加画像の `references-audited.json` を使用し、今回は注釈を変更していない。

| 方式 | 前処理と判断 |
| --- | --- |
| alpha | 白補完だけではCottageの緑の壁が消え、網羅率0%。不採用 |
| alpha-color | 色保持を併用してもCottageの文字領域に28pxの誤検出。黒枠改善だけでは採用しない |
| bilateral | d=5、sigmaColor=20、sigmaSpace=2。木目図面の網羅率が91.23%→55.55%。不採用 |
| clahe | clipLimit=2、8×8。一律適用は木目・Riversideで悪化。黒背景への限定適用のみ採用 |
| sauvola | 既存と同じ窓幅、k=.2、R=128。boxFilterで局所平均・二乗平均を算出。Riversideは改善するが木目が74.38%に低下。不採用 |
| median | 3×3。合成1px灰色枠が4本→0本、白黒図面も欠落。不採用 |
| safe-alpha | アルファ128以上の有彩色画素がない画像だけ透明部分を白合成。色付き図面への影響を避ける部分修正として採用 |
| guarded-clahe | safe-alphaに黒背景限定CLAHEを追加。今回の製品採用案 |

bilateral・clahe・sauvola・medianは、それぞれalpha-colorに単独で追加して比較した。後の2方式は副作用を見た後に追加した探索的な条件であり、最初から固定した独立検証ではない。感度設定UI・AI・外部画像送信・新しい依存関係は追加していない。

## 全画像の数値比較

各セルは部分壁網羅率（%）。候補本数を精度とは扱わない。

| 図面 | baseline | alpha | alpha-color | bilateral | clahe | sauvola | median | safe-alpha | guarded-clahe |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| monochrome | 99.73 | 99.73 | 99.73 | 99.73 | 99.73 | 99.73 | 84.54 | 99.73 | 99.73 |
| colored | 95.82 | 95.82 | 95.82 | 94.22 | 95.88 | 95.84 | 92.17 | 95.82 | 95.82 |
| dark-background | 76.32 | 76.32 | 76.32 | 76.50 | 86.50 | 77.42 | 73.48 | 76.32 | 86.50 |
| textured | 91.23 | 91.23 | 91.23 | 55.55 | 90.06 | 74.38 | 56.36 | 91.23 | 91.23 |
| cottage | 88.95 | 0.00 | 88.95 | 88.95 | 88.95 | 88.95 | 88.95 | 88.95 | 88.95 |
| riverside | 54.32 | 54.32 | 54.32 | 53.56 | 49.87 | 66.16 | 55.99 | 54.32 | 54.32 |

全ケースで選択した開口点の遮蔽0、出っ張り点の欠落0、指定した空白点の壁化0。非壁領域の混入はCottageのalpha=32.5px、alpha-color/bilateral/clahe/sauvola=28px、それ以外0px。これは注釈領域内の数値であり、領域外の誤検出ゼロを意味しない。

Cottageの過去の床外点 `[500,820]` はポーチと重なる可能性があるため、今回は床の内外点から採否を決めていない。採用方式の黒背景図面では壁上端の変化に伴い、仮床の上辺が画像上0.5px（モデル上約1.1cm）上へ広がった。全体寸法と他の辺は同じで、他5枚の床は完全一致する。床の正解注釈を黙って変更していない。

## 全画像の認識結果と3D

左は原図に壁の箱（青）・仮の床（緑）を重ねた結果。右は同じ生成モデルのWebGL表示。比較用ビューアでは画像全幅を8m・壁高2.4mとして統一しており、製品画面そのもののスクリーンショットではない。製品の数値編集・保存・実Canvasは通常E2Eで別途検証する。

### monochrome

| 方式 | 認識 | 3D |
| --- | --- | --- |
| 従来処理 | ![認識](floor-plan-preprocessing-assets/baseline-monochrome-recognition.png) | ![3D](floor-plan-preprocessing-assets/baseline-monochrome-3d.png) |
| 白背景合成のみ | ![認識](floor-plan-preprocessing-assets/alpha-monochrome-recognition.png) | ![3D](floor-plan-preprocessing-assets/alpha-monochrome-3d.png) |
| 白背景合成＋色保持 | ![認識](floor-plan-preprocessing-assets/alpha-color-monochrome-recognition.png) | ![3D](floor-plan-preprocessing-assets/alpha-color-monochrome-3d.png) |
| 色保持＋弱bilateral | ![認識](floor-plan-preprocessing-assets/bilateral-monochrome-recognition.png) | ![3D](floor-plan-preprocessing-assets/bilateral-monochrome-3d.png) |
| 色保持＋CLAHE | ![認識](floor-plan-preprocessing-assets/clahe-monochrome-recognition.png) | ![3D](floor-plan-preprocessing-assets/clahe-monochrome-3d.png) |
| 色保持＋Sauvola | ![認識](floor-plan-preprocessing-assets/sauvola-monochrome-recognition.png) | ![3D](floor-plan-preprocessing-assets/sauvola-monochrome-3d.png) |
| 色保持＋median 3px | ![認識](floor-plan-preprocessing-assets/median-monochrome-recognition.png) | ![3D](floor-plan-preprocessing-assets/median-monochrome-3d.png) |
| 無彩色だけ白背景合成 | ![認識](floor-plan-preprocessing-assets/safe-alpha-monochrome-recognition.png) | ![3D](floor-plan-preprocessing-assets/safe-alpha-monochrome-3d.png) |
| 無彩色の白補完＋黒背景限定CLAHE（採用） | ![認識](floor-plan-preprocessing-assets/guarded-clahe-monochrome-recognition.png) | ![3D](floor-plan-preprocessing-assets/guarded-clahe-monochrome-3d.png) |

### colored

| 方式 | 認識 | 3D |
| --- | --- | --- |
| 従来処理 | ![認識](floor-plan-preprocessing-assets/baseline-colored-recognition.png) | ![3D](floor-plan-preprocessing-assets/baseline-colored-3d.png) |
| 白背景合成のみ | ![認識](floor-plan-preprocessing-assets/alpha-colored-recognition.png) | ![3D](floor-plan-preprocessing-assets/alpha-colored-3d.png) |
| 白背景合成＋色保持 | ![認識](floor-plan-preprocessing-assets/alpha-color-colored-recognition.png) | ![3D](floor-plan-preprocessing-assets/alpha-color-colored-3d.png) |
| 色保持＋弱bilateral | ![認識](floor-plan-preprocessing-assets/bilateral-colored-recognition.png) | ![3D](floor-plan-preprocessing-assets/bilateral-colored-3d.png) |
| 色保持＋CLAHE | ![認識](floor-plan-preprocessing-assets/clahe-colored-recognition.png) | ![3D](floor-plan-preprocessing-assets/clahe-colored-3d.png) |
| 色保持＋Sauvola | ![認識](floor-plan-preprocessing-assets/sauvola-colored-recognition.png) | ![3D](floor-plan-preprocessing-assets/sauvola-colored-3d.png) |
| 色保持＋median 3px | ![認識](floor-plan-preprocessing-assets/median-colored-recognition.png) | ![3D](floor-plan-preprocessing-assets/median-colored-3d.png) |
| 無彩色だけ白背景合成 | ![認識](floor-plan-preprocessing-assets/safe-alpha-colored-recognition.png) | ![3D](floor-plan-preprocessing-assets/safe-alpha-colored-3d.png) |
| 無彩色の白補完＋黒背景限定CLAHE（採用） | ![認識](floor-plan-preprocessing-assets/guarded-clahe-colored-recognition.png) | ![3D](floor-plan-preprocessing-assets/guarded-clahe-colored-3d.png) |

### dark-background

| 方式 | 認識 | 3D |
| --- | --- | --- |
| 従来処理 | ![認識](floor-plan-preprocessing-assets/baseline-dark-background-recognition.png) | ![3D](floor-plan-preprocessing-assets/baseline-dark-background-3d.png) |
| 白背景合成のみ | ![認識](floor-plan-preprocessing-assets/alpha-dark-background-recognition.png) | ![3D](floor-plan-preprocessing-assets/alpha-dark-background-3d.png) |
| 白背景合成＋色保持 | ![認識](floor-plan-preprocessing-assets/alpha-color-dark-background-recognition.png) | ![3D](floor-plan-preprocessing-assets/alpha-color-dark-background-3d.png) |
| 色保持＋弱bilateral | ![認識](floor-plan-preprocessing-assets/bilateral-dark-background-recognition.png) | ![3D](floor-plan-preprocessing-assets/bilateral-dark-background-3d.png) |
| 色保持＋CLAHE | ![認識](floor-plan-preprocessing-assets/clahe-dark-background-recognition.png) | ![3D](floor-plan-preprocessing-assets/clahe-dark-background-3d.png) |
| 色保持＋Sauvola | ![認識](floor-plan-preprocessing-assets/sauvola-dark-background-recognition.png) | ![3D](floor-plan-preprocessing-assets/sauvola-dark-background-3d.png) |
| 色保持＋median 3px | ![認識](floor-plan-preprocessing-assets/median-dark-background-recognition.png) | ![3D](floor-plan-preprocessing-assets/median-dark-background-3d.png) |
| 無彩色だけ白背景合成 | ![認識](floor-plan-preprocessing-assets/safe-alpha-dark-background-recognition.png) | ![3D](floor-plan-preprocessing-assets/safe-alpha-dark-background-3d.png) |
| 無彩色の白補完＋黒背景限定CLAHE（採用） | ![認識](floor-plan-preprocessing-assets/guarded-clahe-dark-background-recognition.png) | ![3D](floor-plan-preprocessing-assets/guarded-clahe-dark-background-3d.png) |

### textured

| 方式 | 認識 | 3D |
| --- | --- | --- |
| 従来処理 | ![認識](floor-plan-preprocessing-assets/baseline-textured-recognition.png) | ![3D](floor-plan-preprocessing-assets/baseline-textured-3d.png) |
| 白背景合成のみ | ![認識](floor-plan-preprocessing-assets/alpha-textured-recognition.png) | ![3D](floor-plan-preprocessing-assets/alpha-textured-3d.png) |
| 白背景合成＋色保持 | ![認識](floor-plan-preprocessing-assets/alpha-color-textured-recognition.png) | ![3D](floor-plan-preprocessing-assets/alpha-color-textured-3d.png) |
| 色保持＋弱bilateral | ![認識](floor-plan-preprocessing-assets/bilateral-textured-recognition.png) | ![3D](floor-plan-preprocessing-assets/bilateral-textured-3d.png) |
| 色保持＋CLAHE | ![認識](floor-plan-preprocessing-assets/clahe-textured-recognition.png) | ![3D](floor-plan-preprocessing-assets/clahe-textured-3d.png) |
| 色保持＋Sauvola | ![認識](floor-plan-preprocessing-assets/sauvola-textured-recognition.png) | ![3D](floor-plan-preprocessing-assets/sauvola-textured-3d.png) |
| 色保持＋median 3px | ![認識](floor-plan-preprocessing-assets/median-textured-recognition.png) | ![3D](floor-plan-preprocessing-assets/median-textured-3d.png) |
| 無彩色だけ白背景合成 | ![認識](floor-plan-preprocessing-assets/safe-alpha-textured-recognition.png) | ![3D](floor-plan-preprocessing-assets/safe-alpha-textured-3d.png) |
| 無彩色の白補完＋黒背景限定CLAHE（採用） | ![認識](floor-plan-preprocessing-assets/guarded-clahe-textured-recognition.png) | ![3D](floor-plan-preprocessing-assets/guarded-clahe-textured-3d.png) |

### cottage

| 方式 | 認識 | 3D |
| --- | --- | --- |
| 従来処理 | ![認識](floor-plan-preprocessing-assets/baseline-cottage-recognition.png) | ![3D](floor-plan-preprocessing-assets/baseline-cottage-3d.png) |
| 白背景合成のみ | ![認識](floor-plan-preprocessing-assets/alpha-cottage-recognition.png) | ![3D](floor-plan-preprocessing-assets/alpha-cottage-3d.png) |
| 白背景合成＋色保持 | ![認識](floor-plan-preprocessing-assets/alpha-color-cottage-recognition.png) | ![3D](floor-plan-preprocessing-assets/alpha-color-cottage-3d.png) |
| 色保持＋弱bilateral | ![認識](floor-plan-preprocessing-assets/bilateral-cottage-recognition.png) | ![3D](floor-plan-preprocessing-assets/bilateral-cottage-3d.png) |
| 色保持＋CLAHE | ![認識](floor-plan-preprocessing-assets/clahe-cottage-recognition.png) | ![3D](floor-plan-preprocessing-assets/clahe-cottage-3d.png) |
| 色保持＋Sauvola | ![認識](floor-plan-preprocessing-assets/sauvola-cottage-recognition.png) | ![3D](floor-plan-preprocessing-assets/sauvola-cottage-3d.png) |
| 色保持＋median 3px | ![認識](floor-plan-preprocessing-assets/median-cottage-recognition.png) | ![3D](floor-plan-preprocessing-assets/median-cottage-3d.png) |
| 無彩色だけ白背景合成 | ![認識](floor-plan-preprocessing-assets/safe-alpha-cottage-recognition.png) | ![3D](floor-plan-preprocessing-assets/safe-alpha-cottage-3d.png) |
| 無彩色の白補完＋黒背景限定CLAHE（採用） | ![認識](floor-plan-preprocessing-assets/guarded-clahe-cottage-recognition.png) | ![3D](floor-plan-preprocessing-assets/guarded-clahe-cottage-3d.png) |

### riverside

| 方式 | 認識 | 3D |
| --- | --- | --- |
| 従来処理 | ![認識](floor-plan-preprocessing-assets/baseline-riverside-recognition.png) | ![3D](floor-plan-preprocessing-assets/baseline-riverside-3d.png) |
| 白背景合成のみ | ![認識](floor-plan-preprocessing-assets/alpha-riverside-recognition.png) | ![3D](floor-plan-preprocessing-assets/alpha-riverside-3d.png) |
| 白背景合成＋色保持 | ![認識](floor-plan-preprocessing-assets/alpha-color-riverside-recognition.png) | ![3D](floor-plan-preprocessing-assets/alpha-color-riverside-3d.png) |
| 色保持＋弱bilateral | ![認識](floor-plan-preprocessing-assets/bilateral-riverside-recognition.png) | ![3D](floor-plan-preprocessing-assets/bilateral-riverside-3d.png) |
| 色保持＋CLAHE | ![認識](floor-plan-preprocessing-assets/clahe-riverside-recognition.png) | ![3D](floor-plan-preprocessing-assets/clahe-riverside-3d.png) |
| 色保持＋Sauvola | ![認識](floor-plan-preprocessing-assets/sauvola-riverside-recognition.png) | ![3D](floor-plan-preprocessing-assets/sauvola-riverside-3d.png) |
| 色保持＋median 3px | ![認識](floor-plan-preprocessing-assets/median-riverside-recognition.png) | ![3D](floor-plan-preprocessing-assets/median-riverside-3d.png) |
| 無彩色だけ白背景合成 | ![認識](floor-plan-preprocessing-assets/safe-alpha-riverside-recognition.png) | ![3D](floor-plan-preprocessing-assets/safe-alpha-riverside-3d.png) |
| 無彩色の白補完＋黒背景限定CLAHE（採用） | ![認識](floor-plan-preprocessing-assets/guarded-clahe-riverside-recognition.png) | ![3D](floor-plan-preprocessing-assets/guarded-clahe-riverside-3d.png) |

## 再実行

リポジトリルート、通常のPlaywrightブラウザをインストール済みの環境で実行する。比較キャプチャは通常E2Eと同じ実行ロックを使う。過去の改善実験の成果物は上書きしない。

```bash
node frontend/scripts/floor-plan-preprocessing/capture.mjs
node --test --test-isolation=none frontend/scripts/floor-plan-preprocessing/variants.test.js
```

一部更新は `--modes=safe-alpha,guarded-clahe`、`--images=cottage` で指定できる（最初に全件実行が必要）。生の候補・生成モデル・指標は同ディレクトリの `raw/`・`models/`・`run.json` に保存する。`manifest.json`に基準コミットと入力・注釈・方式コードのSHA-256、`synthetic-results.json`に透明背景と1px線の合成診断を残す。比較スクリプトと不採用方式は手動実験専用で、製品やCIの起動経路には含めない。

今回は最終の認識と3Dを保存した。前処理ごとのグレースケール・二値化中間画像、厳密なピークメモリ・処理速度比較は未収集。傾き補正、高解像度化、文字領域の消去は未実装。次は未知の追加図面と傾きのある合成入力で副作用を確認し、色付き透明図面の文字除外を検討する。

## 製品の検証

Codespaces上で以下を実行し成功した。GitHub Actionsと実機では未確認。

| 検証 | 結果 |
| --- | --- |
| `npm run test:unit --prefix frontend` | 8ファイル成功。透明・半透明・無地・黒背景の1px線の回帰3ケースを追加 |
| `npm run build --prefix frontend` | 成功。既存のチャンクサイズ警告あり |
| `npm run test:e2e --prefix frontend` | 全58件成功（UI46、実WebGL12）。既存4枚・追加2枚を含む |
| `npm run test:floor-plan --prefix frontend` | 成功。現行の部分網羅率は白黒99.7%、着色95.8%、黒背景86.5%、木目91.2%。比較先は以前から保存している線データで、今回のb49d9cd基準とは別 |
| `node --test --test-isolation=none frontend/scripts/floor-plan-preprocessing/variants.test.js` | 比較専用の合成9ケース成功。medianによる細線消失も不採用理由として検証 |
| `git diff --check` | 成功 |

追加E2Eの初版は、取込後に自動で開く入力欄を閉じてしまい失敗した。テスト操作を修正して両画面幅の追加2件を確認し、その後に通常コマンド全58件を再実行した。タイムアウトやリトライ回数は増やしていない。
