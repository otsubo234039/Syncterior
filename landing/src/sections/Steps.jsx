const steps = [
  {
    title: '間取りをつくる',
    text: '3種類から選ぶか、間取り図の画像を読み込みます。',
    points: [
      ['M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4z', '3種類から選ぶ'],
      ['M12 16V4M7 9l5-5 5 5M4 20h16', '間取り図を読み込む'],
      ['M3 17L17 3l4 4L7 21zM8 12l2 2M11 9l2 2M14 6l2 2', '実寸に合わせる'],
    ],
    media: null,
  },
  {
    title: '家具を置く',
    text: 'ドラッグで動かして、90°ずつ回転できます。',
    points: [
      ['M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3', 'ドラッグで移動'],
      ['M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7', '90°ずつ回転'],
      ['M4 4h16v16H4zM9 9h6v6H9z', '壁にはみ出さない'],
    ],
    media: null,
  },
  {
    title: 'みんなで確かめる',
    text: '3Dで収まりを見て、リンクで共有して決めます。',
    points: [
      ['M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM12 12l8-4.5M12 12v9M12 12L4 7.5', '3Dで視点を回す'],
      ['M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6', '自動保存'],
      ['M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1', '招待リンクで共有'],
    ],
    media: null,
  },
]

function Media({ src, label }) {
  if (!src) {
    return <div className="media placeholder">ここに画像か動画を入れる</div>
  }
  if (/\.(mp4|webm)$/.test(src)) {
    return <video className="media" src={src} autoPlay loop muted playsInline />
  }
  return <img className="media" src={src} alt={label} />
}

export default function Steps() {
  return (
    <section className="band alt" id="howto">
      <div className="wrap">
        <h2>3ステップで、部屋ができる</h2>
        <ol className="steps">
          {steps.map((s, i) => (
            <li className="card step" key={s.title}>
              <div>
                <span className="num">{i + 1}</span>
                <h3>{s.title}</h3>
                <p className="desc">{s.text}</p>
                <ul className="st-cards">
                  {s.points.map(([d, label]) => (
                    <li className="st-card" key={label}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#5b8f78"
                        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d={d} />
                      </svg>
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
              <Media src={s.media} label={`${s.title}の画面`} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}