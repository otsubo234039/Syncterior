import { SIMULATOR_URL, GITHUB_URL } from '../config.js'

export default function Footer() {
  return (
    <>
      <section className="cta">
        <h2>まずは、部屋を置いてみよう</h2>
        <a className="btn white" href={SIMULATOR_URL}>登録なしで試してみる</a>
        <p>登録不要で使い始められます</p>
      </section>
      <footer className="bar">
        <span>シンクテリア © 2026</span>
        <span>プロトタイプ版 ・ <a href={GITHUB_URL}>GitHub</a></span>
      </footer>
    </>
  )
}