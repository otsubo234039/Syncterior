# 間取り認識・3D化の実装比較

検証日: 2026-11-09。Issue #28 / `feat/#28` の作業中の現行実装と、以前に挙げた3候補を比較した。AIモデルは使用していない。

## 結論

**4画像を通して、そのまま現行方式へ置き換えられる候補は見つからなかった。現行のOpenCV.jsを維持し、FloorplanToBlender3dの壁輪郭の扱いと、vectorizerの「部屋を探すための仮閉鎖と実際の壁の分離」を部分的な参考にするのがよい。**

| 候補 | 実測・目視で分かったこと | 今回の判断 |
| --- | --- | --- |
| 現行OpenCV.js | 4画像で外周・間仕切りが比較的安定し、選択した着色・木目の入口点を塞がない。細い壁の欠落と仮の床は残る | 継続。完全な認識とは扱わない |
| FloorplanToBlender3d | 白黒・着色の太い壁の輪郭が参考になる。黒背景では室内まで壁の塊となり、木目では家具も壁になる。扉照合にも誤検出 | 全置換しない。輪郭抽出のみ追加実験の候補 |
| floorplan-vectorizer | 部屋領域の抽出は動いたが、文字・設備・タイルも拾う。標準の入口閉鎖を3Dの壁へ使うと開口を失う | 全置換しない。部屋推定用マスクと壁マスクを分ける設計を参考にする |
| Blueprint3D | 現行の検出結果を4画像とも2D・3D表示できた。今回の隙間を持つ壁入力では閉領域0 | 認識器ではない。編集UI・壁グラフの参考。導入だけでは認識は改善しない |

製品の認識処理・UI・依存関係は今回の比較で変更していない。以下の3Dは実際のWebGLスクリーンショットで、手で見栄えを修正したモデルではない。

## 比較条件と実行範囲

- 画像はリポジトリに追加された全4枚。元解像度335×448、554×554、386×518、434×434。入力画像は下記に掲載。
- 画像ごとの閾値調整、壁・開口・床の手修正なし。外部2認識実装は標準処理を呼び、vectorizerだけ標準と `seal_doors=False` の2設定を全画像に同じ条件で適用。
- 認識比較は現行＋FloorplanToBlender3d＋vectorizerの2設定で **4方式×4画像＝16ケース**。別にBlueprint3Dへの現行結果の読込を **4ケース** 実施。
- 現行方式は製品のOpenCV Workerを実際のChromium内で実行。既存の実寸モデルから描画に使う壁ボックスをポリゴンへ変換した。
- FloorplanToBlender3dは上流 `Wall.generate` と同じ `wall_filter → precise_boxes → outer_contours → remove_walls_not_in_contour` を呼び、別途 `feature_match` で扉・窓を照合した。Blender本体による `.blend` 出力・開閉する建具の生成までは実行していない。扉検出の結果で壁を自動修正する独自処理も加えていない。
- vectorizerは上流 `detect_rooms` の返す壁マスクと床候補を使用。標準では入口閉鎖後のマスクが返る。輪郭の穴も保持した。既定の部屋輪郭簡略化・直交化は上流のまま。
- 現行と外部2認識器の3Dは、検出した壁領域を共通のThree.js表示器で高さ2.4mに押し出したもの。画像全幅を8mと仮定し、同じ画像ではカメラ・材質・ライトを揃えた。実寸の正解ではない。現行アプリの8mの取り方とも異なるため、今回の画像同士で比較する。外部候補が同じ3D表示器を提供するという意味ではない。
- Blueprint3Dは上流の2D編集器・Three.js 0.69表示器を実際に実行。現行モデルの端点を共有cornerへ変換し、壁厚を設定する最小アダプターで入力した。交点の追加・壁の結合・仮閉鎖・ドアオブジェクトの追加なし。閉領域0はこの入力条件の結果であり、Blueprint3D一般の床生成機能が動かないという意味ではない。テクスチャ・寸法ラベル・光源は上流のものなので共通表示器との見た目の明るさは比較しない。
- 最終の20ケースはすべて完走。画像は認識重ね合わせ／2D編集表示20枚＋3D20枚＝40枚。ブラウザの未捕捉エラーを検査した。モバイル性能・全編集操作・未知画像・本番組込・CI実行は今回の比較対象外。

