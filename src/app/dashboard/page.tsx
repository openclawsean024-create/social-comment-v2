'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface ParsedComment {
  id: string;
  name: string;
  comment: string;
  status: 'pending' | 'replied';
  matchedKeyword?: string;
  replyContent?: string;
}

interface KeywordRule {
  id: string;
  keyword: string;
  reply: string;
  matchMode: 'exact' | 'fuzzy';
}

function parseComments(raw: string): ParsedComment[] {
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  return lines.map((line, i) => {
    let match = line.match(/^([^：:]+)[：:]\s*(.+)$/);
    if (match) return { id: `${i}-${Date.now()}`, name: match[1].trim(), comment: match[2].trim(), status: 'pending' as const };
    match = line.match(/^([^｜|]+)[｜|]\s*(.+)$/);
    if (match) return { id: `${i}-${Date.now()}`, name: match[1].trim(), comment: match[2].trim(), status: 'pending' as const };
    const parts = line.split(/\s{2,}|\t/).filter(Boolean);
    if (parts.length >= 2) {
      return { id: `${i}-${Date.now()}`, name: parts[0].trim(), comment: parts.slice(1).join(' ').trim(), status: 'pending' as const };
    }
    return { id: `${i}-${Date.now()}`, name: parts[0] || line, comment: '', status: 'pending' as const };
  });
}

function applyKeywordRules(comments: ParsedComment[], rules: KeywordRule[]): ParsedComment[] {
  return comments.map(c => {
    for (const rule of rules) {
      const text = `${c.name} ${c.comment}`.toLowerCase();
      const kw = rule.keyword.toLowerCase();
      const matched = rule.matchMode === 'exact' ? text === kw : text.includes(kw);
      if (matched) {
        return { ...c, matchedKeyword: rule.keyword, replyContent: rule.reply };
      }
    }
    return c;
  });
}

const STORAGE_COMMENTS = 'social_reply_comments';
const STORAGE_KEYWORDS = 'social_reply_keywords';
const STORAGE_PENDING = 'social_reply_pending';

