# 扉・窓を別に扱う認識・3Dの検証

検証日: 2026-11-10。Issue #28 / 基準コミット `023c70d`。前段の[調査](floor-plan-opening-detection-research.md)を基に、AIを使わない候補抽出と開口への変換を試した。

## 結論と採否

**扉の候補を見つける用途には効果があった。製品への自動適用は見送る。** 全6枚で、製品の壁・円検出・幾何照合・試験的な開口変換を比較し、途中で見つけた誤りに対する改善も全6枚で検証した。全8方式×6枚＝48ケース、認識と実WebGLの96画像を保存した。

- 最終の`verified`は扉候補5件、窓・引き戸らしい帯19件。扉候補5件は原図で対応する扉の位置を目視確認した。扉の全数は未注釈であり、適合率100%・高い再現率を実証したという意味ではない。
- 初期の幾何照合はCottageの実壁を扉板へ誤認した。太い壁を扉板に使わず、円弧の内外に余白があることも確認すると、Cottageの扉候補は4件→0件になった。ただし本物の円弧なしの扉も拾えていない。
- 初期候補の自動変換はimage1で必要な壁の検証点を2点失い、Cottageの部分壁網羅率も88.95%→83.69%に落ちた。壁の網羅率や候補本数だけで採用してはいけない例となった。
- 最終版の試験変換では、黒背景図面で2件、木目図面で1件の開口を作成した。ほか4枚のモデルは製品と同一。既存の部分的な壁・開口の検証点には新たなエラーが出なかったが、未注釈の箇所まで正しい保証ではない。
- 窓らしい帯には引き戸・水回り・階段付近も混ざる。帯を窓として自動で穴あけする処理は最終版では止めた。種類・下端・高さの確定は未解決。

`verified`は実験の識別名であり、未知の画像への認識性能の検証済みを意味しない。閾値を追加した後の6枚は、方式の調整にも使った探索用セットであり、独立評価ではない。

## 実装した方法

製品コードは変更せず、`scripts/floor-plan-openings/`に手動実験用の処理を配置した。製品と同じOpenCV.js 4.12.0-release.1・実Workerで壁を抽出し、その結果と元のRGBAから記号候補を求めた。画像は端末内のローカルHTTPで読み、外部へ送信していない。

| 方式 | 検証内容 |
| --- | --- |
| baseline | 現在の製品の壁とモデル |
| hough | 生の円候補。扉・窓の分類やモデル変更はしない |
| geometry | 壁の端・角から隙間候補を作り、仮の支点から円弧と扉板の画素支持を検査。平行な細線の帯も別に抽出 |
| apply | 初期候補を仮の扉・窓へ変換。壁の両側または開口区間を含む壁と対応付け、モデルを検証 |
| strict | 円弧支持45%→65%、扉板支持60%→75%、円弧が存在する角度区間3/5→4/5。太い壁の混入も厳しく制限 |
| strict-apply | 窓・引き戸の帯を自動変換せず、開口の途中に直交する壁があれば変換しない |
| verified | strictに、既知の太い壁を扉板に使わない条件と、円弧の内外の余白を追加 |
| verified-apply | verified候補をstrict-applyと同じ保護条件で変換 |

候補は画像座標のまま記録し、実寸モデルへの変換と分けた。円弧は隙間の両端を支点候補とし、左右の90度の開きを調べる。今回は円弧の輪郭列の切り出し、任意の開き角、円弧なしの扉、回転テンプレート、原寸の局所画像には対応していない。これらを全部実装して比較したとは扱わない。

扉板と円弧は20点で画素支持を見て、太さに応じた周辺画素も参照する。破線も一定範囲で残せる。最終版は円弧の半径方向の内外が空いている点を9点以上必要とする。木目や着色によりこの条件で本物の記号まで落ちる可能性がある。

窓らしい帯は、壁近傍の同方向の細線が2〜4組あることを条件にした。単一の色帯の窓や、隙間候補の両端が壁から得られない窓は対象外。扉が不採用になると帯の候補へ回る場合があるため、窓の分類性能とは別である。

## 自動変換で分かった問題

候補の左右の壁が同一直線に並ぶか、既存の壁がその区間を含む場合だけ、開口を持つ壁へ変換した。L字の角から隙間を推定したケースでは、候補自体が正しくても壁の両側がなく、変換を見送ることがある。玄関などに多く、壁を無理に延長していない。

既存の開口は保護し、候補ごとに`isFloorPlan`で検証する。高さ2.4mのモデルに扉高2.0m、試験用の窓下端0.84m・高1.1mを仮定した。これらは画像から推定した値ではない。最終版の自動変換は窓の帯を適用しない。