## 部分注釈による比較

既存の `e2e/fixtures/floor-plans/references.json` を変更せず使用。図面全体の正解データではなく、開発中に選んだ壁・非壁領域・入口点・出っ張り内外の点だけを評価する。

- **部分壁の近傍カバー**: 注釈した各壁線を約1px間隔でサンプリングし、壁領域まで4px以内の割合を線ごとに平均。全方式で同じラスタ評価を使う。既存の「向きを考慮した中心線網羅率」とは別の指標で、過去の95.8%等と直接比較しない。室内全体を塗りつぶしても100%になるため単独で順位を付けない。
- **非壁領域の壁画素**: 指定した文字・浴槽・家具・タイル領域内の壁画素数。少ないほど、この指定範囲では混入が少ない。領域外の誤検出や全体の画素精度は示さない。線幅を含むため、現行でも中心線の既存評価が0pxだった領域に少数の画素が入る場合がある。
- **入口を塞ぐ点**: 着色図面の6入口18点、木目図面の2入口6点が壁ポリゴン内にある数。白黒・黒背景はこの注釈がないため「未注釈」。0でも入口全体・全図面を保証しない。
- **出っ張り**: 着色図面のキッチン横だけ、内部2点の欠落／外部2点の壁混入を調べる。
- Blueprint3Dは認識が現行と同じなので、別の認識スコアは付けない。

| 図面 | 方式 | 部分壁の近傍カバー | 非壁領域の壁画素 | 入口を塞ぐ点 | 出っ張り内部欠落 / 外部混入 |
| --- | --- | ---: | ---: | --- | --- |
| 白黒図面 | 現行 OpenCV.js | 99.9% | 39px | 未注釈 | 未注釈 |
| 白黒図面 | FloorplanToBlender3d | 84.3% | 278px | 未注釈 | 未注釈 |
| 白黒図面 | vectorizer：標準（入口閉鎖） | 85.9% | 161px | 未注釈 | 未注釈 |
| 白黒図面 | vectorizer：入口を閉じない | 85.3% | 83px | 未注釈 | 未注釈 |
| 着色図面・image1 | 現行 OpenCV.js | 96.9% | 0px | 0 / 18 | 0 / 0 |
| 着色図面・image1 | FloorplanToBlender3d | 85.1% | 209px | 2 / 18 | 0 / 2 |
| 着色図面・image1 | vectorizer：標準（入口閉鎖） | 100.0% | 3,365px | 18 / 18 | 0 / 0 |
| 着色図面・image1 | vectorizer：入口を閉じない | 98.2% | 1,729px | 0 / 18 | 1 / 0 |
| 黒背景の図面 | 現行 OpenCV.js | 78.5% | 0px | 未注釈 | 未注釈 |
| 黒背景の図面 | FloorplanToBlender3d | 100.0% | 7,846px | 未注釈 | 未注釈 |
| 黒背景の図面 | vectorizer：標準（入口閉鎖） | 100.0% | 2,143px | 未注釈 | 未注釈 |
| 黒背景の図面 | vectorizer：入口を閉じない | 94.3% | 1,328px | 未注釈 | 未注釈 |
| 木目・家具入りの図面 | 現行 OpenCV.js | 93.3% | 51px | 0 / 6 | 未注釈 |
| 木目・家具入りの図面 | FloorplanToBlender3d | 78.1% | 2,207px | 1 / 6 | 未注釈 |
| 木目・家具入りの図面 | vectorizer：標準（入口閉鎖） | 100.0% | 2,802px | 2 / 6 | 未注釈 |
| 木目・家具入りの図面 | vectorizer：入口を閉じない | 99.9% | 564px | 0 / 6 | 未注釈 |

黒背景のFloorplanToBlender3dは近傍カバー100%でも非壁領域7,846pxを塗りつぶしている。木目のvectorizer標準も近傍カバー100%だが3Dは大きな塊になる。見逃しを減らすことと、正しい壁だけを作ることは別に評価する必要がある。

