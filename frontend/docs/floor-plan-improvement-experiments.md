# 間取り認識の改善実験

検証日: 2026-11-09。Issue #28 / `feat/#28`。前回の[外部実装比較](floor-plan-implementation-comparison.md)を踏まえ、フロントだけで可能な改善を試した。AI・外部推論APIは使っていない。

## 結論と今回採用した変更

**採用したのは「通常解析が空のときだけ有彩色の壁を残して一度再解析する」処理と、「実寸2cm未満の断片で間取り全体の生成が失敗しない」修正。** 線幅・端点・床の補正は効果や副作用を比較し、今回は製品へ組み込まなかった。

| 変更 | 確認結果 | 採否 |
| --- | --- | --- |
| 空結果時のみ有彩色で再解析 | 追加の色付き壁の図面で壁0本→30本、監査後の部分壁の網羅率0→88.95%。既存4枚と追加の歴史的図面は実寸モデルが完全一致 | 採用 |
| 実寸最小壁長の個別除外 | 同じWorker出力を旧コードへ渡すと生成エラー、修正版では109壁を持つモデルを生成 | 採用 |
| 輪郭による線幅補正 | 着色95.82→95.94%、木目91.23→91.26%と小さく、歴史的図面はわずかに低下 | 保留。認識対象の欠落を十分に解決しない |
| 端点補正（初案） | 画像の線画素を確認して伸ばしても、着色図面の入口を1点塞ぐ | 不採用 |
| 線幅＋端点 | 指標上は改善しても同じ入口の遮蔽が残る | 不採用 |
| 端点補正（厳格） | 全断面の支持・最大2pxに制限すると選択した開口の遮蔽は増えない。着色+0.16、黒背景+0.21、木目+0.45、歴史的図面+0.13ポイント程度 | 保留。小さな指標差だけで全体の接続品質が上がったとは判断しない |
| 閉領域から床輪郭を作る | 着色・木目で形状は得られたが、必要な床も切り落とす。ほか4枚は適用せず | 不採用 |
| 有彩色の除外を一律解除 | 追加の色付き壁には有効だが、木目図面の壁網羅率が低下 | 一律適用は不採用。空結果時だけ使う |

**部分的な幾何補正だけでは、未検出の細い壁・曲線・家具と壁の区別を大きく改善できなかった。** 採用した処理も、既存4枚の認識精度を大幅に上げる変更ではない。対応できなかった入力を増やすことと、生成失敗を防ぐことが今回の実装上の改善である。

## 実装と安全条件

### 条件付き再解析

通常の色除外・二値化・帯抽出・接続判定を先に実行する。候補が0本で、不透明な有彩色画素がある場合だけ、色の除外を外してもう一度同じ認識処理を実行する。既に壁が取れる画像では再解析しない。利用者に感度やモードを追加していない。

初回のOpenCV Matを破棄してから再解析し、OpenCV自体は再ロードしない。再解析は一度だけで、単色背景から壁を作らないこともテストする。画像の中止・タイムアウトは既存どおりWorker終了で処理する。解析に2回分かかる場合があるが、モバイル実機での性能は未測定。

制約として、黒い壁が一部だけ取れて残りの有彩色の壁が欠ける画像では、この救済を実行しない。また候補0の色付き家具だけの画像に対する誤検出を全面的に保証するものではない。結果の確認・手修正は引き続き必要。

### 大きい図面での実寸変換

画像上で2px以上でも、全幅約8mへ換算すると2cm未満になる短線がある。実寸モデルは2cm未満の壁を拒否するため、以前は1本でもあると全体の生成が失敗していた。変換後の長さが0.02m未満の候補だけを除き、残りを保持する。検証の下限を緩めたり、中央へ移動したりはしない。

[同じWorker出力での旧版／修正版の検証記録](floor-plan-improvement-assets/conversion-regression.json)。旧版は `b11497e` のコードを使用。入力は[歴史的図面のWorker出力](floor-plan-improvement-assets/raw/baseline-riverside.json)。比較全方式にこの変換修正を共通適用したため、下表の「改善前」は認識方式の改善前を指す。変換が失敗した旧版の3Dを成功したように掲載してはいない。

## 比較条件

