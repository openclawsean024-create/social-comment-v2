'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface PendingReply {
  id: string;
  name: string;
  comment: string;
  reply: string;
  timestamp: number;
}

const STORAGE_PENDING = 'social_reply_pending';
const STORAGE_HISTORY = 'social_reply_history';

export default function ReviewPage() {
  const router = useRouter();
  const [pending, setPending] = useState<PendingReply[]>([]);
  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (sessionStorage.getItem('social_reply_logged_in') !== 'true') {
      router.push('/');
      return;
    }
    try {
      const saved = localStorage.getItem(STORAGE_PENDING);
      if (saved) setPending(JSON.parse(saved));
    } catch {}
  }, [router]);

  const savePending = (updated: PendingReply[]) => {
    setPending(updated);
    localStorage.setItem(STORAGE_PENDING, JSON.stringify(updated));
  };

  const saveHistory = (entry: Omit<PendingReply, 'id'>) => {
    const history = JSON.parse(localStorage.getItem(STORAGE_HISTORY) || '[]');
    history.unshift({ ...entry, id: `${Date.now()}`, timestamp: Date.now() });
    localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history.slice(0, 100)));
  };

  const handleCopy = async (reply: string) => {
    try {
      await navigator.clipboard.writeText(reply);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert('複製失敗，請手動複製');
    }
  };

  const handleApprove = (item: PendingReply) => {
    saveHistory({ name: item.name, comment: item.comment, reply: item.reply, timestamp: item.timestamp });
    savePending(pending.filter(p => p.id !== item.id));
    handleCopy(item.reply);
  };

  const handleBulkApprove = () => {
    const toApprove = pending.filter(p => selected.has(p.id));
    toApprove.forEach(p => saveHistory({ name: p.name, comment: p.comment, reply: p.reply, timestamp: p.timestamp }));
    savePending(pending.filter(p => !selected.has(p.id)));
    setSelected(new Set());
    const allReplies = toApprove.map(p => `[${p.name}]\n${p.reply}`).join('\n\n');
    navigator.clipboard.writeText(allReplies).catch(() => {});
  };

  const handleDelete = (id: string) => {
    savePending(pending.filter(p => p.id !== id));
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-100 tracking-tight">待審核列</h1>
        <p className="text-sm mt-1" style={{ color: '#64748B' }}>點擊「複製」將回覆內容拷貝至剪貼簿，再手動貼回 Facebook</p>
      </div>

      {pending.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: '#1A1A2E', border: '1px solid #2A2A4A' }}>
          <div className="text-4xl mb-3">✅</div>
          <p className="font-medium" style={{ color: '#64748B' }}>目前沒有待審核的回覆</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 text-sm font-medium transition-all"
            style={{ color: '#6366F1' }}
            onMouseEnter={e => (e.target as HTMLElement).style.textDecoration = 'underline'}
            onMouseLeave={e => (e.target as HTMLElement).style.textDecoration = 'none'}
          >
            返回留言回覆
          </button>
        </div>
      ) : (
        <>
          {/* Bulk actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleBulkApprove}
              disabled={selected.size === 0}
              className="font-semibold px-5 py-2.5 rounded-xl text-sm text-white transition-all"
              style={{ background: selected.size === 0 ? '#334155' : '#10B981' }}
              onMouseEnter={e => { if (selected.size > 0) (e.target as HTMLElement).style.background = '#059669'; }}
              onMouseLeave={e => { if (selected.size > 0) (e.target as HTMLElement).style.background = '#10B981'; }}
            >
              批量複製已勾選 ({selected.size})
            </button>
            <button
              onClick={() => setSelected(prev => new Set(prev.size === pending.length ? [] : pending.map(p => p.id)))}
              className="font-medium px-3 py-2.5 text-sm transition-colors"
              style={{ color: '#64748B' }}
              onMouseEnter={e => { (e.target as HTMLElement).style.color = '#94A3B8'; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.color = '#64748B'; }}
            >
              {selected.size === pending.length ? '取消全選' : '全選'}
            </button>
          </div>

          <div className="space-y-3">
            {pending.map(item => (
              <div key={item.id} className="rounded-2xl p-5 transition-all hover-scale" style={{ background: '#1A1A2E', border: '1px solid #2A2A4A' }}>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    onChange={() => toggleSelect(item.id)}
                    className="mt-1 w-4 h-4 rounded"
                    style={{ accentColor: '#6366F1' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold" style={{ color: '#F1F5F9' }}>{item.name}</span>
                      <span className="text-xs" style={{ color: '#334155' }}>
                        {new Date(item.timestamp).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-sm mt-1" style={{ color: '#64748B' }}>{item.comment}</div>
                    <div className="mt-3 rounded-xl p-3" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}>
                      <div className="text-sm font-semibold" style={{ color: '#818CF8' }}>回覆內容：</div>
                      <div className="text-sm mt-1" style={{ color: '#A5B4FC' }}>{item.reply}</div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleCopy(item.reply)}
                        className="font-semibold px-4 py-2 rounded-xl text-sm text-white transition-all"
                        style={{ background: '#6366F1' }}
                        onMouseEnter={e => (e.target as HTMLElement).style.background = '#5558E3'}
                        onMouseLeave={e => (e.target as HTMLElement).style.background = '#6366F1'}
                      >
                        複製
                      </button>
                      <button
                        onClick={() => handleApprove(item)}
                        className="font-semibold px-4 py-2 rounded-xl text-sm text-white transition-all"
                        style={{ background: '#10B981' }}
                        onMouseEnter={e => (e.target as HTMLElement).style.background = '#059669'}
                        onMouseLeave={e => (e.target as HTMLElement).style.background = '#10B981'}
                      >
                        複製並移至歷史
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="font-semibold px-4 py-2 rounded-xl text-sm transition-all"
                        style={{ color: '#F87171' }}
                        onMouseEnter={e => (e.target as HTMLElement).style.background = 'rgba(239,68,68,0.1)'}
                        onMouseLeave={e => (e.target as HTMLElement).style.background = 'transparent'}
                      >
                        刪除
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {copied && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full text-sm font-semibold shadow-lg"
          style={{ background: '#10B981', color: 'white' }}>
          已複製到剪貼簿！
        </div>
      )}
    </div>
  );
}
