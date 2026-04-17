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
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-100 tracking-tight">關鍵字設定</h1>
        <p className="text-sm mt-1" style={{ color: '#64748B' }}>設定關鍵字與對應回覆內容，系統自動匹配</p>
      </div>

      {/* Add Rule */}
      <div className="rounded-2xl p-6" style={{ background: '#1A1A2E', border: '1px solid #2A2A4A' }}>
        <h2 className="font-bold mb-4" style={{ color: '#E2E8F0' }}>新增規則</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            placeholder="關鍵字（例如：價格）"
            className="px-4 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: '#252542', border: '1px solid #2A2A4A', color: '#F8FAFC' }}
            onFocus={e => (e.target as HTMLElement).style.borderColor = '#6366F1'}
            onBlur={e => (e.target as HTMLElement).style.borderColor = '#2A2A4A'}
          />
          <input
            value={reply}
            onChange={e => setReply(e.target.value)}
            placeholder="回覆內容（例如：請私訊我們）"
            className="px-4 py-2.5 rounded-xl text-sm outline-none md:col-span-2"
            style={{ background: '#252542', border: '1px solid #2A2A4A', color: '#F8FAFC' }}
            onFocus={e => (e.target as HTMLElement).style.borderColor = '#6366F1'}
            onBlur={e => (e.target as HTMLElement).style.borderColor = '#2A2A4A'}
          />
          <div className="flex gap-2">
            <select
              value={matchMode}
              onChange={e => setMatchMode(e.target.value as 'exact' | 'fuzzy')}
              className="px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: '#252542', border: '1px solid #2A2A4A', color: '#94A3B8' }}
            >
              <option value="fuzzy">模糊</option>
              <option value="exact">精準</option>
            </select>
            <button
              onClick={handleAdd}
              className="flex-1 font-semibold rounded-xl text-sm text-white transition-all"
              style={{ background: '#6366F1' }}
              onMouseEnter={e => (e.target as HTMLElement).style.background = '#5558E3'}
              onMouseLeave={e => (e.target as HTMLElement).style.background = '#6366F1'}
            >
              新增
            </button>
          </div>
        </div>
      </div>

      {/* Test */}
      <div className="rounded-2xl p-6" style={{ background: '#1A1A2E', border: '1px solid #2A2A4A' }}>
        <h2 className="font-bold mb-4" style={{ color: '#E2E8F0' }}>測試功能</h2>
        <div className="flex gap-3">
          <input
            value={testInput}
            onChange={e => setTestInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleTest()}
            placeholder="輸入測試語句..."
            className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: '#252542', border: '1px solid #2A2A4A', color: '#F8FAFC' }}
            onFocus={e => (e.target as HTMLElement).style.borderColor = '#6366F1'}
            onBlur={e => (e.target as HTMLElement).style.borderColor = '#2A2A4A'}
          />
          <button
            onClick={handleTest}
            className="font-semibold px-5 py-2.5 rounded-xl text-sm text-white transition-all"
            style={{ background: '#334155' }}
            onMouseEnter={e => (e.target as HTMLElement).style.background = '#475569'}
            onMouseLeave={e => (e.target as HTMLElement).style.background = '#334155'}
          >
            測試
          </button>
        </div>
        {testResult !== null && (
          <div className="mt-3 p-3 rounded-xl text-sm font-medium" style={{
            background: testResult ? 'rgba(16,185,129,0.08)' : 'rgba(100,116,139,0.1)',
            border: testResult ? '1px solid rgba(16,185,129,0.2)' : '1px solid #2A2A4A',
            color: testResult ? '#34D399' : '#64748B'
          }}>
            {testResult ? `觸發回覆：「${testResult}」` : '沒有符合的關鍵字規則'}
          </div>
        )}
      </div>

      {/* Rules List */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#1A1A2E', border: '1px solid #2A2A4A' }}>
        <div className="px-6 py-4" style={{ borderBottom: '1px solid #2A2A4A' }}>
          <h2 className="font-bold" style={{ color: '#E2E8F0' }}>現有規則（{rules.length} 筆）</h2>
        </div>
        {rules.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm" style={{ color: '#334155' }}>
            尚未設定任何關鍵字規則
          </div>
        ) : (
          <div>
            {rules.map(rule => (
              <div key={rule.id} className="px-6 py-4 flex items-center gap-4" style={{ borderBottom: '1px solid #1E1E3A' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold" style={{ color: '#E2E8F0' }}>{rule.keyword}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{
                      background: rule.matchMode === 'exact' ? 'rgba(59,130,246,0.12)' : 'rgba(100,116,139,0.12)',
                      color: rule.matchMode === 'exact' ? '#60A5FA' : '#94A3B8'
                    }}>
                      {rule.matchMode === 'exact' ? '精準' : '模糊'}
                    </span>
                  </div>
                  <div className="text-sm mt-0.5" style={{ color: '#818CF8' }}>→ {rule.reply}</div>
                </div>
                <button
                  onClick={() => handleDelete(rule.id)}
                  className="font-medium px-3 py-1.5 rounded-lg text-sm transition-colors"
                  style={{ color: '#F87171' }}
                  onMouseEnter={e => (e.target as HTMLElement).style.background = 'rgba(239,68,68,0.1)'}
                  onMouseLeave={e => (e.target as HTMLElement).style.background = 'transparent'}
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
