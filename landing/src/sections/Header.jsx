import { SIMULATOR_URL } from '../config.js'

export default function Header() {
  return (
    <header className="top">
      <span className="logo">シンク<span>テリア</span></span>
      <nav>
        <a href="#features">特徴</a>
        <a href="#howto">使い方</a>
        <a href="#faq">よくある質問</a>
      </nav>
      <a className="btn" href={SIMULATOR_URL}>はじめる</a>
    </header>
  )
}