既存の壁を一本にまとめると、候補線と一致する壁の網羅率が上がることがある。しかし、実際の壁を削ったり入口を誤って窓としたりする可能性があり、数値の上昇を認識の正解率とは呼ばない。

## 全画像の候補と自動適用

各セルは「扉候補 / 窓・引き戸の帯」。円検出は円の個数だけを別に記す。候補数は認識精度ではない。

| 図面 | 円候補 | 初期の幾何照合 | 厳格化 | 実壁保護を追加 | 最終版の適用数 |
| --- | --- | --- | --- | --- | --- |
| monochrome | 70 | 4 / 1 | 2 / 1 | 1 / 1 | 0 |
| colored | 133 | 12 / 2 | 8 / 2 | 1 / 5 | 0 |
| dark-background | 296 | 21 / 2 | 12 / 3 | 2 / 5 | 2 |
| textured | 187 | 16 / 0 | 9 / 0 | 1 / 0 | 1 |
| cottage | 52 | 4 / 0 | 4 / 0 | 0 / 0 | 0 |
| riverside | 430 | 13 / 8 | 2 / 7 | 0 / 8 | 0 |

### 部分注釈と監査

原図から事前に選んだ24の記号・隙間と、扉・窓ではない領域を用意した。これは全数正解ではない。窓と引き戸の意味を断定できない枠は`window-band`、Riversideの種類不明の隙間は`opening`としている。未注釈の候補を自動で誤検出には数えない。

monochromeの2つの対象を玄関・浴室側の開口へ置き換え、小窓の区間も後から見直した。これは座標補正に加えて**評価対象の再選定**を含む。元の`references-initial.json`と、事後の`references.json`を両方残し、両方の結果を`evaluation.json`に保存した。事後の一致数を独立した精度向上の根拠に使わない。

下表は最終候補の部分一致数。向き・中心線からの距離・区間の重なり・長さ比を使い、一対一で対応付ける。円候補は扉・枠の区間を持たないため、同じ一致判定を適用しない。

| 図面 | 事前の4対象に一致 | 再選定後の4対象に一致 | 指定した除外領域内の候補中心 |
| --- | --- | --- | --- |
| monochrome | 1 / 4 | 2 / 4 | 0 |
| colored | 2 / 4 | 2 / 4 | 0 |
| dark-background | 1 / 4 | 1 / 4 | 0 |
| textured | 1 / 4 | 1 / 4 | 0 |
| cottage | 0 / 4 | 0 / 4 | 0 |
| riverside | 0 / 4 | 0 / 4 | 1 |

Riversideの除外領域に残った1候補は階段付近。窓らしい線の帯を検出したことと、実際の窓であることを分けて扱う必要がある。image1でもLDKの扉が窓らしい帯として出ており、帯の自動適用は採用しない。

初期版と最終版を比べると、誤候補の抑制とともに取り逃がしも増える。選択した一部の対象への一致率を図面全体の再現率として報告しない。初期版・厳格版・最終版の全候補と未監査数は`evaluation.json`、位置・支点・支持率は`raw/`へ保存した。

### 壁・開口の部分評価

既存の部分参照（追加画像は監査済み版）も適用した。下表の網羅率は選んだ壁の中心線への一致で、全体の正解率ではない。既存の非壁領域内の線長・選択した開口点の遮蔽・指定した空白点の壁化は全方式0だった。

| 図面 | 製品の部分網羅率 | 初期自動変換 | 最終自動変換 | 初期の必要壁点の欠落 | 最終の必要壁点の欠落 |
| --- | --- | --- | --- | --- | --- |
| monochrome | 99.73% | 99.88% | 99.73% | 0 | 0 |
| colored | 95.82% | 98.18% | 95.82% | 2 | 0 |
| dark-background | 86.50% | 91.68% | 88.65% | 0 | 0 |
| textured | 91.23% | 93.93% | 91.23% | 0 | 0 |
| cottage | 88.95% | 83.69% | 88.95% | 0 | 0 |
| riverside | 54.32% | 54.32% | 54.32% | 0 | 0 |

床・全体寸法は全方式で固定した。最終変換で変更されるのはdark-backgroundとtexturedの壁だけで、他4枚のモデルは製品と完全一致することを確認した。

## 全6画像の認識・実3D

認識図の青は高さ0.5mの壁断面、緑は仮の床、オレンジは扉候補と扉板、紫は窓・引き戸らしい帯、赤は円候補。窓の腰壁があるため、窓の穴が平面図で白く見えるとは限らない。

