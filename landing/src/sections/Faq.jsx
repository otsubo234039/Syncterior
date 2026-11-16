const faqs = [
  ['登録やログインは必要ですか?', '現在のプロトタイプ版では不要です。配置はお使いのブラウザに自動保存されます。'],
  ['特定のメーカーの家具しか置けませんか?', 'いいえ。特定のブランドに依存しない、手持ちの家具のための道具です。'],
  ['スマホでも使えますか?', '小さい画面にも対応した作りですが、実機での確認はこれからです。'],
]

export default function Faq() {
  return (
    <section className="band alt" id="faq">
      <div className="wrap">
        <p className="eyebrow">FAQ</p>
        <h2>よくある質問</h2>
        {faqs.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p className="desc">{a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}