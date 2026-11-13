import React from 'react';
import { House } from 'lucide-react';
export function AppLayout({
  children
}) {
  return <div className="app">
  <header><div className="brand"><div className="brand-mark"><House size={20} /></div><div><div className="brand-title">ROOM<span>/</span>PLAN</div><div className="brand-sub">FLOOR PLAN &amp; INTERIOR</div></div></div><div className="header-right"><span className="live-dot" /> 編集モード <span className="divider" /> <span className="save-label">プロトタイプ</span></div></header>
<main>{children}</main>
  <footer><span>ROOM/PLAN © 2026</span><span>寸法は一般的なサイズを参考にした概算です。実際の製品寸法とは異なる場合があります。</span><span>BUILT FOR YOUR SPACE</span></footer>
</div>;
}
