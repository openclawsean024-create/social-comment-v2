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

// ─── Format Parsers ─────────────────────────────────────────────────────────
function parseComments(raw: string): ParsedComment[] {
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  return lines.map((line, i) => {
    // Format 1: "名字：留言內容"
    let match = line.match(/^([^：:]+)[：:]\s*(.+)$/);
    if (match) return { id: `${i}-${Date.now()}`, name: match[1].trim(), comment: match[2].trim(), status: 'pending' as const };

    // Format 2: "名字｜留言內容"
    match = line.match(/^([^｜|]+)[｜|]\s*(.+)$/);
    if (match) return { id: `${i}-${Date.now()}`, name: match[1].trim(), comment: match[2].trim(), status: 'pending' as const };

    // Format 3: auto-detect (first word is name, rest is comment)
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

// ─── Storage Keys ────────────────────────────────────────────────────────────
const STORAGE_COMMENTS = 'social_reply_comments';
const STORAGE_KEYWORDS = 'social_reply_keywords';
const STORAGE_PENDING = 'social_reply_pending';

export default function DashboardPage() {
  const router = useRouter();
  const [pasteInput, setPasteInput] = useState('');
  const [comments, setComments] = useState<ParsedComment[]>([]);
  const [keywordRules, setKeywordRules] = useState<KeywordRule[]>([]);
  const [pendingReplies, setPendingReplies] = useState<{name: string; comment: string; reply: string}[]>([]);

  // Auth check
  useEffect(() => {
    if (sessionStorage.getItem('social_reply_logged_in') !== 'true') {
      router.push('/');
    }
  }, [router]);

  // Load from localStorage
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

    // Auto-add matched to pending
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">留言回覆</h1>
          <p className="text-gray-500 text-sm mt-1">粘貼論壇或粉絲頁留言名單，系統自動對應關鍵字回覆</p>
        </div>
        <div className="flex gap-2">
          {pendingCount > 0 && (
            <button
              onClick={() => router.push('/review')}
              className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-4 py-2 rounded-xl text-sm flex items-center gap-2"
            >
              待審核
              <span className="bg-white text-amber-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                {pendingCount}
              </span>
            </button>
          )}
          <button
            onClick={() => router.push('/keywords')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-xl text-sm"
          >
            關鍵字設定
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Paste Area */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="font-bold text-gray-800 mb-4">粘貼留言名單</h2>
          <textarea
            value={pasteInput}
            onChange={(e) => setPasteInput(e.target.value)}
            placeholder="粘貼論壇/粉絲頁留言名單到此處&#10;&#10;支援格式：&#10;王小明：我想報名這個活動&#10;李小美｜想要了解更多詳情&#10;張阿強    留個言支持一下"
            className="w-full h-52 px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <div className="flex gap-3 mt-4">
            <button
              onClick={handlePasteAndParse}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
            >
              解析並新增留言
            </button>
            <button
              onClick={handleAppendPaste}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl transition-colors text-sm"
            >
              追加留言
            </button>
            <button
              onClick={handleClearAll}
              className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-xl transition-colors text-sm"
            >
              清除全部
            </button>
          </div>
          <div className="mt-4 p-3 bg-gray-50 rounded-xl text-xs text-gray-500">
            <p className="font-semibold text-gray-600 mb-1">支援格式：</p>
            <p>• 名字：留言內容（冒號分隔）</p>
            <p>• 名字｜留言內容（豎線分隔）</p>
            <p>• 名字　　留言內容（tab/多空白分隔）</p>
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="font-bold text-gray-800 mb-4">統計</h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: '總留言數', value: comments.length, color: 'text-indigo-600' },
                { label: '待回覆', value: comments.filter(c => !c.replyContent).length, color: 'text-amber-600' },
                { label: '已有回覆', value: comments.filter(c => c.replyContent).length, color: 'text-emerald-600' },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="font-bold text-gray-800 mb-4">待審核回覆</h2>
            {pendingReplies.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">目前沒有待審核的回覆</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-auto">
                {pendingReplies.slice(-5).reverse().map((p, i) => (
                  <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <div className="text-xs font-bold text-amber-700">{p.name}</div>
                    <div className="text-sm text-gray-600 mt-1 line-clamp-1">{p.comment}</div>
                    <div className="text-sm font-semibold text-indigo-600 mt-1">→ {p.reply}</div>
                  </div>
                ))}
              </div>
            )}
            {pendingReplies.length > 0 && (
              <button
                onClick={() => router.push('/review')}
                className="mt-3 w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2 rounded-xl text-sm"
              >
                查看全部 {pendingReplies.length} 筆待審核
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Comments List */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">留言列表</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {comments.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400 text-sm">
              尚無留言，請在上方粘貼留言名單
            </div>
          ) : (
            comments.slice().reverse().map((c) => (
              <div key={c.id} className="px-6 py-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{c.name}</span>
                    {c.replyContent && (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full font-medium">
                        已對應
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                    {c.comment || <span className="italic">（無留言內容）</span>}
                  </div>
                  {c.matchedKeyword && (
                    <div className="text-xs text-indigo-500 mt-1">
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