## 全画像の認識結果と3D

青は検出壁、緑は床候補、橙枠はFloorplanToBlender3dの扉候補。橙枠も自動推定で正解ではない。Blueprint3Dの左列は認識画像ではなく、現行結果を読み込んだ上流の2D編集表示。画像をクリックすると元の大きさで確認できる。

### 白黒図面 — `images.jpg`

![白黒図面の入力](floor-plan-comparison-assets/monochrome-input.jpg)

#### 現行 OpenCV.js

主な外周・間仕切り・バルコニー枠を保持。床は従来どおり仮の長方形。薄い部材が並ぶ箇所は3Dで継ぎ目が目立つ。

| 認識重ね合わせ | 3D表示 |
| --- | --- |
| ![白黒図面・現行 OpenCV.js・認識重ね合わせ](floor-plan-comparison-assets/current-monochrome-recognition.png) | ![白黒図面・現行 OpenCV.js・3D](floor-plan-comparison-assets/current-monochrome-3d.png) |

[検出した形状JSON](floor-plan-comparison-assets/models/current-monochrome.json)

#### FloorplanToBlender3d

主要な太い壁を輪郭として抽出するが、細い玄関の辺やバルコニー側の枠が欠ける。扉候補の橙枠はCL内部を囲んでおり、正しい扉を検出したとは扱えない。

扉候補1、窓候補11。候補数は精度ではなく、特に木目・白黒の扉候補には誤検出がある。

| 認識重ね合わせ | 3D表示 |
| --- | --- |
| ![白黒図面・FloorplanToBlender3d・認識重ね合わせ](floor-plan-comparison-assets/blender-monochrome-recognition.png) | ![白黒図面・FloorplanToBlender3d・3D](floor-plan-comparison-assets/blender-monochrome-3d.png) |

[検出した形状JSON](floor-plan-comparison-assets/models/blender-monochrome.json)

#### vectorizer：標準（入口閉鎖）

閉鎖処理により壁・入口が太く連結する。床候補14は部屋数ではなく、設備や閉じた小領域も混在する。

床候補数: 14（正しい部屋数ではない）。

| 認識重ね合わせ | 3D表示 |
| --- | --- |
| ![白黒図面・vectorizer：標準（入口閉鎖）・認識重ね合わせ](floor-plan-comparison-assets/vectorizer-sealed-monochrome-recognition.png) | ![白黒図面・vectorizer：標準（入口閉鎖）・3D](floor-plan-comparison-assets/vectorizer-sealed-monochrome-3d.png) |

[検出した形状JSON](floor-plan-comparison-assets/models/vectorizer-sealed-monochrome.json)

#### vectorizer：入口を閉じない

大きな白い領域は開くが、部屋名・設備が細い柱や壁となって残る。床候補は1で、部屋ごとの分離はできていない。

床候補数: 1（正しい部屋数ではない）。

| 認識重ね合わせ | 3D表示 |
| --- | --- |
| ![白黒図面・vectorizer：入口を閉じない・認識重ね合わせ](floor-plan-comparison-assets/vectorizer-open-monochrome-recognition.png) | ![白黒図面・vectorizer：入口を閉じない・3D](floor-plan-comparison-assets/vectorizer-open-monochrome-3d.png) |

[検出した形状JSON](floor-plan-comparison-assets/models/vectorizer-open-monochrome.json)

#### Blueprint3D（現行の認識結果を入力）

31壁を読み込み2D・3D表示できた。閉領域は0で床を生成できず、現行の仮床とも異なる表示。寸法ラベルは上流標準のフィート・インチ表記。

| 2D編集表示（現行由来） | 3D表示 |
| --- | --- |
| ![白黒図面・Blueprint3D（現行の認識結果を入力）・2D編集表示（現行由来）](floor-plan-comparison-assets/blueprint-monochrome-recognition.png) | ![白黒図面・Blueprint3D（現行の認識結果を入力）・3D](floor-plan-comparison-assets/blueprint-monochrome-3d.png) |