- 既存4枚を全件使用。さらに、出典・利用条件を確認したWeb画像2枚を追加し、全方式を同じ6枚で比較した。
- 改善前を含む8方式×6画像＝**48ケース**。実際のOpenCV WorkerをChromiumで実行し、認識重ね合わせ48枚・実WebGLの3D48枚＝**96枚**を保存。全ケースでブラウザの未捕捉エラーなし。
- 画像ごとの閾値調整・手修正は行わない。正解注釈や画像名を認識処理の入力にしない。端点補正を厳しくする案は初案の遮蔽を見た後、色の条件付き適用は一律解除の副作用を見た後に追加し、どちらも全6枚で再評価した。
- 改善前のWorkerはGitコミット `b11497e` から読み込む。採用案 `color-fallback` だけ製品の現行Workerを読み、他案は基準Workerへ実験専用の処理を追加する。実寸変換・モデル検証は全方式で同じ。
- 3Dは前回と同じ比較用Three.js表示器。全画像幅を仮に8m、壁高2.4mとし、同じ画像で視点・材質・光源を統一する。製品の寸法校正や実寸の正解を示すものではない。製品の実Canvasも別途通常E2Eで確認する。
- 線幅補正は候補の周囲の連続した断面をサンプリングし、7/9以上の支持がある場合に中央値で補正。端点補正初案は80%以上の断面支持・最大4px、厳格案は100%支持・最大2px。両方とも白い隙間を距離だけで結合しない。
- 床推定は現行の壁だけをラスタ化し、水平・垂直の仮閉鎖で囲まれた領域を抽出する。大きさ・頂点数・壁端点の95%以上の包含と製品の多角形検証を条件にする。仮閉鎖した線は3Dの壁には使わない。条件を満たさない場合は仮の長方形を維持する。
- 追加画像はフォルダ名を `holdout/` としているが、原図の確認と試作後の継続利用を含むため、厳密な独立評価セットではない。未知の日本語図面・実機性能・実バックエンドとの結合は未確認。

## 追加画像の出典