3Dは壁の実際の箱の下端・上端を使って生成し、腰壁・垂れ壁も表示する。従来の比較ビューアで平面ポリゴンを全高まで伸ばすだけでは開口の高さを表現できないため、今回専用に高さ付きの描画を使った。合成テストでも窓の高さ0.5mは壁、1.2mは穴となることを検証した。

比較ビューアは画像全幅を8m、壁高を2.4mに揃えた実WebGL表示で、製品のReact画面そのものではない。手修正なし。候補表示だけのモードでは3Dは製品と同じで、開口変換モードだけ箱を分割している。

### monochrome

| 方式 | 認識 | 3D |
| --- | --- | --- |
| 製品の壁 | ![認識](floor-plan-opening-experiment-assets/baseline-monochrome-recognition.png) | ![3D](floor-plan-opening-experiment-assets/baseline-monochrome-3d.png) |
| 円候補のみ | ![認識](floor-plan-opening-experiment-assets/hough-monochrome-recognition.png) | ![3D](floor-plan-opening-experiment-assets/hough-monochrome-3d.png) |
| 円弧・扉板・壁の照合 | ![認識](floor-plan-opening-experiment-assets/geometry-monochrome-recognition.png) | ![3D](floor-plan-opening-experiment-assets/geometry-monochrome-3d.png) |
| 初期候補の開口変換 | ![認識](floor-plan-opening-experiment-assets/apply-monochrome-recognition.png) | ![3D](floor-plan-opening-experiment-assets/apply-monochrome-3d.png) |
| 支持条件を厳格化 | ![認識](floor-plan-opening-experiment-assets/strict-monochrome-recognition.png) | ![3D](floor-plan-opening-experiment-assets/strict-monochrome-3d.png) |
| 厳格版の開口変換 | ![認識](floor-plan-opening-experiment-assets/strict-apply-monochrome-recognition.png) | ![3D](floor-plan-opening-experiment-assets/strict-apply-monochrome-3d.png) |
| 実壁との混同も抑制 | ![認識](floor-plan-opening-experiment-assets/verified-monochrome-recognition.png) | ![3D](floor-plan-opening-experiment-assets/verified-monochrome-3d.png) |
| 壁保護付き開口変換 | ![認識](floor-plan-opening-experiment-assets/verified-apply-monochrome-recognition.png) | ![3D](floor-plan-opening-experiment-assets/verified-apply-monochrome-3d.png) |

### colored

| 方式 | 認識 | 3D |
| --- | --- | --- |
| 製品の壁 | ![認識](floor-plan-opening-experiment-assets/baseline-colored-recognition.png) | ![3D](floor-plan-opening-experiment-assets/baseline-colored-3d.png) |
| 円候補のみ | ![認識](floor-plan-opening-experiment-assets/hough-colored-recognition.png) | ![3D](floor-plan-opening-experiment-assets/hough-colored-3d.png) |
| 円弧・扉板・壁の照合 | ![認識](floor-plan-opening-experiment-assets/geometry-colored-recognition.png) | ![3D](floor-plan-opening-experiment-assets/geometry-colored-3d.png) |
| 初期候補の開口変換 | ![認識](floor-plan-opening-experiment-assets/apply-colored-recognition.png) | ![3D](floor-plan-opening-experiment-assets/apply-colored-3d.png) |
| 支持条件を厳格化 | ![認識](floor-plan-opening-experiment-assets/strict-colored-recognition.png) | ![3D](floor-plan-opening-experiment-assets/strict-colored-3d.png) |
| 厳格版の開口変換 | ![認識](floor-plan-opening-experiment-assets/strict-apply-colored-recognition.png) | ![3D](floor-plan-opening-experiment-assets/strict-apply-colored-3d.png) |
| 実壁との混同も抑制 | ![認識](floor-plan-opening-experiment-assets/verified-colored-recognition.png) | ![3D](floor-plan-opening-experiment-assets/verified-colored-3d.png) |
| 壁保護付き開口変換 | ![認識](floor-plan-opening-experiment-assets/verified-apply-colored-recognition.png) | ![3D](floor-plan-opening-experiment-assets/verified-apply-colored-3d.png) |

### dark-background