### 着色図面・image1 — `images (1).jpg`

![着色図面・image1の入力](floor-plan-comparison-assets/colored-input.jpg)

#### 現行 OpenCV.js

選んだ6入口の18点はすべて開き、キッチン横の出っ張りの内部2点・外部2点も満たす。タイル・文字の指定領域への混入はない。床外形は未認識。

| 認識重ね合わせ | 3D表示 |
| --- | --- |
| ![着色図面・image1・現行 OpenCV.js・認識重ね合わせ](floor-plan-comparison-assets/current-colored-recognition.png) | ![着色図面・image1・現行 OpenCV.js・3D](floor-plan-comparison-assets/current-colored-3d.png) |

[検出した形状JSON](floor-plan-comparison-assets/models/current-colored.json)

#### FloorplanToBlender3d

主要な壁の輪郭と厚さは見やすく、輪郭法の参考になる。一方、玄関とトイレ入口の端で計2点を塞ぐ。出っ張り外側の2点も壁となり、現行より太く膨らむ。バルコニー枠と上側の一部の細い壁も欠ける。

扉候補0、窓候補1。候補数は精度ではなく、特に木目・白黒の扉候補には誤検出がある。

| 認識重ね合わせ | 3D表示 |
| --- | --- |
| ![着色図面・image1・FloorplanToBlender3d・認識重ね合わせ](floor-plan-comparison-assets/blender-colored-recognition.png) | ![着色図面・image1・FloorplanToBlender3d・3D](floor-plan-comparison-assets/blender-colored-3d.png) |

[検出した形状JSON](floor-plan-comparison-assets/models/blender-colored.json)

#### vectorizer：標準（入口閉鎖）

壁の近傍カバーは100%になるが、注釈した入口18点すべてを塞ぐ。タイル・文字・浴槽も壁として残り、3Dに不要な柱・仕切りが増える。

床候補数: 20（正しい部屋数ではない）。

| 認識重ね合わせ | 3D表示 |
| --- | --- |
| ![着色図面・image1・vectorizer：標準（入口閉鎖）・認識重ね合わせ](floor-plan-comparison-assets/vectorizer-sealed-colored-recognition.png) | ![着色図面・image1・vectorizer：標準（入口閉鎖）・3D](floor-plan-comparison-assets/vectorizer-sealed-colored-3d.png) |

[検出した形状JSON](floor-plan-comparison-assets/models/vectorizer-sealed-colored.json)

#### vectorizer：入口を閉じない

入口18点は開くものの、扉の弧、浴槽、文字、玄関タイルが立体化される。出っ張り内部も1点欠ける。閉鎖を外すだけでは用途に十分ではない。

床候補数: 17（正しい部屋数ではない）。

| 認識重ね合わせ | 3D表示 |
| --- | --- |
| ![着色図面・image1・vectorizer：入口を閉じない・認識重ね合わせ](floor-plan-comparison-assets/vectorizer-open-colored-recognition.png) | ![着色図面・image1・vectorizer：入口を閉じない・3D](floor-plan-comparison-assets/vectorizer-open-colored-3d.png) |

[検出した形状JSON](floor-plan-comparison-assets/models/vectorizer-open-colored.json)

#### Blueprint3D（現行の認識結果を入力）

現行の41壁を表示できた。壁固有の厚さは読込アダプターで設定した。開口を隙間として持つ壁群からは部屋の閉領域を作れず、床は0。認識品質の改善は行っていない。

| 2D編集表示（現行由来） | 3D表示 |
| --- | --- |
| ![着色図面・image1・Blueprint3D（現行の認識結果を入力）・2D編集表示（現行由来）](floor-plan-comparison-assets/blueprint-colored-recognition.png) | ![着色図面・image1・Blueprint3D（現行の認識結果を入力）・3D](floor-plan-comparison-assets/blueprint-colored-3d.png) |

### 黒背景の図面 — `images (2).jpg`

![黒背景の図面の入力](floor-plan-comparison-assets/dark-background-input.jpg)

#### 現行 OpenCV.js

