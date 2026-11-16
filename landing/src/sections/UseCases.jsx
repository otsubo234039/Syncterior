const cases = [
  ['同棲の準備', 'お互いの持ち込み家具が、新居に全部入るか分からない。',
    '手持ちの家具を実寸のまま並べて、収まりを3Dで確かめる。'],
  ['シェアハウス', '共用部の家具を、誰が何を置くかで決まらない。',
    '同じ部屋を全員で同時に見ながら、その場で決める。'],
  ['内見のあと', '内見で見たコンセントの位置を、帰ってから思い出せない。',
    'スマホでコンセント位置をメモし、PCで家具との干渉を確かめる。'],
]

export default function UseCases() {
  return (
    <section className="band" id="cases">
      <div className="wrap">
        <p className="eyebrow">CASES</p>
        <h2>こんなお悩みに</h2>
        <div className="grid3">
          {cases.map(([title, problem, answer]) => (
            <article className="card" key={title}>
              <h3>{title}</h3>
              <p className="label">よくある悩み</p>
              <p className="desc">{problem}</p>
              <p className="label go">シンクテリアで確かめる</p>
              <p className="desc">{answer}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}