| 方式 | 認識 | 3D |
| --- | --- | --- |
| 製品の壁 | ![認識](floor-plan-opening-experiment-assets/baseline-dark-background-recognition.png) | ![3D](floor-plan-opening-experiment-assets/baseline-dark-background-3d.png) |
| 円候補のみ | ![認識](floor-plan-opening-experiment-assets/hough-dark-background-recognition.png) | ![3D](floor-plan-opening-experiment-assets/hough-dark-background-3d.png) |
| 円弧・扉板・壁の照合 | ![認識](floor-plan-opening-experiment-assets/geometry-dark-background-recognition.png) | ![3D](floor-plan-opening-experiment-assets/geometry-dark-background-3d.png) |
| 初期候補の開口変換 | ![認識](floor-plan-opening-experiment-assets/apply-dark-background-recognition.png) | ![3D](floor-plan-opening-experiment-assets/apply-dark-background-3d.png) |
| 支持条件を厳格化 | ![認識](floor-plan-opening-experiment-assets/strict-dark-background-recognition.png) | ![3D](floor-plan-opening-experiment-assets/strict-dark-background-3d.png) |
| 厳格版の開口変換 | ![認識](floor-plan-opening-experiment-assets/strict-apply-dark-background-recognition.png) | ![3D](floor-plan-opening-experiment-assets/strict-apply-dark-background-3d.png) |
| 実壁との混同も抑制 | ![認識](floor-plan-opening-experiment-assets/verified-dark-background-recognition.png) | ![3D](floor-plan-opening-experiment-assets/verified-dark-background-3d.png) |
| 壁保護付き開口変換 | ![認識](floor-plan-opening-experiment-assets/verified-apply-dark-background-recognition.png) | ![3D](floor-plan-opening-experiment-assets/verified-apply-dark-background-3d.png) |

### textured

| 方式 | 認識 | 3D |
| --- | --- | --- |
| 製品の壁 | ![認識](floor-plan-opening-experiment-assets/baseline-textured-recognition.png) | ![3D](floor-plan-opening-experiment-assets/baseline-textured-3d.png) |
| 円候補のみ | ![認識](floor-plan-opening-experiment-assets/hough-textured-recognition.png) | ![3D](floor-plan-opening-experiment-assets/hough-textured-3d.png) |
| 円弧・扉板・壁の照合 | ![認識](floor-plan-opening-experiment-assets/geometry-textured-recognition.png) | ![3D](floor-plan-opening-experiment-assets/geometry-textured-3d.png) |
| 初期候補の開口変換 | ![認識](floor-plan-opening-experiment-assets/apply-textured-recognition.png) | ![3D](floor-plan-opening-experiment-assets/apply-textured-3d.png) |
| 支持条件を厳格化 | ![認識](floor-plan-opening-experiment-assets/strict-textured-recognition.png) | ![3D](floor-plan-opening-experiment-assets/strict-textured-3d.png) |
| 厳格版の開口変換 | ![認識](floor-plan-opening-experiment-assets/strict-apply-textured-recognition.png) | ![3D](floor-plan-opening-experiment-assets/strict-apply-textured-3d.png) |
| 実壁との混同も抑制 | ![認識](floor-plan-opening-experiment-assets/verified-textured-recognition.png) | ![3D](floor-plan-opening-experiment-assets/verified-textured-3d.png) |
| 壁保護付き開口変換 | ![認識](floor-plan-opening-experiment-assets/verified-apply-textured-recognition.png) | ![3D](floor-plan-opening-experiment-assets/verified-apply-textured-3d.png) |

### cottage

| 方式 | 認識 | 3D |
| --- | --- | --- |
| 製品の壁 | ![認識](floor-plan-opening-experiment-assets/baseline-cottage-recognition.png) | ![3D](floor-plan-opening-experiment-assets/baseline-cottage-3d.png) |
| 円候補のみ | ![認識](floor-plan-opening-experiment-assets/hough-cottage-recognition.png) | ![3D](floor-plan-opening-experiment-assets/hough-cottage-3d.png) |
| 円弧・扉板・壁の照合 | ![認識](floor-plan-opening-experiment-assets/geometry-cottage-recognition.png) | ![3D](floor-plan-opening-experiment-assets/geometry-cottage-3d.png) |
| 初期候補の開口変換 | ![認識](floor-plan-opening-experiment-assets/apply-cottage-recognition.png) | ![3D](floor-plan-opening-experiment-assets/apply-cottage-3d.png) |
| 支持条件を厳格化 | ![認識](floor-plan-opening-experiment-assets/strict-cottage-recognition.png) | ![3D](floor-plan-opening-experiment-assets/strict-cottage-3d.png) |
| 厳格版の開口変換 | ![認識](floor-plan-opening-experiment-assets/strict-apply-cottage-recognition.png) | ![3D](floor-plan-opening-experiment-assets/strict-apply-cottage-3d.png) |
| 実壁との混同も抑制 | ![認識](floor-plan-opening-experiment-assets/verified-cottage-recognition.png) | ![3D](floor-plan-opening-experiment-assets/verified-cottage-3d.png) |
| 壁保護付き開口変換 | ![認識](floor-plan-opening-experiment-assets/verified-apply-cottage-recognition.png) | ![3D](floor-plan-opening-experiment-assets/verified-apply-cottage-3d.png) |