黒い外側背景を除外し、主な壁とデッキの一部を保持。細い灰色の間仕切りには引き続き欠落がある。

| 認識重ね合わせ | 3D表示 |
| --- | --- |
| ![黒背景の図面・現行 OpenCV.js・認識重ね合わせ](floor-plan-comparison-assets/current-dark-background-recognition.png) | ![黒背景の図面・現行 OpenCV.js・3D](floor-plan-comparison-assets/current-dark-background-3d.png) |

[検出した形状JSON](floor-plan-comparison-assets/models/current-dark-background.json)

#### FloorplanToBlender3d

黒い外側背景を含む外輪郭が1つの壁候補になる。上流Wall.generateと同じ外輪郭の扱いでは室内全体が塊になるため、そのまま採用できない。近傍カバー100%はこの失敗を示せない。

扉候補0、窓候補0。候補数は精度ではなく、特に木目・白黒の扉候補には誤検出がある。

| 認識重ね合わせ | 3D表示 |
| --- | --- |
| ![黒背景の図面・FloorplanToBlender3d・認識重ね合わせ](floor-plan-comparison-assets/blender-dark-background-recognition.png) | ![黒背景の図面・FloorplanToBlender3d・3D](floor-plan-comparison-assets/blender-dark-background-3d.png) |

[検出した形状JSON](floor-plan-comparison-assets/models/blender-dark-background.json)

#### vectorizer：標準（入口閉鎖）

家具・文字・水回り・デッキの線まで多数立体化される。床候補34は設備等を含む小領域で、実際の部屋数ではない。

床候補数: 34（正しい部屋数ではない）。

| 認識重ね合わせ | 3D表示 |
| --- | --- |
| ![黒背景の図面・vectorizer：標準（入口閉鎖）・認識重ね合わせ](floor-plan-comparison-assets/vectorizer-sealed-dark-background-recognition.png) | ![黒背景の図面・vectorizer：標準（入口閉鎖）・3D](floor-plan-comparison-assets/vectorizer-sealed-dark-background-3d.png) |

[検出した形状JSON](floor-plan-comparison-assets/models/vectorizer-sealed-dark-background.json)

#### vectorizer：入口を閉じない

閉鎖を外しても、ベッド・キッチン・タイル・デッキの家具が壁や柱として残る。現行の黒背景除去やノイズ抑制に置き換わる結果ではない。

床候補数: 24（正しい部屋数ではない）。

| 認識重ね合わせ | 3D表示 |
| --- | --- |
| ![黒背景の図面・vectorizer：入口を閉じない・認識重ね合わせ](floor-plan-comparison-assets/vectorizer-open-dark-background-recognition.png) | ![黒背景の図面・vectorizer：入口を閉じない・3D](floor-plan-comparison-assets/vectorizer-open-dark-background-3d.png) |

[検出した形状JSON](floor-plan-comparison-assets/models/vectorizer-open-dark-background.json)

#### Blueprint3D（現行の認識結果を入力）

現行65壁を表示できたが、欠けた壁は復元されない。閉領域0で床なし。認識と表示を切り分けて評価する必要がある。

| 2D編集表示（現行由来） | 3D表示 |
| --- | --- |
| ![黒背景の図面・Blueprint3D（現行の認識結果を入力）・2D編集表示（現行由来）](floor-plan-comparison-assets/blueprint-dark-background-recognition.png) | ![黒背景の図面・Blueprint3D（現行の認識結果を入力）・3D](floor-plan-comparison-assets/blueprint-dark-background-3d.png) |

### 木目・家具入りの図面 — `images (3).jpg`

![木目・家具入りの図面の入力](floor-plan-comparison-assets/textured-input.jpg)

#### 現行 OpenCV.js

主要外周と間仕切りを保持し、注釈した収納・寝室入口の6点は開く。家具の細い境界など、注釈領域外の誤検出も残っており完全ではない。

| 認識重ね合わせ | 3D表示 |
| --- | --- |
| ![木目・家具入りの図面・現行 OpenCV.js・認識重ね合わせ](floor-plan-comparison-assets/current-textured-recognition.png) | ![木目・家具入りの図面・現行 OpenCV.js・3D](floor-plan-comparison-assets/current-textured-3d.png) |