| 画像 | 作者・年代 | 利用条件 | 元ファイル |
| --- | --- | --- | --- |
| 追加：歴史的な集合住宅図面 | Jacob Riis (1849–1914) / 1890 | Public domain (PD-US-expired; Wikimedia Commons file page) | [出典](https://commons.wikimedia.org/wiki/File:Jacob_Riis_-_Floor_Plan_Of_One_Division_In_The_Riverside_Buildings,_Showing_Six_Apartments.png) / [取得元](https://upload.wikimedia.org/wikipedia/commons/3/34/Jacob_Riis_-_Floor_Plan_Of_One_Division_In_The_Riverside_Buildings%2C_Showing_Six_Apartments.png) |
| 追加：色付き壁の住宅図面 | G.H.Jarrell / 2026-02-07 | CC0-1.0 | [出典](https://commons.wikimedia.org/wiki/File:4-Box_floorplan_as_described_by_T._Hubka,_vers2.png) / [取得元](https://upload.wikimedia.org/wikipedia/commons/5/52/4-Box_floorplan_as_described_by_T._Hubka%2C_vers2.png) |

元ファイルをそのまま `frontend/e2e/fixtures/floor-plans/holdout/` に保存し、作者・取得日・URL・SHA-256・縮小の有無を[sources.json](../e2e/fixtures/floor-plans/holdout/sources.json)へ記録した。歴史的図面は2625×1608から製品と同じ1024×627へ解析時だけ縮小。色付き住宅図面は848×903のまま。検索で見つけた `Apartment.png` は3Dの俯瞰図だったため、平面図の比較には採用していない。

## 評価と注釈の監査

既存4枚は従来の部分注釈を変更せず使用する。全壁や全画素の正解ではない。壁線を約1px間隔でサンプリングし、向きが合う候補線が4px以内にある割合を壁ごとに平均する。前回の外部実装比較で使った「壁領域までの距離」とは異なるので、数値を直接比較しない。

非壁線長は指定した文字・家具等の領域内に入った候補の長さ。開口の遮蔽は実際に描く壁ボックスの床上0.5mに対する点の包含判定。白黒・黒背景には開口の点注釈がなく、0は開口の検証済みという意味ではない。壁候補数は精度として扱わない。

追加図面の初回注釈は `b11497e` で最初の評価前に固定したが、原図の拡大・画素との照合で以下の誤りが見つかった。

- 色付き住宅図面の内壁参照x425は、実際の緑線415〜424pxの外側だった。x420へ修正し、窓・開口を含んでいた水平参照も連続した壁の区間へ分割した。
- 歴史的図面の文字領域410,420〜490,515には、実際の曲線階段壁も含まれていた。壁と重ならない文字部分410,420〜470,450へ修正した。

初回の[references.json](../e2e/fixtures/floor-plans/holdout/references.json)と評価[run.json](floor-plan-improvement-assets/run.json)を上書きで隠さず残し、[references-audited.json](../e2e/fixtures/floor-plans/holdout/references-audited.json)で全方式を再集計した。以下は監査後の値。例えば色付き図面の採用案は初回73.21%、監査後88.95%であり、差をアルゴリズムの改善として数えてはいない。

床については既存4枚の一部に、出力を見て失敗例として選んだ回帰点も追加した。これは探索用の検査であり独立評価ではない。着色の必要床4点／外側2点、木目の必要床3点／外側2点、追加住宅の必要床4点／外側3点、歴史的図面の必要床4点／外側4点。白黒・黒背景には床点の注釈なし。点だけでは床外形全体の正しさを保証しない。

### 全方式の部分評価

| 図面 | 方式 | 部分壁の網羅率 | 指定非壁領域の線長 | 入口遮蔽点 | 必要床の欠落点 / 外側を覆う床点 |
| --- | --- | ---: | ---: | --- | --- |
| 白黒図面 | 改善前の認識 | 99.73% | 0.00px | 未注釈 | 未注釈 |
| 白黒図面 | 輪郭から線幅補正 | 99.73% | 0.00px | 未注釈 | 未注釈 |
| 白黒図面 | 端点補正（初案） | 99.73% | 0.00px | 未注釈 | 未注釈 |
| 白黒図面 | 線幅＋端点 | 99.73% | 0.00px | 未注釈 | 未注釈 |
| 白黒図面 | 床輪郭の推定 | 99.73% | 0.00px | 未注釈 | 未注釈 |
| 白黒図面 | 色の除外を一律解除 | 99.73% | 0.00px | 未注釈 | 未注釈 |
| 白黒図面 | 端点補正（厳格） | 99.73% | 0.00px | 未注釈 | 未注釈 |
| 着色図面・image1 | 改善前の認識 | 95.82% | 0.00px | 0 | 0 / 2 |
| 着色図面・image1 | 輪郭から線幅補正 | 95.94% | 0.00px | 0 | 0 / 2 |
| 着色図面・image1 | 端点補正（初案） | 95.95% | 0.00px | 1 | 0 / 2 |
| 着色図面・image1 | 線幅＋端点 | 96.07% | 0.00px | 1 | 0 / 2 |
| 着色図面・image1 | 床輪郭の推定 | 95.82% | 0.00px | 0 | 2 / 0 |
| 着色図面・image1 | 色の除外を一律解除 | 95.78% | 0.00px | 0 | 0 / 2 |
| 着色図面・image1 | 端点補正（厳格） | 95.98% | 0.00px | 0 | 0 / 2 |
| 黒背景の図面 | 改善前の認識 | 76.32% | 0.00px | 未注釈 | 未注釈 |
| 黒背景の図面 | 輪郭から線幅補正 | 76.32% | 0.00px | 未注釈 | 未注釈 |
| 黒背景の図面 | 端点補正（初案） | 76.88% | 0.00px | 未注釈 | 未注釈 |
| 黒背景の図面 | 線幅＋端点 | 76.96% | 0.00px | 未注釈 | 未注釈 |
| 黒背景の図面 | 床輪郭の推定 | 76.32% | 0.00px | 未注釈 | 未注釈 |
| 黒背景の図面 | 色の除外を一律解除 | 76.32% | 0.00px | 未注釈 | 未注釈 |
| 黒背景の図面 | 端点補正（厳格） | 76.53% | 0.00px | 未注釈 | 未注釈 |
| 木目・家具入り図面 | 改善前の認識 | 91.23% | 0.00px | 0 | 0 / 2 |
| 木目・家具入り図面 | 輪郭から線幅補正 | 91.26% | 0.00px | 0 | 0 / 2 |
| 木目・家具入り図面 | 端点補正（初案） | 91.84% | 0.00px | 0 | 0 / 2 |
| 木目・家具入り図面 | 線幅＋端点 | 91.77% | 0.00px | 0 | 0 / 2 |
| 木目・家具入り図面 | 床輪郭の推定 | 91.23% | 0.00px | 0 | 1 / 0 |
| 木目・家具入り図面 | 色の除外を一律解除 | 89.31% | 0.00px | 0 | 0 / 2 |
| 木目・家具入り図面 | 端点補正（厳格） | 91.68% | 0.00px | 0 | 0 / 2 |
| 追加：色付き壁の住宅図面 | 改善前の認識 | 0.00% | 0.00px | 0 | 0 / 3 |
| 追加：色付き壁の住宅図面 | 輪郭から線幅補正 | 0.00% | 0.00px | 0 | 0 / 3 |
| 追加：色付き壁の住宅図面 | 端点補正（初案） | 0.00% | 0.00px | 0 | 0 / 3 |
| 追加：色付き壁の住宅図面 | 線幅＋端点 | 0.00% | 0.00px | 0 | 0 / 3 |
| 追加：色付き壁の住宅図面 | 床輪郭の推定 | 0.00% | 0.00px | 0 | 0 / 3 |
| 追加：色付き壁の住宅図面 | 色の除外を一律解除 | 88.95% | 0.00px | 0 | 0 / 0 |
| 追加：色付き壁の住宅図面 | 端点補正（厳格） | 0.00% | 0.00px | 0 | 0 / 3 |
| 白黒図面 | 採用：空結果時だけ有彩色で再解析 | 99.73% | 0.00px | 未注釈 | 未注釈 |
| 着色図面・image1 | 採用：空結果時だけ有彩色で再解析 | 95.82% | 0.00px | 0 | 0 / 2 |
| 黒背景の図面 | 採用：空結果時だけ有彩色で再解析 | 76.32% | 0.00px | 未注釈 | 未注釈 |
| 木目・家具入り図面 | 採用：空結果時だけ有彩色で再解析 | 91.23% | 0.00px | 0 | 0 / 2 |
| 追加：色付き壁の住宅図面 | 採用：空結果時だけ有彩色で再解析 | 88.95% | 0.00px | 0 | 0 / 0 |
| 追加：歴史的な集合住宅図面 | 改善前の認識 | 54.32% | 0.00px | 0 | 0 / 3 |
| 追加：歴史的な集合住宅図面 | 輪郭から線幅補正 | 54.29% | 0.00px | 0 | 0 / 3 |
| 追加：歴史的な集合住宅図面 | 端点補正（初案） | 54.76% | 0.00px | 0 | 0 / 3 |
| 追加：歴史的な集合住宅図面 | 線幅＋端点 | 54.73% | 0.00px | 0 | 0 / 3 |
| 追加：歴史的な集合住宅図面 | 床輪郭の推定 | 54.32% | 0.00px | 0 | 0 / 3 |
| 追加：歴史的な集合住宅図面 | 色の除外を一律解除 | 54.32% | 0.00px | 0 | 0 / 3 |
| 追加：歴史的な集合住宅図面 | 端点補正（厳格） | 54.45% | 0.00px | 0 | 0 / 3 |
| 追加：歴史的な集合住宅図面 | 採用：空結果時だけ有彩色で再解析 | 54.32% | 0.00px | 0 | 0 / 3 |

[監査後の評価JSONと床の回帰点](floor-plan-improvement-assets/metrics-audited.json) / [5画像の実寸モデル一致と色付き図面の照合](floor-plan-improvement-assets/adoption-checks.json)。

## 全6画像の認識・3D結果

青が壁候補、緑が床、3Dは検出結果を手で直さず立体化したもの。壁0本の場合は仮床だけが表示され、認識に成功したモデルとは扱わない。各画像には全8方式を掲載する。

### 白黒図面

通常解析で壁が取れるため、採用案は改善前と実寸モデルが完全一致する。線幅・端点補正の指標上の効果はなく、床推定も採用条件を満たさず仮床を維持した。

![白黒図面の入力](../e2e/fixtures/floor-plans/monochrome.jpg)

| 方式 | 認識結果 | 3Dモデル |
| --- | --- | --- |
| 改善前の認識 | ![白黒図面・改善前の認識・認識](floor-plan-improvement-assets/baseline-monochrome-recognition.png) | ![白黒図面・改善前の認識・3D](floor-plan-improvement-assets/baseline-monochrome-3d.png) |
| 輪郭から線幅補正 | ![白黒図面・輪郭から線幅補正・認識](floor-plan-improvement-assets/width-monochrome-recognition.png) | ![白黒図面・輪郭から線幅補正・3D](floor-plan-improvement-assets/width-monochrome-3d.png) |
| 端点補正（初案） | ![白黒図面・端点補正（初案）・認識](floor-plan-improvement-assets/ends-monochrome-recognition.png) | ![白黒図面・端点補正（初案）・3D](floor-plan-improvement-assets/ends-monochrome-3d.png) |
| 線幅＋端点 | ![白黒図面・線幅＋端点・認識](floor-plan-improvement-assets/width-ends-monochrome-recognition.png) | ![白黒図面・線幅＋端点・3D](floor-plan-improvement-assets/width-ends-monochrome-3d.png) |
| 床輪郭の推定 | ![白黒図面・床輪郭の推定・認識](floor-plan-improvement-assets/floor-monochrome-recognition.png) | ![白黒図面・床輪郭の推定・3D](floor-plan-improvement-assets/floor-monochrome-3d.png) |
| 色の除外を一律解除 | ![白黒図面・色の除外を一律解除・認識](floor-plan-improvement-assets/color-monochrome-recognition.png) | ![白黒図面・色の除外を一律解除・3D](floor-plan-improvement-assets/color-monochrome-3d.png) |
| 端点補正（厳格） | ![白黒図面・端点補正（厳格）・認識](floor-plan-improvement-assets/guarded-ends-monochrome-recognition.png) | ![白黒図面・端点補正（厳格）・3D](floor-plan-improvement-assets/guarded-ends-monochrome-3d.png) |
| 採用：空結果時だけ有彩色で再解析 | ![白黒図面・採用：空結果時だけ有彩色で再解析・認識](floor-plan-improvement-assets/color-fallback-monochrome-recognition.png) | ![白黒図面・採用：空結果時だけ有彩色で再解析・3D](floor-plan-improvement-assets/color-fallback-monochrome-3d.png) |

[改善前モデル](floor-plan-improvement-assets/models/baseline-monochrome.json) / [採用案モデル](floor-plan-improvement-assets/models/color-fallback-monochrome.json)

### 着色図面・image1

通常解析で既に壁を検出できるので採用案は改善前と完全一致。端点補正の初案と線幅との併用は、部分壁の指標が上がっても選択した入口を1点塞ぐ。床推定は室内側の必要な床を2点切り落とし、上部にも不自然な床の突出があるため不採用。

![着色図面・image1の入力](../e2e/fixtures/floor-plans/colored.jpg)

| 方式 | 認識結果 | 3Dモデル |
| --- | --- | --- |
| 改善前の認識 | ![着色図面・image1・改善前の認識・認識](floor-plan-improvement-assets/baseline-colored-recognition.png) | ![着色図面・image1・改善前の認識・3D](floor-plan-improvement-assets/baseline-colored-3d.png) |
| 輪郭から線幅補正 | ![着色図面・image1・輪郭から線幅補正・認識](floor-plan-improvement-assets/width-colored-recognition.png) | ![着色図面・image1・輪郭から線幅補正・3D](floor-plan-improvement-assets/width-colored-3d.png) |
| 端点補正（初案） | ![着色図面・image1・端点補正（初案）・認識](floor-plan-improvement-assets/ends-colored-recognition.png) | ![着色図面・image1・端点補正（初案）・3D](floor-plan-improvement-assets/ends-colored-3d.png) |
| 線幅＋端点 | ![着色図面・image1・線幅＋端点・認識](floor-plan-improvement-assets/width-ends-colored-recognition.png) | ![着色図面・image1・線幅＋端点・3D](floor-plan-improvement-assets/width-ends-colored-3d.png) |
| 床輪郭の推定 | ![着色図面・image1・床輪郭の推定・認識](floor-plan-improvement-assets/floor-colored-recognition.png) | ![着色図面・image1・床輪郭の推定・3D](floor-plan-improvement-assets/floor-colored-3d.png) |
| 色の除外を一律解除 | ![着色図面・image1・色の除外を一律解除・認識](floor-plan-improvement-assets/color-colored-recognition.png) | ![着色図面・image1・色の除外を一律解除・3D](floor-plan-improvement-assets/color-colored-3d.png) |
| 端点補正（厳格） | ![着色図面・image1・端点補正（厳格）・認識](floor-plan-improvement-assets/guarded-ends-colored-recognition.png) | ![着色図面・image1・端点補正（厳格）・3D](floor-plan-improvement-assets/guarded-ends-colored-3d.png) |
| 採用：空結果時だけ有彩色で再解析 | ![着色図面・image1・採用：空結果時だけ有彩色で再解析・認識](floor-plan-improvement-assets/color-fallback-colored-recognition.png) | ![着色図面・image1・採用：空結果時だけ有彩色で再解析・3D](floor-plan-improvement-assets/color-fallback-colored-3d.png) |

[改善前モデル](floor-plan-improvement-assets/models/baseline-colored.json) / [採用案モデル](floor-plan-improvement-assets/models/color-fallback-colored.json)

### 黒背景の図面

採用案は改善前と完全一致。線幅補正では選択した壁の欠落は減らない。端点補正は小さく指標を上げるが、壁の欠落の主因を解決しない。床推定は安全側に棄却され、長方形の仮床のまま。

![黒背景の図面の入力](../e2e/fixtures/floor-plans/dark-background.jpg)

| 方式 | 認識結果 | 3Dモデル |
| --- | --- | --- |
| 改善前の認識 | ![黒背景の図面・改善前の認識・認識](floor-plan-improvement-assets/baseline-dark-background-recognition.png) | ![黒背景の図面・改善前の認識・3D](floor-plan-improvement-assets/baseline-dark-background-3d.png) |
| 輪郭から線幅補正 | ![黒背景の図面・輪郭から線幅補正・認識](floor-plan-improvement-assets/width-dark-background-recognition.png) | ![黒背景の図面・輪郭から線幅補正・3D](floor-plan-improvement-assets/width-dark-background-3d.png) |
| 端点補正（初案） | ![黒背景の図面・端点補正（初案）・認識](floor-plan-improvement-assets/ends-dark-background-recognition.png) | ![黒背景の図面・端点補正（初案）・3D](floor-plan-improvement-assets/ends-dark-background-3d.png) |
| 線幅＋端点 | ![黒背景の図面・線幅＋端点・認識](floor-plan-improvement-assets/width-ends-dark-background-recognition.png) | ![黒背景の図面・線幅＋端点・3D](floor-plan-improvement-assets/width-ends-dark-background-3d.png) |
| 床輪郭の推定 | ![黒背景の図面・床輪郭の推定・認識](floor-plan-improvement-assets/floor-dark-background-recognition.png) | ![黒背景の図面・床輪郭の推定・3D](floor-plan-improvement-assets/floor-dark-background-3d.png) |
| 色の除外を一律解除 | ![黒背景の図面・色の除外を一律解除・認識](floor-plan-improvement-assets/color-dark-background-recognition.png) | ![黒背景の図面・色の除外を一律解除・3D](floor-plan-improvement-assets/color-dark-background-3d.png) |
| 端点補正（厳格） | ![黒背景の図面・端点補正（厳格）・認識](floor-plan-improvement-assets/guarded-ends-dark-background-recognition.png) | ![黒背景の図面・端点補正（厳格）・3D](floor-plan-improvement-assets/guarded-ends-dark-background-3d.png) |
| 採用：空結果時だけ有彩色で再解析 | ![黒背景の図面・採用：空結果時だけ有彩色で再解析・認識](floor-plan-improvement-assets/color-fallback-dark-background-recognition.png) | ![黒背景の図面・採用：空結果時だけ有彩色で再解析・3D](floor-plan-improvement-assets/color-fallback-dark-background-3d.png) |

[改善前モデル](floor-plan-improvement-assets/models/baseline-dark-background.json) / [採用案モデル](floor-plan-improvement-assets/models/color-fallback-dark-background.json)

### 木目・家具入り図面

色の除外を一律解除すると部分壁の網羅率が91.23%から89.31%へ下がる。採用案は再解析しないので改善前を保持。床推定は外側の不要な床を減らすが、室内として必要な床を1点切り落とすため採用しない。

![木目・家具入り図面の入力](../e2e/fixtures/floor-plans/textured.jpg)

| 方式 | 認識結果 | 3Dモデル |
| --- | --- | --- |
| 改善前の認識 | ![木目・家具入り図面・改善前の認識・認識](floor-plan-improvement-assets/baseline-textured-recognition.png) | ![木目・家具入り図面・改善前の認識・3D](floor-plan-improvement-assets/baseline-textured-3d.png) |
| 輪郭から線幅補正 | ![木目・家具入り図面・輪郭から線幅補正・認識](floor-plan-improvement-assets/width-textured-recognition.png) | ![木目・家具入り図面・輪郭から線幅補正・3D](floor-plan-improvement-assets/width-textured-3d.png) |
| 端点補正（初案） | ![木目・家具入り図面・端点補正（初案）・認識](floor-plan-improvement-assets/ends-textured-recognition.png) | ![木目・家具入り図面・端点補正（初案）・3D](floor-plan-improvement-assets/ends-textured-3d.png) |
| 線幅＋端点 | ![木目・家具入り図面・線幅＋端点・認識](floor-plan-improvement-assets/width-ends-textured-recognition.png) | ![木目・家具入り図面・線幅＋端点・3D](floor-plan-improvement-assets/width-ends-textured-3d.png) |
| 床輪郭の推定 | ![木目・家具入り図面・床輪郭の推定・認識](floor-plan-improvement-assets/floor-textured-recognition.png) | ![木目・家具入り図面・床輪郭の推定・3D](floor-plan-improvement-assets/floor-textured-3d.png) |
| 色の除外を一律解除 | ![木目・家具入り図面・色の除外を一律解除・認識](floor-plan-improvement-assets/color-textured-recognition.png) | ![木目・家具入り図面・色の除外を一律解除・3D](floor-plan-improvement-assets/color-textured-3d.png) |
| 端点補正（厳格） | ![木目・家具入り図面・端点補正（厳格）・認識](floor-plan-improvement-assets/guarded-ends-textured-recognition.png) | ![木目・家具入り図面・端点補正（厳格）・3D](floor-plan-improvement-assets/guarded-ends-textured-3d.png) |
| 採用：空結果時だけ有彩色で再解析 | ![木目・家具入り図面・採用：空結果時だけ有彩色で再解析・認識](floor-plan-improvement-assets/color-fallback-textured-recognition.png) | ![木目・家具入り図面・採用：空結果時だけ有彩色で再解析・3D](floor-plan-improvement-assets/color-fallback-textured-3d.png) |

[改善前モデル](floor-plan-improvement-assets/models/baseline-textured.json) / [採用案モデル](floor-plan-improvement-assets/models/color-fallback-textured.json)

### 追加：色付き壁の住宅図面

緑色の壁と透明背景を持つ図面。改善前・幾何補正・床推定では壁0本で、3Dは仮床だけになる。色を残す解析では30本の壁が得られ、監査後の部分壁の網羅率は88.95%。条件付き再解析はこの結果と完全一致。すべての壁を拾えたわけではなく、薄い内壁などは欠ける。

![追加：色付き壁の住宅図面の入力](../e2e/fixtures/floor-plans/holdout/cottage.png)

| 方式 | 認識結果 | 3Dモデル |
| --- | --- | --- |
| 改善前の認識 | ![追加：色付き壁の住宅図面・改善前の認識・認識](floor-plan-improvement-assets/baseline-cottage-recognition.png) | ![追加：色付き壁の住宅図面・改善前の認識・3D](floor-plan-improvement-assets/baseline-cottage-3d.png) |
| 輪郭から線幅補正 | ![追加：色付き壁の住宅図面・輪郭から線幅補正・認識](floor-plan-improvement-assets/width-cottage-recognition.png) | ![追加：色付き壁の住宅図面・輪郭から線幅補正・3D](floor-plan-improvement-assets/width-cottage-3d.png) |
| 端点補正（初案） | ![追加：色付き壁の住宅図面・端点補正（初案）・認識](floor-plan-improvement-assets/ends-cottage-recognition.png) | ![追加：色付き壁の住宅図面・端点補正（初案）・3D](floor-plan-improvement-assets/ends-cottage-3d.png) |
| 線幅＋端点 | ![追加：色付き壁の住宅図面・線幅＋端点・認識](floor-plan-improvement-assets/width-ends-cottage-recognition.png) | ![追加：色付き壁の住宅図面・線幅＋端点・3D](floor-plan-improvement-assets/width-ends-cottage-3d.png) |
| 床輪郭の推定 | ![追加：色付き壁の住宅図面・床輪郭の推定・認識](floor-plan-improvement-assets/floor-cottage-recognition.png) | ![追加：色付き壁の住宅図面・床輪郭の推定・3D](floor-plan-improvement-assets/floor-cottage-3d.png) |
| 色の除外を一律解除 | ![追加：色付き壁の住宅図面・色の除外を一律解除・認識](floor-plan-improvement-assets/color-cottage-recognition.png) | ![追加：色付き壁の住宅図面・色の除外を一律解除・3D](floor-plan-improvement-assets/color-cottage-3d.png) |
| 端点補正（厳格） | ![追加：色付き壁の住宅図面・端点補正（厳格）・認識](floor-plan-improvement-assets/guarded-ends-cottage-recognition.png) | ![追加：色付き壁の住宅図面・端点補正（厳格）・3D](floor-plan-improvement-assets/guarded-ends-cottage-3d.png) |
| 採用：空結果時だけ有彩色で再解析 | ![追加：色付き壁の住宅図面・採用：空結果時だけ有彩色で再解析・認識](floor-plan-improvement-assets/color-fallback-cottage-recognition.png) | ![追加：色付き壁の住宅図面・採用：空結果時だけ有彩色で再解析・3D](floor-plan-improvement-assets/color-fallback-cottage-3d.png) |

[改善前モデル](floor-plan-improvement-assets/models/baseline-cottage.json) / [採用案モデル](floor-plan-improvement-assets/models/color-fallback-cottage.json)

### 追加：歴史的な集合住宅図面

原図2625×1608を製品と同じ1024×627へ縮小。旧版では約1.6cmになる2px断片が2本あり、モデル全体の変換が失敗した。短すぎる断片を個別除外する修正後は109壁を生成できた。比較中の全方式へ同じ変換修正を適用しており、採用案と改善前の認識は完全一致。曲線・細い壁には大きな欠落が残る。

![追加：歴史的な集合住宅図面の入力](../e2e/fixtures/floor-plans/holdout/riverside.png)

| 方式 | 認識結果 | 3Dモデル |
| --- | --- | --- |
| 改善前の認識 | ![追加：歴史的な集合住宅図面・改善前の認識・認識](floor-plan-improvement-assets/baseline-riverside-recognition.png) | ![追加：歴史的な集合住宅図面・改善前の認識・3D](floor-plan-improvement-assets/baseline-riverside-3d.png) |
| 輪郭から線幅補正 | ![追加：歴史的な集合住宅図面・輪郭から線幅補正・認識](floor-plan-improvement-assets/width-riverside-recognition.png) | ![追加：歴史的な集合住宅図面・輪郭から線幅補正・3D](floor-plan-improvement-assets/width-riverside-3d.png) |
| 端点補正（初案） | ![追加：歴史的な集合住宅図面・端点補正（初案）・認識](floor-plan-improvement-assets/ends-riverside-recognition.png) | ![追加：歴史的な集合住宅図面・端点補正（初案）・3D](floor-plan-improvement-assets/ends-riverside-3d.png) |
| 線幅＋端点 | ![追加：歴史的な集合住宅図面・線幅＋端点・認識](floor-plan-improvement-assets/width-ends-riverside-recognition.png) | ![追加：歴史的な集合住宅図面・線幅＋端点・3D](floor-plan-improvement-assets/width-ends-riverside-3d.png) |
| 床輪郭の推定 | ![追加：歴史的な集合住宅図面・床輪郭の推定・認識](floor-plan-improvement-assets/floor-riverside-recognition.png) | ![追加：歴史的な集合住宅図面・床輪郭の推定・3D](floor-plan-improvement-assets/floor-riverside-3d.png) |
| 色の除外を一律解除 | ![追加：歴史的な集合住宅図面・色の除外を一律解除・認識](floor-plan-improvement-assets/color-riverside-recognition.png) | ![追加：歴史的な集合住宅図面・色の除外を一律解除・3D](floor-plan-improvement-assets/color-riverside-3d.png) |
| 端点補正（厳格） | ![追加：歴史的な集合住宅図面・端点補正（厳格）・認識](floor-plan-improvement-assets/guarded-ends-riverside-recognition.png) | ![追加：歴史的な集合住宅図面・端点補正（厳格）・3D](floor-plan-improvement-assets/guarded-ends-riverside-3d.png) |
| 採用：空結果時だけ有彩色で再解析 | ![追加：歴史的な集合住宅図面・採用：空結果時だけ有彩色で再解析・認識](floor-plan-improvement-assets/color-fallback-riverside-recognition.png) | ![追加：歴史的な集合住宅図面・採用：空結果時だけ有彩色で再解析・3D](floor-plan-improvement-assets/color-fallback-riverside-3d.png) |

[改善前モデル](floor-plan-improvement-assets/models/baseline-riverside.json) / [採用案モデル](floor-plan-improvement-assets/models/color-fallback-riverside.json)

## 採用後の製品画面

比較用表示器とは別に、通常E2Eで実際のReact Three Fiber画面を確認した。2画像とも取り込み後の保存データを使って実WebGLに描画している。欠けた壁や曲線はそのままで、手で補正していない。

| 色付き壁の追加図面 | 大きい歴史的図面 |
| --- | --- |
| ![製品画面・色付き壁](floor-plan-improvement-assets/cottage-product-3d.png) | ![製品画面・歴史的図面](floor-plan-improvement-assets/riverside-product-3d.png) |

## 再実行

製品と別の実験スクリプトは `frontend/scripts/floor-plan-improvements/`。追加のPythonライブラリや外部モデルは不要で、既存npm依存・Playwright Chromium・Git履歴が必要。リポジトリルートから実行する。

```bash
# 初回のみ。通常のE2Eと同じブラウザを使う
npm ci --prefix frontend
npm run test:e2e:install --prefix frontend

# 全6画像×全8方式を実際のWorker・WebGLで実行
node frontend/scripts/floor-plan-improvements/capture.mjs

# 元の初回評価を残したまま、監査済み注釈で再集計
node frontend/scripts/floor-plan-improvements/evaluate.mjs

# 実験コードの境界・入力不変性・開口保持の検証（通常CIとは別）
node --test frontend/scripts/floor-plan-improvements/refinements.test.js

# 製品の通常検証
npm run test:unit --prefix frontend
npm run build --prefix frontend
npm run test:e2e --prefix frontend
npm run test:floor-plan --prefix frontend
```

`capture.mjs`は通常E2Eと同じロックを取得し、同時実行を防ぐ。48回のWASM/WebGL初期化のメモリが蓄積しないよう、ケースごとにブラウザプロセスを終了する。比較中の長時間実行では途中でブラウザが終了したため、後からプロセスを分離して全ケースを完走した。失敗を隠すリトライやスキップは追加していない。縮小が必要な図面では重ね合わせ画像も解析寸法に合わせて描画するよう比較表示器を修正し、歴史的図面の全8方式の画像を再生成した。

出力は `frontend/docs/floor-plan-improvement-assets/`。全48ケースの生出力と実寸モデル、画像を残す。`--images=riverside` で画像を絞れる。`--modes=color-fallback` は既存の記録から同じケースを置き換えて追記するので、先に全件結果が必要。画像やJSONは上書きされる。Markdownの考察は手動記録で、再実行後は数値と目視所見を更新する。

基準Workerは `b11497e` のGit履歴に固定する。採用案は実行時の製品Workerなので、将来それを変えた場合は採用案の結果が変わる。部分注釈・参照入力・比較条件を変えた場合も、以前の値とそのまま改善率を比較しない。

## 今回のコミット整理

| コミット | 内容 |
| --- | --- |
| `3c9e2dd` | 既存作業を画像取り込み・実寸モデル・編集・保存の機能として整理 |
| `f550239` | 既存作業の全4画像・UI・実WebGL・CI回帰検証 |
| `1dcbf8f` | 既存作業の外部実装比較・画像レポート・運用資料 |
| `b11497e` | 追加の出典付き2画像と、最初の実行前に選んだ注釈 |
| `ac1421e` | 実寸2cm未満の断片による生成失敗の修正と回帰検証 |
| `2695598` | 空結果時だけの有彩色再解析と回帰検証 |

採用修正と実験記録も、実寸変換の修正・条件付き再解析・比較資料に分けてコミットする。push・PR作成は今回の依頼には含めていない。

## 残る改善と次の判断

- 細い壁・曲線・部屋全体の閉領域を大きく改善するには、後段の微調整だけでなく候補抽出自体の改善が必要。
- 床輪郭の自動推定は、外側を削れるだけでなく玄関土間など必要な床を保てることを先に検証する。今回の仮閉鎖案は製品へ入れない。
- 色付き壁と黒い壁が混在する画像は、空結果時のみの救済では扱い切れない。色の種類を推定して構造的な線だけを残す方式は未検証。
- 独立した日本語図面や全面注釈は不足しており、今回の部分評価を一般的な認識精度とは扱わない。

## 検証結果

実験48ケース・96画像の生成、5画像の実寸モデル一致、同じ入力による旧版変換エラーと修正版の成功を確認した。実験専用の4テスト、通常の製品ユニット141件、本番ビルド、通常E2E56件（UI44件・実WebGL12件）が成功した。製品画面の追加2枚も上に掲載した。通常E2Eの計測はビルド11.3秒・テスト388.9秒・合計400.1秒で、単回の結果。GitHub Actions上では未確認。

E2Eの初回実行は54件成功後に終了コード143で途中終了した。原因は未特定で、成功扱いにはせず、残った今回のテストサーバーだけを停止して同じ通常コマンドをPTY経由で最初から再実行した。上記56件成功は再実行の結果であり、スキップ・リトライ回数・タイムアウトは変えていない。

通常の`npm run test:floor-plan --prefix frontend`も成功し、既存4画像の部分評価は維持された。E2E中に比較ツールを起動するとロックで拒否されることも確認した。全48モデルの検証、96枚の比較画像＋2枚の製品画像、出典ファイルのSHA-256と全ローカルリンクも確認済み。
