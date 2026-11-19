import React from 'react';
import { Box } from 'lucide-react';

export function ViewportLoading() {
  return <div className="viewport-loading" role="status" aria-live="polite" aria-atomic="true">
    <div className="viewport-loading-mark" aria-hidden="true"><span className="viewport-loading-ring" /><Box size={24} strokeWidth={1.5} /></div>
    <p>3Dを読み込み中…</p>
  </div>;
}
