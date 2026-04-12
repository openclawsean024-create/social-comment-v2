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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">回覆歷史</h1>
          <p className="text-gray-500 text-sm mt-1">所有已複製的回覆記錄</p>
        </div>
        {history.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={handleCopyAll}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
            >
              複製全部
            </button>
            <button
              onClick={handleExportTxt}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
            >
              匯出 TXT
            </button>
            <button
              onClick={handleExportCsv}
              className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
            >
              匯出 CSV
            </button>
          </div>
        )}
      </div>

      {history.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-gray-500 font-medium">尚無回覆歷史</p>
          <button onClick={() => router.push('/dashboard')} className="mt-4 text-indigo-600 hover:underline text-sm font-medium">
            返回留言回覆
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-600">共 {history.length} 筆記錄</span>
          </div>
          <div className="divide-y divide-gray-50">
            {history.map(entry => (
              <div key={entry.id} className="px-6 py-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-gray-900">{entry.name}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(entry.timestamp).toLocaleString('zh-TW')}
                  </span>
                </div>
                <div className="text-sm text-gray-500">{entry.comment}</div>
                <div className="text-sm font-semibold text-indigo-600 mt-1">→ {entry.reply}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
