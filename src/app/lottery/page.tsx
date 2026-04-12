'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

interface ParsedComment {
  id: string;
  name: string;
  comment: string;
  avatar?: string;
}

interface PostInfo {
  postId: string;
  message: string;
  from: { name: string; id: string };
  reactions: number;
}

interface FilterConfig {
  winnerCount: number;
  blacklist: string;
  dedupeMode: 'all' | 'name' | 'off';
  keywordFilter: string;
  requiredKeywords: string;
}

interface Winner {
  name: string;
  comment: string;
  avatar?: string;
  prize: string;
}

type TabType = 'import' | 'filter' | 'result';
type ErrorType = { type: string; message: string };

function runLottery(comments: ParsedComment[], filters: FilterConfig): Winner[] {
  let pool = [...comments];

  if (filters.dedupeMode === 'all') {
    const seen = new Set<string>();
    pool = pool.filter(c => {
      const key = `${c.name}|${c.comment}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } else if (filters.dedupeMode === 'name') {
    const seen = new Set<string>();
    pool = pool.filter(c => {
      if (seen.has(c.name)) return false;
      seen.add(c.name);
      return true;
    });
  }

  if (filters.keywordFilter.trim()) {
    const kws = filters.keywordFilter.toLowerCase().split(/[\n,]/).map(k => k.trim()).filter(Boolean);
    pool = pool.filter(c => {
      const text = `${c.name} ${c.comment}`.toLowerCase();
      return !kws.some(kw => text.includes(kw));
    });
  }

  if (filters.requiredKeywords.trim()) {
    const required = filters.requiredKeywords.toLowerCase().split(/[\n,]/).map(k => k.trim()).filter(Boolean);
    pool = pool.filter(c => {
      const text = `${c.name} ${c.comment}`.toLowerCase();
      return required.every(kw => text.includes(kw));
    });
  }

  if (filters.blacklist.trim()) {
    const blocked = new Set(filters.blacklist.split(/[\n,]/).map(n => n.trim().toLowerCase()).filter(Boolean));
    pool = pool.filter(c => !blocked.has(c.name.toLowerCase()));
  }

  const shuffled = pool.sort(() => Math.random() - 0.5);
  const count = Math.min(filters.winnerCount, shuffled.length);
  const winners = shuffled.slice(0, count);

  return winners.map((w, i) => ({
    name: w.name,
    comment: w.comment,
    avatar: w.avatar,
    prize: `獎品 ${i + 1}`,
  }));
}

function LotteryInner() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>('import');
  const [fbAccessToken, setFbAccessToken] = useState<string | null>(null);
  const [postUrl, setPostUrl] = useState('');
  const [postInfo, setPostInfo] = useState<PostInfo | null>(null);
  const [comments, setComments] = useState<ParsedComment[]>([]);
  const [fetchProgress, setFetchProgress] = useState<{ current: number; total: number } | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [error, setError] = useState<ErrorType | null>(null);
  const [filters, setFilters] = useState<FilterConfig>({
    winnerCount: 3,
    blacklist: '',
    dedupeMode: 'name',
    keywordFilter: '',
    requiredKeywords: '',
  });
  const [winners, setWinners] = useState<Winner[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);

  // Handle OAuth callback
  useEffect(() => {
    const token = searchParams.get('token');
    const step = searchParams.get('step');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      const errorMessages: Record<string, string> = {
        access_denied: '您拒絕了授權，請重新嘗試',
        token_exchange_failed: 'Token 交換失敗，請確認 App 設定正確',
        auth_failed: '授權失敗，請重新嘗試',
      };
      setError({ type: 'auth', message: errorMessages[errorParam] || '授權失敗' });
      return;
    }

    if (token && step === '2') {
      setFbAccessToken(token);
    }
  }, [searchParams]);

  const handleFbLogin = () => {
    window.location.href = '/api/facebook/auth';
  };

  const fetchCommentsRecursive = useCallback(async (
    postId: string,
    token: string,
    cursor?: string,
    accumulated: ParsedComment[] = []
  ): Promise<ParsedComment[]> => {
    const response = await fetch('/api/facebook/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, accessToken: token, cursor }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw { type: data.type || 'auth', message: data.error || '抓取失敗' };
    }

    const newComments = [...accumulated, ...data.comments];
    setFetchProgress({ current: newComments.length, total: data.total || newComments.length });

    if (data.hasMore && data.nextCursor) {
      await new Promise(r => setTimeout(r, 100));
      return fetchCommentsRecursive(postId, token, data.nextCursor, newComments);
    }

    return newComments;
  }, []);

  const handleFetchPost = async () => {
    if (!postUrl.trim()) return;
    setError(null);
    setIsFetching(true);
    setFetchProgress({ current: 0, total: 0 });

    const token = fbAccessToken || '';

    try {
      const postRes = await fetch('/api/facebook/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postUrl, accessToken: token }),
      });
      const postData = await postRes.json();

      if (!postRes.ok) {
        throw { type: postData.type || 'auth', message: postData.error || '解析貼文失敗' };
      }

      setPostInfo(postData);
      const allComments = await fetchCommentsRecursive(postData.postId, token);
      setComments(allComments);
      setFetchProgress(null);
      setActiveTab('filter');
    } catch (err: any) {
      setError({ type: err.type || 'auth', message: err.message });
      setFetchProgress(null);
    } finally {
      setIsFetching(false);
    }
  };

  const handleManualParse = () => {
    if (!manualInput.trim()) return;
    const lines = manualInput.split(/\r?\n/).filter(Boolean);
    const parsed: ParsedComment[] = lines.map((line, i) => {
      const match = line.match(/^([^：:]+)[：:]\s*(.+)$/);
      if (match) return { id: `${i}-${Date.now()}`, name: match[1].trim(), comment: match[2].trim() };
      const parts = line.split(/\t/).filter(Boolean);
      if (parts.length >= 2) return { id: `${i}-${Date.now()}`, name: parts[0].trim(), comment: parts.slice(1).join(' ').trim() };
      return { id: `${i}-${Date.now()}`, name: parts[0] || line, comment: '' };
    });
    setComments(parsed);
    setError(null);
    setActiveTab('filter');
  };

  const handleDraw = () => {
    const result = runLottery(comments, filters);
    setWinners(result);
    setActiveTab('result');
  };

  const handleCopyResults = () => {
    const text = winners.map((w, i) => `${i + 1}. ${w.name}（${w.comment || '無留言'}）`).join('\n');
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleShare = () => {
    const text = winners.map((w, i) => `${i + 1}. ${w.name}`).join('\n');
    const msg = `🎉 抽獎結果出爐！\n${text}`;
    if (navigator.share) {
      navigator.share({ text: msg });
    } else {
      navigator.clipboard.writeText(msg);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const tabs = [
    { id: 'import' as const, label: '📥 匯入留言' },
    { id: 'filter' as const, label: '🎯 設定條件' },
    { id: 'result' as const, label: '🎉 開獎結果' },
  ];

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {error && (
        <div className={`p-4 rounded-2xl border ${error.type === 'manual' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-start gap-3">
            <span className="text-lg">{error.type === 'manual' ? '⚠️' : '❌'}</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800">{error.message}</p>
              {error.type !== 'manual' && (
                <button
                  onClick={() => { setManualMode(true); setError({ type: 'manual', message: '已切換至手動粘貼模式' }); }}
                  className="mt-2 text-sm text-indigo-600 font-medium hover:underline"
                >
                  切換至手動粘貼模式 →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 bg-white rounded-2xl p-2 shadow-sm border border-gray-100">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all ${
              activeTab === t.id
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Import */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="font-bold text-gray-800 mb-4">Facebook 授權</h2>
            {!fbAccessToken && !manualMode ? (
              <button
                onClick={handleFbLogin}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-colors shadow-md flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                使用 Facebook 登入
              </button>
            ) : fbAccessToken ? (
              <div className="flex items-center gap-3 text-sm text-emerald-600">
                <span className="text-lg">✅</span>
                <span className="font-medium">已登入 Facebook</span>
              </div>
            ) : null}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="font-bold text-gray-800 mb-4">貼文網址</h2>
            <input
              type="text"
              value={postUrl}
              onChange={e => setPostUrl(e.target.value)}
              placeholder="請粘貼 Facebook 貼文網址，例如：https://www.facebook.com/xxxx/posts/xxxxx"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            {fetchProgress && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>抓取留言中...</span>
                  <span>{fetchProgress.current} 筆</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-indigo-500 h-2 rounded-full transition-all"
                    style={{ width: `${fetchProgress.total > 0 ? (fetchProgress.current / fetchProgress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={handleFetchPost}
                disabled={!postUrl.trim() || isFetching || !fbAccessToken}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-colors text-sm"
              >
                {isFetching ? '抓取中...' : '抓取留言'}
              </button>
              <button
                onClick={() => { setManualMode(true); setError({ type: 'manual', message: '已切換至手動粘貼模式' }); }}
                className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors text-sm"
              >
                手動粘貼
              </button>
            </div>
          </div>

          {manualMode && (
            <div className="bg-white rounded-2xl border border-amber-200 p-6 shadow-sm">
              <h2 className="font-bold text-gray-800 mb-4">手動粘貼模式</h2>
              <textarea
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                placeholder="粘貼留言名單到此處（每行一筆）&#10;&#10;格式：名字：留言內容"
                className="w-full h-40 px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleManualParse}
                disabled={!manualInput.trim()}
                className="mt-3 w-full bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white font-semibold py-3 px-6 rounded-xl transition-colors text-sm"
              >
                解析留言
              </button>
            </div>
          )}

          {comments.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-800">已抓取留言預覽</h2>
                <span className="text-sm text-indigo-600 font-semibold">{comments.length} 筆</span>
              </div>
              <div className="space-y-3 max-h-64 overflow-auto">
                {comments.slice(0, 10).map(c => (
                  <div key={c.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-sm font-bold text-indigo-600">
                      {c.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{c.comment || '（無留言內容）'}</p>
                    </div>
                  </div>
                ))}
                {comments.length > 10 && (
                  <p className="text-xs text-gray-400 text-center">...還有 {comments.length - 10} 筆留言</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Filter */}
      {activeTab === 'filter' && (
        <div className="space-y-6">
          {postInfo && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h2 className="font-bold text-gray-800 mb-3">抽獎貼文</h2>
              <div className="p-4 bg-indigo-50 rounded-xl">
                <p className="font-bold text-indigo-900 text-lg leading-snug">{postInfo.from.name}</p>
                <p className="text-sm text-indigo-700 mt-2 line-clamp-2">{postInfo.message || '（無內文）'}</p>
                <div className="flex gap-4 mt-3 text-xs text-indigo-500">
                  <span>👍 {postInfo.reactions} 次讚</span>
                  <span>💬 {comments.length} 則留言</span>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
            <h2 className="font-bold text-gray-800">抽獎設定</h2>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">抽出人數</label>
              <input
                type="number"
                min={1}
                max={comments.length || 999}
                value={filters.winnerCount}
                onChange={e => setFilters(f => ({ ...f, winnerCount: Math.max(1, parseInt(e.target.value) || 1) }))}
                className="w-32 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="ml-3 text-sm text-gray-500">人</span>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">去重模式</label>
              <div className="flex gap-3">
                {[
                  { value: 'name', label: '依名字去重' },
                  { value: 'all', label: '完全相同去重' },
                  { value: 'off', label: '不去重' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFilters(f => ({ ...f, dedupeMode: opt.value as any }))}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                      filters.dedupeMode === opt.value
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">關鍵字排除（每行一個）</label>
              <textarea
                value={filters.keywordFilter}
                onChange={e => setFilters(f => ({ ...f, keywordFilter: e.target.value }))}
                placeholder="例如：&#10;放棄&#10;不要&#10;取消"
                className="w-full h-20 px-4 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">必須包含關鍵字（每行一個）</label>
              <textarea
                value={filters.requiredKeywords}
                onChange={e => setFilters(f => ({ ...f, requiredKeywords: e.target.value }))}
                placeholder="例如：&#10;報名&#10;参加"
                className="w-full h-20 px-4 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">黑名單（每行一個）</label>
              <textarea
                value={filters.blacklist}
                onChange={e => setFilters(f => ({ ...f, blacklist: e.target.value }))}
                placeholder="例如：&#10;王小明&#10;測試帳號"
                className="w-full h-20 px-4 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="pt-2">
              <button
                onClick={handleDraw}
                disabled={comments.length === 0}
                className="w-full bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 disabled:from-gray-300 disabled:to-gray-300 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md text-sm"
              >
                🎲 開始抽獎（共 {comments.length} 筆留言）
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Result */}
      {activeTab === 'result' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="font-bold text-gray-800 mb-1 text-center">🎉 中獎名單</h2>
            <p className="text-xs text-gray-400 text-center mb-6">共抽出 {winners.length} 位幸運兒</p>

            {winners.length === 0 ? (
              <p className="text-center text-gray-400 py-8">尚無抽獎結果</p>
            ) : (
              <div className="space-y-4">
                {winners.map((w, i) => (
                  <div key={i} className={`relative p-5 rounded-2xl border-2 ${
                    i === 0 ? 'bg-amber-50 border-amber-300' :
                    i === 1 ? 'bg-gray-50 border-gray-300' :
                    i === 2 ? 'bg-orange-50 border-orange-200' :
                    'bg-gray-50 border-gray-200'
                  }`}>
                    {(i === 0 || i === 1 || i === 2) && (
                      <div className={`absolute -top-3 left-4 px-2 py-0.5 rounded-full text-xs font-bold ${
                        i === 0 ? 'bg-amber-400 text-white' :
                        i === 1 ? 'bg-gray-400 text-white' :
                        'bg-orange-400 text-white'
                      }`}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                      </div>
                    )}
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                        i === 0 ? 'bg-amber-200 text-amber-700' :
                        i === 1 ? 'bg-gray-200 text-gray-600' :
                        i === 2 ? 'bg-orange-200 text-orange-700' :
                        'bg-indigo-100 text-indigo-600'
                      }`}>
                        {w.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-lg">{w.name}</p>
                        <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{w.comment || '（無留言內容）'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {winners.length > 0 && (
            <div className="flex gap-3">
              <button
                onClick={handleCopyResults}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors text-sm"
              >
                {copySuccess ? '✅ 已複製' : '📋 複製結果'}
              </button>
              <button
                onClick={handleShare}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-xl transition-colors text-sm"
              >
                🔗 分享
              </button>
            </div>
          )}

          <button
            onClick={() => setActiveTab('filter')}
            className="w-full bg-white hover:bg-gray-50 text-gray-600 font-semibold py-3 px-6 rounded-xl border border-gray-200 transition-colors text-sm"
          >
            ← 重新設定條件
          </button>
        </div>
      )}
    </div>
  );
}

function LotteryLoading() {
  return (
    <div className="space-y-6">
      <div className="h-12 bg-gray-100 rounded-2xl animate-pulse" />
      <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
    </div>
  );
}

export default function LotteryPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white text-2xl">🎰</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Facebook 留言抽獎工具</h1>
          <p className="text-gray-500 text-sm mt-1">從粉絲頁貼文留言中透明抽獎</p>
        </div>

        <Suspense fallback={<LotteryLoading />}>
          <LotteryInner />
        </Suspense>
      </div>
    </div>
  );
}
