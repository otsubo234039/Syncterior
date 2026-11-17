import React from 'react';
import { House } from 'lucide-react';
export function AppLayout({
  children
}) {
  return <div className="app">
  <header><div className="brand"><div className="brand-mark"><House size={20} /></div><div><div className="brand-title">シンク<span>テリア</span></div></div></div><div className="header-right"><span className="save-label">プロトタイプ</span></div></header>
<main>{children}</main>
  <footer><span>シンクテリア © 2026</span><span>家具寸法は目安です。実際の製品寸法をご確認ください。</span></footer>
</div>;
}
