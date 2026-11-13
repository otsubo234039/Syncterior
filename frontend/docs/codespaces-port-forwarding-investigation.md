# Codespaces転送URLの404調査

調査日: 2026-11-11。利用者は「昨日は表示できたが、現在はChromeで転送URLが404」と報告。アプリの変更、公開障害・更新情報、類似報告と実際の通信結果を照合した。

## 実際に確認した範囲

- Viteは`0.0.0.0:5173`で起動しており、内部のHTTP応答は200。転送ホストをHostヘッダーへ指定した場合も200。
- Codespacesの転送ポート5173は登録済みで、Private。
- GitHub公式の`X-Github-Token`方式を使い、実際のPrivate転送URLをChromiumで開いた。GitHubの「Codespaces Access Port」確認画面でContinueを押した先にROOMが表示され、平面図への切り替えも成功。認証情報は表示・保存していない。
- 利用者のChromeのCookie・拡張機能・リダイレクト履歴は直接観察できていない。利用者は所有者のアカウントでログイン済みと回答している。
- 以上はサーバーと認証付き経路の正常性を示すが、利用者が受け取った404の発生元までは確定できない。

## アプリと起動設定の変更

HEAD・現在のlock・実際のインストール済み版を照合し、Viteは全て6.4.5、Reactは全て19.3.1、`@vitejs/plugin-react`は全て4.7.0。`package.json`と`package-lock.json`に今回の依存更新はない。昨日との比較として、少なくとも直近コミット以降のこれらの依存更新は確認できない。

接続調査中に`vite.config.js`を追加し、IPv4の待ち受け、5173番固定、Codespacesの転送ホストの許可を設定した。`strictPort: true`により、使用中なら5174番へ自動移動せず起動エラーになる。調査用サーバーをこちらが起動したままにしていたため、利用者の追加起動と競合した。このプロセスは停止済みで、その後は利用者が起動したサーバーを停止していない。

「Port 5173 is already in use」と、ブラウザの404は分けて扱う。前者はポート競合であり、後者の原因を説明したことにはならない。

## 公開障害・更新情報

- [GitHub公式ステータスAPI](https://www.githubstatus.com/api/v2/summary.json): ページの更新時刻2026-11-11 02:25 UTCの応答ではCodespacesはoperational、進行中の障害・予定メンテナンスは空。局所的・未掲載の問題まで否定するものではない。
- [公式障害履歴](https://www.githubstatus.com/api/v2/incidents.json): 11/10にGit操作・Pull Requests・Actions関連の障害が掲載されているが、今回のCodespaces転送404との関連は確認できない。
- [公式Changelog](https://github.blog/changelog/): 確認した11/10〜11/11の公開情報で、Codespacesのポート転送方式や認証方式を変更する告知は見つからなかった。内部サービスやVS Code拡張の個別更新履歴をすべて検証したわけではない。
- [11/10のGitセキュリティ更新告知](https://github.blog/open-source/git/git-security-vulnerabilities-announced-7/): Codespacesも修正版Gitの配布対象と記載。これはGitの脆弱性修正の告知であり、転送URL変更の告知ではない。今回の404に影響した証拠は見つからない。
- [2023年の転送ドメイン変更](https://github.blog/changelog/2023-07-14-codespaces-port-forwarding-domain-name-updates/): `preview.app.github.dev`から`app.github.dev`への変更は過去のもの。現在のURLは後者であり、「昨日からの新しい変更」として扱わない。

## 類似の一次報告

| 日付 | 報告 | 内容・判断 |
| --- | --- | --- |
| 2026-07-10 | [Community #201508](https://github.com/orgs/community/discussions/201508) | タイムアウトから再開後、ブランチ変更なしで転送URLが404。回答にはポート登録の削除・再追加が提案されている。未解決扱いで、GitHubが原因確定した事例ではない |
| 2026-09-26 | [Community #208825](https://github.com/orgs/community/discussions/208825) | 内部200・Host指定200・Private転送404。利用者側の認証済みアクセスまで失敗した報告で、こちらの認証付き経路は成功している点が異なる。未解決の利用者報告 |
| 2024-09-15 | [VS Code #228676](https://github.com/microsoft/vscode/issues/228676) | 再開・再ビルド後の転送不調。報告自体は502で、転送登録を削除・追加すると回復。VS Code担当者が再現を確認し、Codespaces側として扱っている。Docker構成など環境差があり、今回と同一原因とは断定しない |
| 2025-04-13 | [Community #156546](https://github.com/orgs/community/discussions/156546) | 初回起動時の転送登録不調と、公開範囲の切り替えで回復したという報告。今回の対処としてPublicへ変更することは提案しない |

## 次に行う切り分け

類似例と通信結果から、アプリの依存更新より、Codespacesの転送登録・ブラウザ向けアクセス経路が候補になる。認証Cookieだけを原因と決めない。

1. 開発サーバーはそのままにして、Codespacesの「ポート」タブで5173番の転送を停止する。これはViteプロセスの停止とは別。
2. 「ポートの追加」または「Forward a Port」で5173番を追加し直す。
3. 公開範囲はPrivate、転送元のプロトコルはHTTPにする（ブラウザで開く外部URLがHTTPSなのは正常）。
4. ポートタブからコピーした現在のURLを新しいタブで開く。GitHubの確認画面が出た場合は自身のCodespaceを確認してContinue。
5. それでも404なら、ChromeのNetworkで最初のDocumentリクエストのURL・ステータス・応答内容を確認し、アプリ由来かGitHub由来かを判別する。Cookieや認証ヘッダーの共有は不要。

これは類似事例に基づく切り分け手順であり、この利用者環境での復旧は未確認。コンテナの再ビルド、コードや依存の巻き戻し、公開範囲の変更は行っていない。

参考: [GitHub公式の転送トラブルシューティング](https://docs.github.com/en/codespaces/troubleshooting/troubleshooting-port-forwarding-for-github-codespaces)、[公式の転送手順](https://docs.github.com/en/codespaces/developing-in-a-codespace/forwarding-ports-in-your-codespace)、[Privateポートの認証とCookie](https://docs.github.com/en/codespaces/reference/security-in-github-codespaces)。

## 再発時の確認と表示回復（2026-11-13）

- 利用者が同じ5173番URLでChromeの汎用HTTP ERROR 404を報告。シークレットウィンドウでも同じ結果だった。
- 内部の5173番はHTTP 200で、認証付きの実Chromiumでも図面モードを表示でき、HTTPエラーとJavaScript例外はなかった。認証なしの新規ブラウザはGitHubのログイン画面へ進んだ。この差だけで、利用者側の認証・キャッシュを原因と断定しない。
- 既にPrivate登録されていた4188番へ診断用の同じアプリを起動した。こちらの認証付き確認は成功したが、利用者側では同じ404だった。新しい5174番は転送未登録で、内部200・転送404となったため、診断後に停止した。
- Private設定を再適用し、GitHub CLIの`gh codespace ports forward 5173:25173 -c <codespace-name>`で5173番の転送登録とホスト側の転送情報を更新した。ローカルの25173番を通したHTML取得は200だった。Publicへの変更は行っていない。
- その後、利用者から「一旦表示されました」と報告を受けた。複数の確認・操作を伴うため、特定の一操作が原因を解消したとまでは断定しない。Viteの変更だけで404を修正した、あるいは利用者のブラウザ内を直接確認したとは扱わない。

診断用のポート番号やCodespace名をアプリのコードへ固定しない。通常の開発起動は5173番・Privateのままとし、今回の転送状態の更新とアプリの機能変更を区別する。