[検出した形状JSON](floor-plan-comparison-assets/models/current-textured.json)

#### FloorplanToBlender3d

壁に加え、ベッド・テーブル・ソファ等が太い塊として抽出される。玄関の突出部が欠け、寝室入口の1点も塞ぐ。扉候補の橙枠は浴槽で、扉の正検出ではない。

扉候補1、窓候補30。候補数は精度ではなく、特に木目・白黒の扉候補には誤検出がある。

| 認識重ね合わせ | 3D表示 |
| --- | --- |
| ![木目・家具入りの図面・FloorplanToBlender3d・認識重ね合わせ](floor-plan-comparison-assets/blender-textured-recognition.png) | ![木目・家具入りの図面・FloorplanToBlender3d・3D](floor-plan-comparison-assets/blender-textured-3d.png) |

[検出した形状JSON](floor-plan-comparison-assets/models/blender-textured.json)

#### vectorizer：標準（入口閉鎖）

木目と家具の線が閉鎖処理で大きく連結し、穴の多い塊になる。床候補37を部屋として使うことはできない。

床候補数: 37（正しい部屋数ではない）。

| 認識重ね合わせ | 3D表示 |
| --- | --- |
| ![木目・家具入りの図面・vectorizer：標準（入口閉鎖）・認識重ね合わせ](floor-plan-comparison-assets/vectorizer-sealed-textured-recognition.png) | ![木目・家具入りの図面・vectorizer：標準（入口閉鎖）・3D](floor-plan-comparison-assets/vectorizer-sealed-textured-3d.png) |

[検出した形状JSON](floor-plan-comparison-assets/models/vectorizer-sealed-textured.json)

#### vectorizer：入口を閉じない

塊化は軽減するが、家具や文字、建具の線が細い壁・柱となって多数残る。注釈した入口6点は開くが、全体として現行より修正が多いと目視で判断。修正時間は未計測。

床候補数: 22（正しい部屋数ではない）。

| 認識重ね合わせ | 3D表示 |
| --- | --- |
| ![木目・家具入りの図面・vectorizer：入口を閉じない・認識重ね合わせ](floor-plan-comparison-assets/vectorizer-open-textured-recognition.png) | ![木目・家具入りの図面・vectorizer：入口を閉じない・3D](floor-plan-comparison-assets/vectorizer-open-textured-3d.png) |

[検出した形状JSON](floor-plan-comparison-assets/models/vectorizer-open-textured.json)

#### Blueprint3D（現行の認識結果を入力）

現行68壁の編集用2D表示と3D表示ができた。閉領域0のため床は生成されない。自動認識の代替候補ではなく、編集UIの参考として扱う。

| 2D編集表示（現行由来） | 3D表示 |
| --- | --- |
| ![木目・家具入りの図面・Blueprint3D（現行の認識結果を入力）・2D編集表示（現行由来）](floor-plan-comparison-assets/blueprint-textured-recognition.png) | ![木目・家具入りの図面・Blueprint3D（現行の認識結果を入力）・3D](floor-plan-comparison-assets/blueprint-textured-3d.png) |

## 今後使うなら

1. **現行認識を維持する。** 比較した外部認識器は今回の4画像全体では改善にならない。特に黒背景・木目に対する前処理と、扉の開口・非壁領域の回帰検証を残す。
2. **輪郭法は限定して試す。** FloorplanToBlender3dの着色図面のように、太い壁の輪郭をそのまま使える例がある。現行の開口保持と組み合わせる余地はあるが、組合せによる改善は今回まだ検証していない。上流コードの全面移植を決める結果ではない。
3. **床・部屋の推定は別系統へ分ける。** vectorizerの仮閉鎖を部屋探索のみに使い、実際の壁には開口を残す構成を検討する。ただし、今回の標準出力の床候補は1〜37で設備等を含み、そのまま床の正解には使えない。
4. **Blueprint3DはUIの参考として使う。** 壁と頂点を共有する編集モデルは参考になる。今回の端点を渡すだけのアダプターから閉領域を得るには、壁グラフや開口表現の設計が必要。現行React Three Fiber表示を置き換える利点は今回確認していない。

