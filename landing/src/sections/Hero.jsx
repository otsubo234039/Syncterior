import { SIMULATOR_URL } from '../config.js'

const pills = ['間取りをつくる', '家具を置く', 'みんなで確かめる']

function RoomDrawing() {
  return (
    <svg viewBox="0 0 520 380" role="img" aria-label="部屋に家具を置いたイメージ図">
      <polygon points="60,250 260,340 460,250 260,160" fill="#e6eadf" />
      <polygon points="60,250 260,160 260,40 60,130" fill="#f4f5ef" stroke="#dfe3dc" />
      <polygon points="260,160 460,250 460,130 260,40" fill="#ecefe7" stroke="#dfe3dc" />
      <polygon points="330,235 390,262 430,242 370,215" fill="#9bbbaa" />
      <polygon points="330,235 390,262 390,280 330,253" fill="#6f9580" />
      <polygon points="390,262 430,242 430,260 390,280" fill="#5b8f78" />
      <polygon points="130,215 190,242 222,226 162,199" fill="#e0bf99" />
      <polygon points="130,215 190,242 190,260 130,233" fill="#c99d73" />
      <polygon points="190,242 222,226 222,244 190,260" fill="#b88a60" />
      <rect x="112" y="150" width="22" height="30" rx="3" fill="#fff" stroke="#d9a548" strokeWidth="3" transform="skewY(-24)" />
      <circle cx="262" cy="296" r="10" fill="#d9a548" />
      <line x1="262" y1="296" x2="262" y2="262" stroke="#8d8a80" strokeWidth="3" />
    </svg>
  )
}

export default function Hero() {
  return (
    <section className="hero">
      <div className="wrap">
        <div className="hero-grid">
          <div>
            <p className="badge">登録不要で試せる</p>
            <h1>完全同期の<br />Co-op型部屋づくり</h1>
            <p className="lead">
              いま持っている家具を、そのままのサイズで部屋に置く。ふたりで、みんなで、同じ部屋を見ながらレイアウトを決められる、家具配置シミュレーターです。
            </p>
            <div className="btns">
              <a className="btn" href={SIMULATOR_URL}>登録なしで試してみる</a>
              <a className="btn ghost" href="#features">特徴を見る</a>
            </div>
            <p className="note">プロトタイプ版 ・ ブラウザだけで動きます</p>
          </div>
          <RoomDrawing />
        </div>
        <ol className="pills">
          {pills.map((t, i) => (
              <li key={t}>
                <span className="num">{i + 1}</span>{t}
              </li>
            ))}
        </ol>
      </div>
    </section>
  )
}