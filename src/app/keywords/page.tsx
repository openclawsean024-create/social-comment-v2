'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface KeywordRule {
  id: string;
  keyword: string;
  reply: string;
  matchMode: 'exact' | 'fuzzy';
}

const STORAGE_KEYWORDS = 'social_reply_keywords';

export default function KeywordsPage() {
  const router = useRouter();
  const [rules, setRules] = useState<KeywordRule[]>([]);
  const [keyword, setKeyword] = useState('');
  const [reply, setReply] = useState('');
  const [matchMode, setMatchMode] = useState<'exact' | 'fuzzy'>('fuzzy');
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem('social_reply_logged_in') !== 'true') {
      router.push('/');
      return;
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEYWORDS);
      if (saved) setRules(JSON.parse(saved));
    } catch {}
  }, [router]);

  const saveRules = (updated: KeywordRule[]) => {
    setRules(updated);
    localStorage.setItem(STORAGE_KEYWORDS, JSON.stringify(updated));
  };

  const handleAdd = () => {
    if (!keyword.trim() || !reply.trim()) return;
    const newRule: KeywordRule = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      keyword: keyword.trim(),
      reply: reply.trim(),
      matchMode,
    };
    saveRules([...rules, newRule]);
    setKeyword('');
    setReply('');
  };

  const handleDelete = (id: string) => {
    if (!confirm('確定刪除此規則？')) return;
    saveRules(rules.filter(r => r.id !== id));
  };

  const handleTest = () => {
    if (!testInput.trim()) { setTestResult(null); return; }
    const lower = testInput.toLowerCase();
    const matched = rules.find(r =>
      r.matchMode === 'exact'
        ? lower === r.keyword.toLowerCase()
        : lower.includes(r.keyword.toLowerCase())
    );
    setTestResult(matched ? matched.reply : null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">關鍵字設定</h1>
        <p className="text-gray-500 text-sm mt-1">設定關鍵字與對應回覆內容，系統自動匹配</p>
      </div>

      {/* Add Rule */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 className="font-bold text-gray-800 mb-4">新增規則</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            placeholder="關鍵字（例如：價格）"
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            value={reply}
            onChange={e => setReply(e.target.value)}
            placeholder="回覆內容（例如：請私訊我們）"
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 md:col-span-2"
          />
          <div className="flex gap-2">
            <select
              value={matchMode}
              onChange={e => setMatchMode(e.target.value as 'exact' | 'fuzzy')}
              className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="fuzzy">模糊</option>
              <option value="exact">精準</option>
            </select>
            <button
              onClick={handleAdd}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
            >
              新增
            </button>
          </div>
        </div>
      </div>

      {/* Test */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 className="font-bold text-gray-800 mb-4">測試功能</h2>
        <div className="flex gap-3">
          <input
            value={testInput}
            onChange={e => setTestInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleTest()}
            placeholder="輸入測試語句..."
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={handleTest}
            className="bg-gray-800 hover:bg-gray-900 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
          >
            測試
          </button>
        </div>
        {testResult !== null && (
          <div className={`mt-3 p-3 rounded-xl text-sm font-medium ${testResult ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-gray-50 border border-gray-200 text-gray-500'}`}>
            {testResult ? `觸發回覆：「${testResult}」` : '沒有符合的關鍵字規則'}
          </div>
        )}
      </div>

      {/* Rules List */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">現有規則（{rules.length} 筆）</h2>
        </div>
        {rules.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">
            尚未設定任何關鍵字規則
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {rules.map(rule => (
              <div key={rule.id} className="px-6 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{rule.keyword}</span>
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${rule.matchMode === 'exact' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {rule.matchMode === 'exact' ? '精準' : '模糊'}
                    </span>
                  </div>
                  <div className="text-sm text-indigo-600 mt-0.5">→ {rule.reply}</div>
                </div>
                <button
                  onClick={() => handleDelete(rule.id)}
                  className="text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                >
                  刪除
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
