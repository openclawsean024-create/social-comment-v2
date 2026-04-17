'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface HistoryEntry {
  id: string;
  name: string;
  comment: string;
  reply: string;
  timestamp: number;
}

const STORAGE_HISTORY = 'social_reply_history';

export default function HistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    if (sessionStorage.getItem('social_reply_logged_in') !== 'true') {
      router.push('/');
      return;
    }
    try {
      const saved = localStorage.getItem(STORAGE_HISTORY);
      if (saved) setHistory(JSON.parse(saved));
    } catch {}
  }, [router]);

  const handleExportTxt = () => {
    const content = history.map(h =>
      `[${new Date(h.timestamp).toLocaleString('zh-TW')}]\n${h.name}：${h.comment}\n回覆：${h.reply}`
    ).join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '回覆歷史.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    const header = '時間,姓名,留言,回覆內容\n';
    const rows = history.map(h =>
      `"${new Date(h.timestamp).toLocaleString('zh-TW')}","${h.name}","${h.comment.replace(/"/g, '""')}","${h.reply.replace(/"/g, '""')}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '回覆歷史.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyAll = async () => {
    const text = history.map(h => `[${h.name}]\n${h.reply}`).join('\n\n');
    await navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-100 tracking-tight">回覆歷史</h1>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>所有已複製的回覆記錄</p>
        </div>
        {history.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={handleCopyAll}
              className="font-semibold px-4 py-2 rounded-xl text-sm transition-all"
              style={{ background: '#252542', color: '#94A3B8', border: '1px solid #2A2A4A' }}
              onMouseEnter={e => { (e.target as HTMLElement).style.background = '#2A2A4A'; (e.target as HTMLElement).style.color = '#E2E8F0'; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.background = '#252542'; (e.target as HTMLElement).style.color = '#94A3B8'; }}
            >
              複製全部
            </button>
            <button
              onClick={handleExportTxt}
              className="font-semibold px-4 py-2 rounded-xl text-sm text-white transition-all"
              style={{ background: '#6366F1' }}
              onMouseEnter={e => (e.target as HTMLElement).style.background = '#5558E3'}
              onMouseLeave={e => (e.target as HTMLElement).style.background = '#6366F1'}
            >
              匯出 TXT
            </button>
            <button
              onClick={handleExportCsv}
              className="font-semibold px-4 py-2 rounded-xl text-sm transition-all"
              style={{ background: 'rgba(99,102,241,0.1)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.2)' }}
              onMouseEnter={e => (e.target as HTMLElement).style.background = 'rgba(99,102,241,0.2)'}
              onMouseLeave={e => (e.target as HTMLElement).style.background = 'rgba(99,102,241,0.1)'}
            >
              匯出 CSV
            </button>
          </div>
        )}
      </div>

      {history.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: '#1A1A2E', border: '1px solid #2A2A4A' }}>
          <div className="text-4xl mb-3">📭</div>
          <p className="font-medium" style={{ color: '#64748B' }}>尚無回覆歷史</p>
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
        <div className="rounded-2xl overflow-hidden" style={{ background: '#1A1A2E', border: '1px solid #2A2A4A' }}>
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #2A2A4A' }}>
            <span className="text-sm font-semibold" style={{ color: '#64748B' }}>共 {history.length} 筆記錄</span>
          </div>
          <div>
            {history.map(entry => (
              <div key={entry.id} className="px-6 py-4" style={{ borderBottom: '1px solid #1E1E3A' }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold" style={{ color: '#F1F5F9' }}>{entry.name}</span>
                  <span className="text-xs" style={{ color: '#334155' }}>
                    {new Date(entry.timestamp).toLocaleString('zh-TW')}
                  </span>
                </div>
                <div className="text-sm" style={{ color: '#64748B' }}>{entry.comment}</div>
                <div className="text-sm font-semibold mt-1" style={{ color: '#818CF8' }}>→ {entry.reply}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