export default function DashboardPage() {
  const router = useRouter();
  const [pasteInput, setPasteInput] = useState('');
  const [comments, setComments] = useState<ParsedComment[]>([]);
  const [keywordRules, setKeywordRules] = useState<KeywordRule[]>([]);
  const [pendingReplies, setPendingReplies] = useState<{name: string; comment: string; reply: string}[]>([]);

  useEffect(() => {
    if (sessionStorage.getItem('social_reply_logged_in') !== 'true') {
      router.push('/');
    }
  }, [router]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_COMMENTS);
      if (saved) setComments(JSON.parse(saved));
      const savedRules = localStorage.getItem(STORAGE_KEYWORDS);
      if (savedRules) setKeywordRules(JSON.parse(savedRules));
      const savedPending = localStorage.getItem(STORAGE_PENDING);
      if (savedPending) setPendingReplies(JSON.parse(savedPending));
    } catch {}
  }, []);

  const handlePasteAndParse = useCallback(() => {
    if (!pasteInput.trim()) return;
    const parsed = parseComments(pasteInput);
    const withRules = applyKeywordRules(parsed, keywordRules);
    setComments(prev => {
      const updated = [...prev, ...withRules];
      localStorage.setItem(STORAGE_COMMENTS, JSON.stringify(updated));
      return updated;
    });
    setPasteInput('');
    const newPending = withRules
      .filter(c => c.replyContent)
      .map(c => ({ name: c.name, comment: c.comment, reply: c.replyContent! }));
    if (newPending.length > 0) {
      setPendingReplies(prev => {
        const updated = [...prev, ...newPending];
        localStorage.setItem(STORAGE_PENDING, JSON.stringify(updated));
        return updated;
      });
    }
  }, [pasteInput, keywordRules]);

  const handleClearAll = () => {
    if (!confirm('確定要清除所有留言嗎？')) return;
    setComments([]);
    localStorage.removeItem(STORAGE_COMMENTS);
  };

  const handleAppendPaste = () => {
    if (!pasteInput.trim()) return;
    const parsed = parseComments(pasteInput);
    const withRules = applyKeywordRules(parsed, keywordRules);
    setComments(prev => {
      const updated = [...prev, ...withRules];
      localStorage.setItem(STORAGE_COMMENTS, JSON.stringify(updated));
      return updated;
    });
    setPasteInput('');
  };

  const pendingCount = pendingReplies.length;
  const repliedCount = comments.filter(c => c.replyContent).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-100 tracking-tight">留言回覆</h1>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>粘貼論壇或粉絲頁留言名單，系統自動對應關鍵字回覆</p>
        </div>
        <div className="flex gap-2">
          {pendingCount > 0 && (
            <button
              onClick={() => router.push('/review')}
              className="font-semibold px-4 py-2 rounded-xl text-sm flex items-center gap-2 transition-all"
              style={{ background: 'rgba(245,158,11,0.15)', color: '#FBBF24', border: '1px solid rgba(245,158,11,0.2)' }}
            >
              待審核
              <span className="rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold" style={{ background: '#F59E0B', color: '#0F0F23' }}>
                {pendingCount}
              </span>
            </button>
          )}
          <button
            onClick={() => router.push('/keywords')}
            className="font-semibold px-4 py-2 rounded-xl text-sm text-white transition-all"
            style={{ background: '#6366F1' }}
            onMouseEnter={e => (e.target as HTMLElement).style.background = '#5558E3'}
            onMouseLeave={e => (e.target as HTMLElement).style.background = '#6366F1'}
          >
            關鍵字設定
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Paste Area */}
        <div className="rounded-2xl p-6" style={{ background: '#1A1A2E', border: '1px solid #2A2A4A' }}>
          <h2 className="font-bold mb-4" style={{ color: '#E2E8F0' }}>粘貼留言名單</h2>
          <textarea
            value={pasteInput}
            onChange={(e) => setPasteInput(e.target.value)}
            placeholder="粘貼論壇/粉絲頁留言名單到此處&#10;&#10;支援格式：&#10;王小明：我想報名這個活動&#10;李小美｜想要了解更多詳情&#10;張阿強    留個言支持一下"
            className="w-full h-52 px-4 py-3 rounded-xl text-sm resize-none outline-none"
            style={{ background: '#252542', border: '1px solid #2A2A4A', color: '#F8FAFC' }}
            onFocus={e => (e.target as HTMLElement).style.borderColor = '#6366F1'}
            onBlur={e => (e.target as HTMLElement).style.borderColor = '#2A2A4A'}
          />
          <div className="flex gap-3 mt-4">
            <button
              onClick={handlePasteAndParse}
              className="flex-1 font-semibold py-2.5 rounded-xl text-sm text-white transition-all"
              style={{ background: '#6366F1' }}
              onMouseEnter={e => (e.target as HTMLElement).style.background = '#5558E3'}
              onMouseLeave={e => (e.target as HTMLElement).style.background = '#6366F1'}
            >
              解析並新增留言
            </button>
            <button
              onClick={handleAppendPaste}
              className="flex-1 font-semibold py-2.5 rounded-xl text-sm transition-all"
              style={{ background: '#252542', color: '#94A3B8', border: '1px solid #2A2A4A' }}
              onMouseEnter={e => { (e.target as HTMLElement).style.background = '#2A2A4A'; (e.target as HTMLElement).style.color = '#E2E8F0'; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.background = '#252542'; (e.target as HTMLElement).style.color = '#94A3B8'; }}
            >
              追加留言
            </button>
            <button
              onClick={handleClearAll}
              className="px-4 py-2.5 font-semibold rounded-xl text-sm transition-all"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#F87171', border: '1px solid rgba(239,68,68,0.15)' }}
              onMouseEnter={e => (e.target as HTMLElement).style.background = 'rgba(239,68,68,0.2)'}
              onMouseLeave={e => (e.target as HTMLElement).style.background = 'rgba(239,68,68,0.1)'}
            >
              清除全部
            </button>
          </div>
          <div className="mt-4 p-3 rounded-xl text-xs" style={{ background: '#252542', color: '#64748B' }}>
            <p className="font-semibold mb-1" style={{ color: '#94A3B8' }}>支援格式：</p>
            <p>• 名字：留言內容（冒號分隔）</p>
            <p>• 名字｜留言內容（豎線分隔）</p>
            <p>• 名字　　留言內容（tab/多空白分隔）</p>
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-4">
          <div className="rounded-2xl p-6" style={{ background: '#1A1A2E', border: '1px solid #2A2A4A' }}>
            <h2 className="font-bold mb-4" style={{ color: '#E2E8F0' }}>統計</h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: '總留言數', value: comments.length, color: '#6366F1' },
                { label: '待回覆', value: comments.length - repliedCount, color: '#F59E0B' },
                { label: '已有回覆', value: repliedCount, color: '#10B981' },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <div className="text-3xl font-extrabold" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-xs mt-1" style={{ color: '#64748B' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl p-6" style={{ background: '#1A1A2E', border: '1px solid #2A2A4A' }}>
            <h2 className="font-bold mb-4" style={{ color: '#E2E8F0' }}>待審核回覆</h2>
            {pendingReplies.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: '#334155' }}>目前沒有待審核的回覆</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-auto">
                {pendingReplies.slice(-5).reverse().map((p, i) => (
                  <div key={i} className="rounded-xl p-3" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
                    <div className="text-xs font-bold" style={{ color: '#FBBF24' }}>{p.name}</div>
                    <div className="text-sm mt-1 line-clamp-1" style={{ color: '#94A3B8' }}>{p.comment}</div>
                    <div className="text-sm font-semibold mt-1" style={{ color: '#818CF8' }}>→ {p.reply}</div>
                  </div>
                ))}
              </div>
            )}
            {pendingReplies.length > 0 && (
              <button
                onClick={() => router.push('/review')}
                className="mt-3 w-full font-semibold py-2 rounded-xl text-sm text-white transition-all"
                style={{ background: '#F59E0B' }}
                onMouseEnter={e => (e.target as HTMLElement).style.background = '#D97706'}
                onMouseLeave={e => (e.target as HTMLElement).style.background = '#F59E0B'}
              >
                查看全部 {pendingReplies.length} 筆待審核
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Comments List */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#1A1A2E', border: '1px solid #2A2A4A' }}>
        <div className="px-6 py-4" style={{ borderBottom: '1px solid #2A2A4A' }}>
          <h2 className="font-bold" style={{ color: '#E2E8F0' }}>留言列表</h2>
        </div>
        <div>
          {comments.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm" style={{ color: '#334155' }}>
              尚無留言，請在上方粘貼留言名單
            </div>
          ) : (
            comments.slice().reverse().map((c) => (
              <div key={c.id} className="px-6 py-4 flex items-start gap-4" style={{ borderBottom: '1px solid #1E1E3A' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold" style={{ color: '#F1F5F9' }}>{c.name}</span>
                    {c.replyContent && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'rgba(16,185,129,0.12)', color: '#34D399' }}>
                        已對應
                      </span>
                    )}
                  </div>
                  <div className="text-sm mt-0.5 line-clamp-2" style={{ color: '#64748B' }}>
                    {c.comment || <span className="italic">（無留言內容）</span>}
                  </div>
                  {c.matchedKeyword && (
                    <div className="text-xs mt-1" style={{ color: '#6366F1' }}>
                      關鍵字「{c.matchedKeyword}」→ {c.replyContent}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
