import React from 'react';
import { House } from 'lucide-react';

export function getLandingUrl() {
  const configuredUrl = import.meta.env.VITE_LANDING_URL;
  if (configuredUrl) return configuredUrl;

  if (typeof window === 'undefined') return '/';

  const { protocol, hostname, port } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
    return `${protocol}//${hostname}:5174/`;
  }

  if (hostname.includes('-5173.') && !hostname.includes('-5174.')) {
    return `${protocol}//${hostname.replace('-5173.', '-5174.')}/`;
  }

  if (port) {
    const url = new URL(window.location.href);
    url.port = '5174';
    url.pathname = '/';
    url.search = '';
    url.hash = '';
    return url.toString();
  }

  return `${protocol}//${hostname}/`;
}

export function AppLayout({
  children
}) {
  return <div className="app">
  <header><a className="brand" href={getLandingUrl()} aria-label="ランディングページへ移動"><div className="brand-mark"><House size={20} /></div><div><div className="brand-title">シンク<span>テリア</span></div></div></a><div className="header-right"><span className="save-label">プロトタイプ</span></div></header>
<main>{children}</main>
  <footer><span>シンクテリア © 2026</span><span>家具寸法は目安です。実際の製品寸法をご確認ください。</span></footer>
</div>;
}
