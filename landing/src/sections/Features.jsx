const features = [
  ['M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM12 12l8-4.5M12 12v9M12 12L4 7.5',
    '3Dで確認', '部屋と家具を3Dで見て、広さを確かめます。'],
  ['M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3',
    '家具を自由に配置', 'ドラッグで動かして、90°ずつ回転できます。'],
  ['M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM3 16l5-5 4 4 3-3 6 6',
    '間取り図から部屋をつくる', '間取り図の画像を読み込んで、実寸の部屋にします。'],
  ['M9 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M17 6.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM16 14.2c3 .2 5 2.3 5 5.8',
    'みんなで同時に編集', '同じ部屋を、みんなで同時に編集できます。'],
  ['M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0V8zM12 17v4',
    'コンセントや設備まで再現', 'コンセントの位置まで入れて、置けるかを確かめます。'],
  ['M9 2h6a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2',
    '内見はスマホ、仕上げはPC', '内見先でスマホにメモして、帰ってからPCで仕上げます。'],
]

export default function Features() {
  return (
    <section className="band" id="features">
      <div className="wrap">
        <h2>シンクテリアでできること</h2>
        <div className="grid3">
          {features.map(([d, title, text]) => (
            <article className="card" key={title}>
              <span className="icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#345e4e"
                  strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={d} />
                </svg>
              </span>
              <h3>{title}</h3>
              <p className="desc">{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}