## 実行環境・互換対応・出典

| 候補 | 今回取得したコミット | 読んだ実装・条件 |
| --- | --- | --- |
| FloorplanToBlender3d | `2da4c9532e9866b025c67aee17f87ff7e0b8db98` | [detect.py](https://github.com/grebtsew/FloorplanToBlender3d/blob/2da4c9532e9866b025c67aee17f87ff7e0b8db98/FloorplanToBlenderLib/detect.py)・[generator.py](https://github.com/grebtsew/FloorplanToBlender3d/blob/2da4c9532e9866b025c67aee17f87ff7e0b8db98/FloorplanToBlenderLib/generator.py)。GPL-3.0表記。上流ソースは製品へコピーしていない |
| floorplan-vectorizer | `511495000a63c7fafb85bbc0bf2af180148a071d` | [floorplan.py](https://github.com/Maximilianogc32/floorplan-vectorizer/blob/511495000a63c7fafb85bbc0bf2af180148a071d/scripts/floorplan.py)。MIT表記 |
| Blueprint3D | `cac8b62c1a3839e929334bdc125bf8a74866be9e` | [src](https://github.com/furnishup/blueprint3d/tree/cac8b62c1a3839e929334bdc125bf8a74866be9e/src)。LICENSE.txtはMIT表記。three 0.69.0、jQuery 2.1.4、TypeScript 5.9.3で隔離ビルド |

- Python 3.12、OpenCV 4.11.0.86、NumPy 1.26.4、Pillow 13.0.0。現行は製品同梱のOpenCV.js 4.12系。Python版とブラウザ版の速度比較はしない。`run.json`の現行時間はWorker読込・初期化等を含み、外部候補のCPU処理時間とは範囲が異なる。
- 環境の既定Python 3.14ではNumPy 1.26.4がソースビルドに入り、停止してPython 3.12へ変更した。最初の環境構築失敗を認識品質の評価には使っていない。
- FloorplanToBlender3dは元のままだと4画像とも `cv2.pointPolygonTest` にNumPy整数を渡す型エラー。比較ラッパーで点の座標をPython floatへ変換した。アルゴリズムの閾値や図面別の調整はしていない。黒背景で扉・窓照合内部のゼロ除算RuntimeWarningは出たが例外ではなく、候補0で完了。成功扱いでも結果は不適切なため不採用。
- Blueprint3Dの古いGrunt依存はnpmのpeer依存衝突でそのままインストールできなかった。必要なThree.js・jQuery・TypeScriptだけを別ディレクトリに置き、上流TypeScriptをコンパイルした。Linuxで参照パスの大文字小文字が異なる `jQuery.d.ts` / `floorPlan.ts` に同内容のファイルを用意した。TypeScript診断0。製品のpackage.json・lockfileは変更していない。
- Node.js・Chromiumは既存フロントのPlaywright環境。認識比較16ケース、Blueprint3D表示4ケースはいずれもCodespacesの単回実行。精度向上率やモバイル速度の保証ではない。

## 再実行

比較スクリプトは `frontend/scripts/floor-plan-comparison/`。外部コードを製品へ同梱せず、取得先・隔離環境・成果物を明示して呼び出す手動実験で、通常E2EやCIへは追加していない。キャプチャは通常E2Eと同じ実行ロックを取得する。E2Eや別の比較キャプチャと同時に実行しない。

以下はリポジトリルートから実行する。Python 3.12・pip・Playwright Chromiumが必要。外部依存のインストールと上流取得にはネット接続が必要。

```bash
mkdir -p /tmp/floor-plan-comparison
curl -L --fail https://codeload.github.com/grebtsew/FloorplanToBlender3d/zip/2da4c9532e9866b025c67aee17f87ff7e0b8db98 -o /tmp/floor-plan-comparison/blender.zip
curl -L --fail https://codeload.github.com/Maximilianogc32/floorplan-vectorizer/zip/511495000a63c7fafb85bbc0bf2af180148a071d -o /tmp/floor-plan-comparison/vectorizer.zip
curl -L --fail https://codeload.github.com/furnishup/blueprint3d/zip/cac8b62c1a3839e929334bdc125bf8a74866be9e -o /tmp/floor-plan-comparison/blueprint.zip
```

ZIPを展開し、トップディレクトリ名をそれぞれ `/tmp/floor-plan-comparison/FloorplanToBlender3d-master`、`floorplan-vectorizer-main`、`blueprint3d-master` に揃える。FloorplanToBlender3dの画像モデル `Images/Models/Doors/door.png` も必要。既存ファイルへ上書きせず、別の作業場所を使う場合はスクリプトの引数も合わせる。

```bash
python3.12 -m venv /tmp/floor-plan-comparison/venv312
/tmp/floor-plan-comparison/venv312/bin/python -m pip install opencv-python-headless==4.11.0.86 numpy==1.26.4 pillow==13.0.0
npm install --prefix /tmp/floor-plan-comparison/blueprint-runtime --ignore-scripts three@0.69.0 jquery@2.1.4 typescript@5.9.3
```

このCodespacesではPython 3.12のensurepipがなかったため、`python3.12 -m venv --without-pip ...` で環境を用意し、既存のpipから `python -m pip --python /tmp/floor-plan-comparison/venv312/bin/python install ...` で上記パッケージを導入した。

```bash
cp /tmp/floor-plan-comparison/blueprint3d-master/lib/jquery.d.ts /tmp/floor-plan-comparison/blueprint3d-master/lib/jQuery.d.ts
cp /tmp/floor-plan-comparison/blueprint3d-master/src/three/floorplan.ts /tmp/floor-plan-comparison/blueprint3d-master/src/three/floorPlan.ts
node frontend/scripts/floor-plan-comparison/build-blueprint.cjs /tmp/floor-plan-comparison
/tmp/floor-plan-comparison/venv312/bin/python frontend/scripts/floor-plan-comparison/recognize.py --sources /tmp/floor-plan-comparison --output /tmp/floor-plan-comparison/results
node frontend/scripts/floor-plan-comparison/capture.mjs /tmp/floor-plan-comparison
node frontend/scripts/floor-plan-comparison/capture.mjs /tmp/floor-plan-comparison --blueprint-only
/tmp/floor-plan-comparison/venv312/bin/python frontend/scripts/floor-plan-comparison/metrics.py --results /tmp/floor-plan-comparison/results
```

認識画像と3Dは `frontend/docs/floor-plan-comparison-assets/` へ出力する。引数なしのキャプチャは認識4方式を生成し、`--blueprint-only` はその結果を読んでBlueprint3Dを追加する。再実行で画像・JSONは上書きされる。Markdownの考察は手動記録なので、再実行後は数値と目視所見を更新する。

[実行記録](floor-plan-comparison-assets/run.json)・[部分評価の生データ](floor-plan-comparison-assets/metrics.json)。画像のSHA-256は以下のとおり。

| 入力 | SHA-256 |
| --- | --- |
| `images.jpg` | `d2d5eac21cbcd72e336412ba5b0e78429316031dabb62edd6e511f1ece291896` |
| `images (1).jpg` | `777b52516f3f1e82a6d0825023c08395f544cabc8d4c3a8e91c134b544e40b66` |
| `images (2).jpg` | `63f982d86db9c2fb94ec1a836498ccfb2f17ee4b707173a9e31795be69270307` |
| `images (3).jpg` | `bf96f95cf423a6a5582f54374698676d0ffd8d8e9dd8baad134f121dab343333` |

今回追加した比較処理と全20ケースの実行・40画像の生成、全レポートリンク、元画像4枚との一致を確認し、本番ビルドも成功した。実行中プロセスが所有するロックを用意して二重起動を試し、ロックを削除せず拒否することも確認した。製品コードに変更がないため、既存の通常E2E全件はこの比較のためには再実行していない。直前の製品修正でのE2E50件成功と、今回の外部実装の比較は区別する。