### riverside

| 方式 | 認識 | 3D |
| --- | --- | --- |
| 製品の壁 | ![認識](floor-plan-opening-experiment-assets/baseline-riverside-recognition.png) | ![3D](floor-plan-opening-experiment-assets/baseline-riverside-3d.png) |
| 円候補のみ | ![認識](floor-plan-opening-experiment-assets/hough-riverside-recognition.png) | ![3D](floor-plan-opening-experiment-assets/hough-riverside-3d.png) |
| 円弧・扉板・壁の照合 | ![認識](floor-plan-opening-experiment-assets/geometry-riverside-recognition.png) | ![3D](floor-plan-opening-experiment-assets/geometry-riverside-3d.png) |
| 初期候補の開口変換 | ![認識](floor-plan-opening-experiment-assets/apply-riverside-recognition.png) | ![3D](floor-plan-opening-experiment-assets/apply-riverside-3d.png) |
| 支持条件を厳格化 | ![認識](floor-plan-opening-experiment-assets/strict-riverside-recognition.png) | ![3D](floor-plan-opening-experiment-assets/strict-riverside-3d.png) |
| 厳格版の開口変換 | ![認識](floor-plan-opening-experiment-assets/strict-apply-riverside-recognition.png) | ![3D](floor-plan-opening-experiment-assets/strict-apply-riverside-3d.png) |
| 実壁との混同も抑制 | ![認識](floor-plan-opening-experiment-assets/verified-riverside-recognition.png) | ![3D](floor-plan-opening-experiment-assets/verified-riverside-3d.png) |
| 壁保護付き開口変換 | ![認識](floor-plan-opening-experiment-assets/verified-apply-riverside-recognition.png) | ![3D](floor-plan-opening-experiment-assets/verified-apply-riverside-3d.png) |

## 再実行と成果物

通常のPlaywrightブラウザをインストールした環境で、リポジトリルートから実行する。比較キャプチャは通常E2Eと同じ実行ロックを使い、同時実行しない。

```bash
node --test --test-isolation=none frontend/scripts/floor-plan-openings/detect.test.js
node frontend/scripts/floor-plan-openings/capture.mjs
node frontend/scripts/floor-plan-openings/evaluate.mjs
```

一部比較は`--modes=verified,verified-apply`・`--images=colored`で絞れる。前処理・過去の実装比較の成果物とは別のディレクトリへ保存する。

- `baseline-worker.js`: 製品のWorkerを固定したもの。
- `raw/`: 生の壁と候補。`run.json`: 実行と変換の結果。`models/`: 各ケースの高さ付き形状・実寸モデル。
- `evaluation.json`: 事前・事後の部分注釈との比較。
- `manifest.json`: 入力・注釈・スクリプトのSHA-256と環境の前提。

この手動実験は製品の起動・保存形式・APIを変更せず、通常のユニットテスト・CIへは組み込まない。新しいバックエンド対応は発生していない。

## 検証と残作業

- 実OpenCV Worker・実WebGLで48ケース完了。ページエラーと描画エラーなし。全96画像の作成を確認。
- 実験用の合成12テスト成功。連続／破線円弧、薄い扉板、窓帯、実壁・白い隙間の除外、戸口の上部、窓の腰壁、既存開口・交差壁・入力の保護を確認。
- 通常ユニットテスト8ファイル、本番ビルド成功。ビルドの既存チャンクサイズ警告は残る。
- 通常E2E全58件成功（UI46件・実WebGL12件）。こちらは既存の製品の回帰検証で、実験用の候補表示や自動変換が製品に組み込まれたという意味ではない。GitHub Actions・実機は未確認。

次の優先課題は、候補表示での確認と、L字の角を含む正しい壁への対応付けである。扉板の任意角度・円弧なしの記号を追加し、窓・引き戸・設備の意味の区別と、別の図面での評価を進める。製品の自動穴あけへ反映する前に、記号の全数注釈と高さ別の誤削除検証が必要。
