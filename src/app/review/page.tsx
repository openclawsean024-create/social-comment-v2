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
    // Bulk copy
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">待審核列</h1>
        <p className="text-gray-500 text-sm mt-1">點擊「複製」將回覆內容拷貝至剪貼簿，再手動貼回 Facebook</p>
      </div>

      {pending.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-3">✅</div>
          <p className="text-gray-500 font-medium">目前沒有待審核的回覆</p>
          <button onClick={() => router.push('/dashboard')} className="mt-4 text-indigo-600 hover:underline text-sm font-medium">
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
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
            >
              批量複製已勾選 ({selected.size})
            </button>
            <button
              onClick={() => setSelected(prev => new Set(prev.size === pending.length ? [] : pending.map(p => p.id)))}
              className="text-gray-500 hover:text-gray-700 text-sm font-medium px-3 py-2.5"
            >
              {selected.size === pending.length ? '取消全選' : '全選'}
            </button>
          </div>

          <div className="space-y-3">
            {pending.map(item => (
              <div key={item.id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    onChange={() => toggleSelect(item.id)}
                    className="mt-1 w-4 h-4 accent-indigo-600 rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">{item.name}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(item.timestamp).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 mt-1">{item.comment}</div>
                    <div className="mt-3 bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                      <div className="text-sm font-semibold text-indigo-800">回覆內容：</div>
                      <div className="text-sm text-indigo-700 mt-1">{item.reply}</div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleCopy(item.reply)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
                      >
                        複製
                      </button>
                      <button
                        onClick={() => handleApprove(item)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
                      >
                        複製並移至歷史
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-red-500 hover:bg-red-50 font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-full text-sm font-semibold shadow-lg">
          已複製到剪貼簿！
        </div>
      )}
    </div>
  );
}
