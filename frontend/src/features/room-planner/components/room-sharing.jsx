import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Link, LogOut, RefreshCw, Share2, Users, X } from 'lucide-react';

const labels = {
  local: '個人で編集中', creating: '共有リンクを作成中', connecting: '部屋に接続中',
  connected: '共同編集中', reconnecting: '再接続中', error: '接続できません',
};

export function RoomSharing({ collaboration, shareRoom, shareUrl, reconnect, leaveRoom, custom = false }) {
  const { roomId, status, error, participants, pending, configured, changingPlan } = collaboration;
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const dialog = useRef(null);
  const linkInput = useRef(null);
  useEffect(() => {
    if (open) dialog.current.showModal();
    else dialog.current.close();
  }, [open]);
  useEffect(() => { setCopied(false); setCopyError(''); }, [shareUrl]);

  async function copyLink() {
    setCopyError('');
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      setCopied(false);
      linkInput.current?.focus();
      linkInput.current?.select();
      setCopyError('コピーできませんでした。リンク欄を選択して手動でコピーしてください。');
    }
  }
  const busy = ['creating', 'connecting'].includes(status);

  return <>
    <div className="sharing-bar">
      <div className="sharing-summary" role="status" aria-live="polite">
        <Users size={17} aria-hidden="true" />
        <strong>{labels[status]}</strong>
        {status === 'connected' && <span>{participants == null ? '参加人数を確認中' : `${participants}人が参加中`}<span className="sharing-separator">・</span>{changingPlan ? '間取りを変更中' : pending ? '変更を同期中' : '変更は同期済み'}</span>}
        {status === 'local' && <span>リンクを共有して、一緒に部屋づくり</span>}
      </div>
      <div className="sharing-actions">
        {roomId && ['error', 'reconnecting'].includes(status) && <button className="sharing-button" onClick={reconnect}><RefreshCw size={15} />再接続</button>}
        <button className="sharing-button primary" onClick={() => { setOpen(true); setCopied(false); setCopyError(''); }} disabled={busy}>
          <Share2 size={15} />{roomId ? '共有リンク' : '部屋を共有'}
        </button>
      </div>
    </div>
    {(error || (roomId && status === 'reconnecting')) && <div className="sharing-notice" role="status">
      <span>{error || '接続が戻るまで編集を一時停止しています。未送信の変更は再接続後に送信します。'}</span>
      {roomId && <button className="sharing-text-button" onClick={leaveRoom}>{pending ? '未送信の変更を破棄して退出' : '個人編集に切り替える'}</button>}
    </div>}
    <dialog ref={dialog} className="share-dialog" aria-labelledby="share-title" aria-describedby="share-description" onCancel={() => setOpen(false)} onClose={() => setOpen(false)}>
      <div className="share-dialog-heading"><div className="share-dialog-icon"><Link size={22} /></div><button className="share-close" aria-label="共有ダイアログを閉じる" onClick={() => setOpen(false)}><X size={20} /></button></div>
      <div className="eyebrow">CREATE TOGETHER</div>
      <h2 id="share-title">この部屋を、一緒につくる</h2>
      <p id="share-description">共有リンクを知っている人は、同じ部屋の家具や間取りを編集できます。選択中の家具や視点は、自分の画面だけで変わります。</p>
      {shareUrl ? <>
        <label className="share-link-label" htmlFor="room-share-link">編集用リンク</label>
        <div className="share-link-field"><input ref={linkInput} id="room-share-link" type="text" readOnly value={shareUrl} onFocus={event => event.target.select()} /><button className="sharing-button primary" onClick={copyLink}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'コピー済み' : 'コピー'}</button></div>
        <p className="share-permission">このリンクには編集権限があります。共有する相手を確認してください。</p>
        {copyError && <p className="share-error" role="alert">{copyError}</p>}
      </> : <>
        {custom && <p className="share-error" role="status">取込間取りの共有は未対応です。個人編集と保存は利用できます。</p>}
        {!configured && <p className="share-error" role="status">共同編集は現在利用できません。個人での編集は引き続き利用できます。</p>}
        {error && configured && <p className="share-error" role="alert">{error}</p>}
        <button className="sharing-button primary share-create" disabled={!configured || busy || custom} onClick={shareRoom}><Share2 size={16} />{status === 'creating' ? 'リンクを作成中…' : '共有リンクを作成'}</button>
      </>}
      {roomId && <div className="share-dialog-footer"><span>退出後は個人用の部屋として編集できます。</span><button className="sharing-text-button" onClick={() => { leaveRoom(); setOpen(false); }}><LogOut size={14} />{pending ? '未送信の変更を破棄して退出' : '共同編集から退出'}</button></div>}
    </dialog>
  </>;
}
