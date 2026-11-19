# 家具の取り込み調査（Issue #45）

調査日: 2026-11-19。対象は[#45「家具を取り込めるようにする」](https://github.com/otsubo234039/Syncterior/issues/45)。Issue本文には詳細条件がないため、商品写真・手持ち家具の写真から配置用の家具を作る方法を比較した。

公式ドキュメント、公開README、下記に明記したソースを確認した調査であり、生成APIの呼び出し、GPU推論、生成品質・速度・費用の実測、Syncteriorへの組み込みは未実施。推奨構成・上限値・実装順序は提案であり、採用済みの仕様ではない。

## 推奨する進め方

**GLBファイルの取り込みと実寸・向きの調整を共通の入口にして、写真からの生成を後から接続する。** 最初はMeshyやTripoなどの外部ツールで写真からGLBを作り、手動で取り込めるだけでも目的を試せる。その後、同じ処理をアプリ内の生成API連携へ置き換える。

写真1枚から見えない背面や底面まで実測通りに復元できるとは扱わない。配置の判断には利用者が入力した幅・奥行き・高さを使い、生成した見た目と寸法の整合を確認する。商品ページの寸法や実測値がない場合は概算と表示する。

| 方法 | 入力・得られるもの | 向いている用途 | 制約と判断 |
| --- | --- | --- | --- |
| 既存3Dモデルの取り込み | GLB → テクスチャ付き家具 | メーカー等からモデルを入手できる家具、生成サービスの出力 | 初期実装の推奨。モデルの利用・再配布条件は出典ごとに扱う |
| 画像から既存形状を調整 | 写真＋家具の種類＋実寸 → 簡易形状 | まず部屋に収まるか確認する | 最も小さく始められる案。写真と同じ形状にはならない。写真は参照用サムネイルとしても使える |
| 画像からAIで3D生成 | 単体写真1枚、可能なら別角度も → メッシュ・材質 | 商品写真から見た目も近い家具を作る | アプリ内統合には外部APIまたはGPU推論基盤が必要。初期比較候補はMeshyとTripo |
| 多視点写真による復元 | 家具を周囲から撮った多数の写真 → メッシュ・テクスチャ | 所有している家具を撮影できる場合 | 撮影負担と処理負荷が大きい。商品写真1枚の取り込みとは別の入口にする |

最後の方法の参考は[Meshroomの撮影ガイド](https://meshroom-manual.readthedocs.io/en/latest/capturing/capturing.html)。多方向から重なりを持って撮影する必要があり、反射・透明物は避けるよう案内されている。実寸合わせも別に必要になるため、初期対応の優先度は低い。

## 画像から3Dを生成する候補

### 外部API

| 候補 | 公式に確認した機能 | Syncteriorへの適合・注意 |
| --- | --- | --- |
| [Meshy Image to 3D](https://docs.meshy.ai/en/api/image-to-3d) | 単一画像、GLB出力、PBR、面数の指定、非同期タスク | 最初の比較候補。生成結果を共通のGLB取り込みへ渡せる |
| [Meshy Multi-Image](https://docs.meshy.ai/en/api/multi-image-to-3d) | 同じ物体の1〜4枚の写真から生成 | 正面・側面・背面の写真がある商品の比較に使える。複数写真でも寸法の保証にはしない |
| [Tripo Image to Model](https://developers.tripo3d.ai/en/docs/generation-image-to-model/standard) | 単一画像、テクスチャ・PBR、面数制御、GLBの出力例 | Meshyと同じ写真で比較する候補。`quad`指定時はFBXになるため、GLB経路では指定しない |
| [Tripo Multiview](https://developers.tripo3d.ai/en/docs/generation-multiview-to-model/standard) | 正面を含む2枚以上、複数方向の画像を入力 | 別角度の写真がある場合の候補。利用するモデルと入力形式を固定する |

[Meshyの料金表](https://docs.meshy.ai/en/api/pricing)では、調査時点の`meshy-7.1`による通常のImage / Multi-Image生成は形状のみ20 credits、2Kテクスチャ付き30 credits。追加処理・再生成・設定で費用が変わる。creditsから通貨への換算や月額契約込みの比較は未実施。

[Tripoの課金仕様](https://developers.tripo3d.ai/en/docs/billing)もcredits制で、生成中は必要額を確保し、成功時に消費、失敗・取消時には返却する仕様。両社のcreditを同じ単価とは扱わず、採用時に同じ生成条件と再生成回数で比較する。

API統合で注意する点:

- APIキーはフロントエンドへ置かず、バックエンドから呼び出す。画像を外部へ送信することを取り込み画面で明示する。
- 作成→待機・進捗→成功・失敗の非同期処理にする。[Tripoのタスク仕様](https://developers.tripo3d.ai/en/docs/introduction)のように、画面の通信終了と生成タスクの終了を分けて扱う。ブラウザ側の中止だけで課金が止まるとは扱わない。
- 完了したGLBを取得して自分の保存領域へ移す。[Meshyの保持仕様](https://docs.meshy.ai/en/api/asset-retention)では通常のAPI生成モデルは最大3日で削除され、署名URLにも期限がある。生成サービスのURLを家具の永続的な識別子にしない。
- 調査時点のMeshyは`meshy-7`の3D生成を2026-12-31に終了予定と案内している。古いサンプルを転用せず、採用するモデル・APIバージョンを固定する。

### 自分のGPUで動かす公開モデル

以下のVRAMは公式資料の記載値であり、この環境での実測値ではない。いずれも通常のReactアプリへnpmライブラリとして追加してブラウザだけで動く構成ではない。

| 候補 | 参考になる点 | 公式の実行条件・利用条件 |
| --- | --- | --- |
| [TRELLIS.2](https://github.com/microsoft/TRELLIS.2) | 画像からPBR付き3Dを生成。[公式例](https://github.com/microsoft/TRELLIS.2/blob/main/example.py)にGLB出力処理がある | Linux、NVIDIA GPUのVRAM 24GB以上。モデル・コードはMIT、依存物は別条件。自前GPU案の比較候補 |
| [Hunyuan3D-2.1](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1) | 形状生成とPBRテクスチャ生成を分けている | 形状10GB、テクスチャ21GB、両方の合計29GBという公式記載。[独自ライセンス](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1/blob/main/LICENSE)で地域等の条件があるため、MITと同一には扱わない |
| [TripoSR](https://github.com/VAST-AI-Research/TripoSR) | 単一画像からの復元。軽めの比較用ベースライン | デフォルト推論は約6GB VRAM。コード・学習済みモデルはMITという公式記載。最新モデルと同等の家具品質とは未検証 |
| [SAM 3D Objects](https://github.com/facebookresearch/sam-3d-objects) | 写真内のマスク指定した物体の形状・テクスチャ・配置を復元。背景や他の家具が混ざる写真の候補 | [公式セットアップ](https://github.com/facebookresearch/sam-3d-objects/blob/main/doc/setup.md)はLinux、NVIDIA GPU 32GB以上、重みの利用申請。[SAM License](https://github.com/facebookresearch/sam-3d-objects/blob/main/LICENSE) |

TRELLIS.2のREADMEの生成時間はH100での測定であり、一般的なGPUやCodespacesでの処理時間には置き換えられない。GPUのある実行先・待ち行列・モデル管理が必要なので、初期の家具取り込みだけを目的に推論基盤まで導入する優先度は低い。

## 参考にするアプリ実装

[Room Setup](https://github.com/maromocooo/room-setup)が今回の目的に特に近い。写真＋幅・奥行き・高さ→生成→部屋への配置、平面図と3D、GLBの直接取り込み、向きの修正を扱う。アプリはMIT。生成モデル自体の条件は別に確認する。Three.jsを直接使う実装で、React Three Fiberのコンポーネントとしてそのまま利用できるものではない。

確認した箇所と参考にする設計:

- [README](https://github.com/maromocooo/room-setup/blob/main/README.md): 寸法入力と画像生成を組み合わせる操作、GLBの直接取り込み、生成エンジンの切り替え。
- [src/scene/furniture.js](https://github.com/maromocooo/room-setup/blob/main/src/scene/furniture.js): GitHub API経由でソースを確認。`GLTFLoader`で読み、配置用group・サイズ補正用group・向き補正用groupを分ける。`Box3`で形状を計測し、底面をY=0、XZを中心へ合わせる。入力寸法はcmなので、メートル単位のSyncteriorでは単位変換を見直す。
- [src/project/project-io.js](https://github.com/maromocooo/room-setup/blob/main/src/project/project-io.js): ソースを確認。家具ごとのGLBを`models/`へ入れ、配置JSONと一緒にZIP保存する。配置データだけではモデルを復元できない点の参考になる。

材料の両面表示やリソース破棄などは、Syncteriorの共有キャッシュ・複数インスタンスの寿命に合わせて設計する。ソースの一括移植や動作確認は行っていない。

別案の[glbsmith](https://github.com/maromocooo/glbsmith)は、商品写真と寸法をもとにAIエージェントがBlenderで部品ごとにモデル化し、レンダーを比較して修正する方式。寸法を持つ机・棚などを事前にモデル化する参考になる。ローカルツールでもエージェントは外部サービスを利用し、無人のWeb APIとしてすぐ組み込める構成とは扱わない。READMEまでの確認で、生成品質は未検証。

## 組み込みに使うライブラリ

| 役割 | 候補 | 判断 |
| --- | --- | --- |
| GLB読み込み | [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)、[Drei useGLTF](https://drei.docs.pmnd.rs/loaders/gltf-use-gltf) | Three.js・Dreiは既存依存。ローカルファイルの事前検証にはGLTFLoader、描画側にはuseGLTF等を検討 |
| 同じ家具を複数配置 | [Drei Clone](https://drei.docs.pmnd.rs/abstractions/clone) | sceneを別groupで配置する。色を変える場合はmaterialの共有による他家具への波及を防ぐ |
| 形式検証 | [Khronos glTF-Validator](https://github.com/KhronosGroup/glTF-Validator) | GLBの構造・参照・不正数値などを検証。モデルの正確さや安全なメモリ量を保証するものではない |
| 軽量化 | [glTF Transform](https://gltf-transform.dev/) | メッシュ簡略化・不要データ削除・テクスチャ圧縮。まず開発用またはサーバー処理として試し、初期画面へ大きな処理系を追加しない |
| ブラウザ内モデル保存 | IndexedDB、補助として[idb](https://github.com/jakearchibald/idb) | Blobとメタデータの保存候補。保存容量・拒否・モデル欠落時の復元を設計する |
| 背景除去（Python側） | [rembg](https://github.com/danielgatis/rembg) | MITのツール。選択する重みの条件も別途確認。生成前の切り抜き候補 |
| 背景除去（ブラウザ側） | [@imgly/background-removal](https://github.com/imgly/background-removal-js) | ブラウザで処理できるがAGPLのため採用条件を確認。初期導入の必須依存にはしない |

背景除去だけで立体形状が得られるわけではない。切り抜きを板ポリゴンに貼る方式も可能だが、横・背面から見る家具としては成立しにくい。単体画像をクロップするだけで生成できるかを先に比較し、脚や細い背もたれを消す前処理を無条件に追加しない。

useGLTFの公式資料ではDracoのデコーダーを初期設定でCDNから取得する。モデル本体をローカル処理していても、外部取得がないとは限らない。オフライン要件がある場合はデコーダーを同梱するか、初期対応の圧縮形式を制限する。最新ドキュメントの全拡張が、現在のThree.js `^0.172.0`で使えるとは扱わず、実装時は固定されたインストール版で検証する。

## 現在のSyncteriorで変更が必要な箇所

調査時点のコードから確認した内容:

| 箇所 | 現状 | 家具モデル取り込み時に必要な対応案 |
| --- | --- | --- |
| `data/catalog.js` | 8種類の固定家具とメートル単位の寸法 | 利用者の家具の名前・寸法・モデル参照を既存カタログと区別する |
| `components/furniture.jsx` | 家具typeごとにbox等を生成 | モデル描画を追加し、既存の選択・ドラッグ・回転を渡す |
| `utils/room-state.js` | 家具typeを8種類に限定 | imported家具の検証を追加。個人配置への対応と共有snapshotへの対応を分ける |
| `utils/local-room-storage.js` | 保存できるitemのフィールドを限定、JSONは100万文字以下、プリセット第1版・custom第2版 | バイナリを混ぜず、既存データを読み続ける版付き形式とモデル保存先を設計 |
| `utils/furniture-bounds.js` / `floor-plan-furniture.js` | 寸法・回転に基づく床と壁の判定 | 正規化したモデルのXZ外形と判定用`w/d`を一致させる |
| `components/plan-view.jsx` | 同じ家具寸法・回転からSVGの矩形を描画 | 取込モデルも平面図で選択・移動できるようにする |

家具のバイナリをlocalStorageのbase64へ押し込む案は採らず、配置は`assetId`などの安定した参照、モデル本体はIndexedDBへ分ける案を比較する。Blob URLはセッション内の表示用に限り、再読込時は保存したBlobから作り直す。欠落したモデル、保存領域の拒否、容量不足を扱い、配置だけ残って何も表示されない状態を避ける。

GLBの正規化は、向きを確認→配置回転を含めずに外形計測→幅・奥行き・高さを調整→底面をY=0、XZ中心を原点へ、の順に行う。1寸法からの一様拡大と、3寸法へ合わせる軸別拡大を区別する。後者は形を変形させるためプレビューで確認する。空モデル・ゼロ寸法・NaN等は配置前に拒否する。

初期対応は静的で、テクスチャ・バッファが埋め込まれたGLBを対象にする案。GLBにも外部URIを含められるため、拡張子だけで自己完結と判定せずJSON内を調べ、外部参照を読み込み前に拒否する。ファイル容量に加え、展開後の頂点数・画像寸法・材質数にも上限を設ける。例えば1家具1〜3万三角形・テクスチャ最大2Kから比較を始めるが、上限は実測後に決める。スキン、アニメーション、ライト、カメラを家具として受け入れる範囲は別に定義する。

読み込み中の別ファイル指定・取消・画面離脱、Object URLの解放、共有geometry/materialの破棄時期を確認する。`frameloop="demand"`ではモデル表示・向きや材質の変更時にも描画が更新されることを実WebGLで確認する。

## 実装を分ける単位と評価

1. **個人利用のGLB取り込み**: ファイル選択、検証、プレビュー、実寸と正面の調整、配置、既存操作、平面図、保存・再読込までを一単位にする。外部サービスで生成した家具も手動で取り込める。
2. **画像生成の比較実験**: ソファ・細脚の椅子・机・背面のある棚・反射面のある家電など同じ入力でMeshyとTripoを比較。商品単体写真／背景付き写真、1枚／複数枚を分ける。自前GPUの方針なら同じ入力でTRELLIS.2を比較する。
3. **採用した方式だけをアプリへ統合**: 写真と実寸の入力、送信案内、非同期生成、取消・再試行、GLB取得と保存を実装する。比較前に複数プロバイダーの抽象化基盤を作らない。
4. **必要ならサーバー保存・共有**: モデル参照を別端末で解決する仕組み、所有権・参照権限・削除方針を追加する。

比較では正面の見栄えだけでなく、背面・側面、脚や穴の保持、正面の向き、床への接地、実寸へ調整した際の変形、モデル容量・三角形数・テクスチャ、生成待ち時間、再生成を含む費用を記録する。生成成功率と利用者が配置に使える割合を区別する。

実装時の回帰検証は既存家具と取込家具の追加・選択・移動・回転・削除、壁際・凹形の床、同じモデルの複数配置、モデルを壊さない色操作、保存後の再読込、モデル欠落・容量不足・不正GLB・処理中の取消を対象にする。UIはデスクトップ・モバイル幅、描画とドラッグは実WebGLでも確認する。

## バックエンドとの関係・未決定事項

現在のバックエンドは未実装。[引き継ぎ一覧](../../backend/docs/implementation-backlog.md)のBE-02/03/06/07は部屋保存・操作・検証・権限を扱い、BE-09 / #40はGemini連携案である。家具の画像→3D生成APIが既に使える状態ではない。

上記の個人利用GLB取り込みはブラウザ内で完結させられる。一方、アプリ内の外部生成APIや取込モデルの共有を採用する場合は、生成ジョブ、APIキー管理、再試行と二重生成の防止、モデルの保存・配信・権限・削除の追跡が必要になる。これは提案段階で、生成サービスや新しいAPI・保存方針を今回確定していない。方式選定後に既存Issueと重複を照合して実装Issueへ分割し、引き継ぎ一覧と接続仕様を同時に更新する。ローカルのモデル参照を現行の共有snapshotへそのまま流さない。

最初に決める事項は、①簡易形状で十分か見た目の再現が必要か、②外部送信を許容するか、③写真1枚を主対象にするか、④個人利用だけか共有まで含めるか、の4点。今回の推奨は「見た目の再現にも進める共通GLB取り込みを先に作り、外部生成サービスで品質を比較する」。
