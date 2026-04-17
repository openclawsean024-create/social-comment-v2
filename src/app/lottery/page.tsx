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

  const cardStyle = { background: '#1A1A2E', border: '1px solid #2A2A4A' };
  const inputStyle = { background: '#252542', border: '1px solid #2A2A4A', color: '#F8FAFC' };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl border" style={{
          background: error.type === 'manual' ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)',
          borderColor: error.type === 'manual' ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'
        }}>
          <div className="flex items-start gap-3">
            <span className="text-lg">{error.type === 'manual' ? '⚠️' : '❌'}</span>
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: error.type === 'manual' ? '#FBBF24' : '#F87171' }}>{error.message}</p>
              {error.type !== 'manual' && (
                <button
                  onClick={() => { setManualMode(true); setError({ type: 'manual', message: '已切換至手動粘貼模式' }); }}
                  className="mt-2 text-sm font-medium transition-all"
                  style={{ color: '#818CF8' }}
                  onMouseEnter={e => (e.target as HTMLElement).style.textDecoration = 'underline'}
                  onMouseLeave={e => (e.target as HTMLElement).style.textDecoration = 'none'}
                >
                  切換至手動粘貼模式 →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 rounded-2xl p-2" style={{ background: '#1A1A2E', border: '1px solid #2A2A4A' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: activeTab === t.id ? '#6366F1' : 'transparent',
              color: activeTab === t.id ? 'white' : '#64748B',
              boxShadow: activeTab === t.id ? '0 4px 15px rgba(99,102,241,0.3)' : 'none'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Import */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          <div className="rounded-2xl p-6" style={cardStyle}>
            <h2 className="font-bold mb-4" style={{ color: '#E2E8F0' }}>Facebook 授權</h2>
            {!fbAccessToken && !manualMode ? (
              <button
                onClick={handleFbLogin}
                className="w-full font-bold py-3 px-6 rounded-xl text-white transition-all flex items-center justify-center gap-3"
                style={{ background: '#1877F2', boxShadow: '0 4px 15px rgba(24,119,242,0.3)' }}
                onMouseEnter={e => (e.target as HTMLElement).style.background = '#166FE5'}
                onMouseLeave={e => (e.target as HTMLElement).style.background = '#1877F2'}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                使用 Facebook 登入
              </button>
            ) : fbAccessToken ? (
              <div className="flex items-center gap-3 text-sm font-medium" style={{ color: '#34D399' }}>
                <span className="text-lg">✅</span>
                <span>已登入 Facebook</span>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl p-6" style={cardStyle}>
            <h2 className="font-bold mb-4" style={{ color: '#E2E8F0' }}>貼文網址</h2>
            <input
              type="text"
              value={postUrl}
              onChange={e => setPostUrl(e.target.value)}
              placeholder="請粘貼 Facebook 貼文網址，例如：https://www.facebook.com/xxxx/posts/xxxxx"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={inputStyle}
              onFocus={e => (e.target as HTMLElement).style.borderColor = '#6366F1'}
              onBlur={e => (e.target as HTMLElement).style.borderColor = '#2A2A4A'}
            />

            {fetchProgress && (
              <div className="mt-4">
                <div className="flex justify-between text-xs mb-1" style={{ color: '#64748B' }}>
                  <span>抓取留言中...</span>
                  <span>{fetchProgress.current} 筆</span>
                </div>
                <div className="w-full rounded-full h-2" style={{ background: '#252542' }}>
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{ background: '#6366F1', width: `${fetchProgress.total > 0 ? (fetchProgress.current / fetchProgress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={handleFetchPost}
                disabled={!postUrl.trim() || isFetching || !fbAccessToken}
                className="flex-1 font-semibold py-3 px-6 rounded-xl text-sm text-white transition-all"
                style={{ background: !postUrl.trim() || isFetching || !fbAccessToken ? '#334155' : '#6366F1' }}
                onMouseEnter={e => { if (!(!postUrl.trim() || isFetching || !fbAccessToken)) (e.target as HTMLElement).style.background = '#5558E3'; }}
                onMouseLeave={e => { if (!(!postUrl.trim() || isFetching || !fbAccessToken)) (e.target as HTMLElement).style.background = '#6366F1'; }}
              >
                {isFetching ? '抓取中...' : '抓取留言'}
              </button>
              <button
                onClick={() => { setManualMode(true); setError({ type: 'manual', message: '已切換至手動粘貼模式' }); }}
                className="px-4 py-3 font-semibold rounded-xl text-sm transition-all"
                style={{ background: '#252542', color: '#94A3B8', border: '1px solid #2A2A4A' }}
                onMouseEnter={e => { (e.target as HTMLElement).style.background = '#2A2A4A'; (e.target as HTMLElement).style.color = '#E2E8F0'; }}
                onMouseLeave={e => { (e.target as HTMLElement).style.background = '#252542'; (e.target as HTMLElement).style.color = '#94A3B8'; }}
              >
                手動粘貼
              </button>
            </div>
          </div>

          {manualMode && (
            <div className="rounded-2xl p-6" style={{ ...cardStyle, borderColor: 'rgba(245,158,11,0.2)' }}>
              <h2 className="font-bold mb-4" style={{ color: '#E2E8F0' }}>手動粘貼模式</h2>
              <textarea
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                placeholder="粘貼留言名單到此處（每行一筆）&#10;&#10;格式：名字：留言內容"
                className="w-full h-40 px-4 py-3 rounded-xl text-sm resize-none outline-none"
                style={inputStyle}
                onFocus={e => (e.target as HTMLElement).style.borderColor = '#F59E0B'}
                onBlur={e => (e.target as HTMLElement).style.borderColor = '#2A2A4A'}
              />
              <button
                onClick={handleManualParse}
                disabled={!manualInput.trim()}
                className="mt-3 w-full font-semibold py-3 px-6 rounded-xl text-sm text-white transition-all"
                style={{ background: !manualInput.trim() ? '#334155' : '#F59E0B' }}
                onMouseEnter={e => { if (manualInput.trim()) (e.target as HTMLElement).style.background = '#D97706'; }}
                onMouseLeave={e => { if (manualInput.trim()) (e.target as HTMLElement).style.background = '#F59E0B'; }}
              >
                解析留言
              </button>
            </div>
          )}

          {comments.length > 0 && (
            <div className="rounded-2xl p-6" style={cardStyle}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold" style={{ color: '#E2E8F0' }}>已抓取留言預覽</h2>
                <span className="text-sm font-semibold" style={{ color: '#6366F1' }}>{comments.length} 筆</span>
              </div>
              <div className="space-y-3 max-h-64 overflow-auto">
                {comments.slice(0, 10).map(c => (
                  <div key={c.id} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: '#252542' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: 'rgba(99,102,241,0.2)', color: '#818CF8' }}>
                      {c.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm" style={{ color: '#E2E8F0' }}>{c.name}</p>
                      <p className="text-xs mt-0.5 line-clamp-1" style={{ color: '#64748B' }}>{c.comment || '（無留言內容）'}</p>
                    </div>
                  </div>
                ))}
                {comments.length > 10 && (
                  <p className="text-xs text-center" style={{ color: '#334155' }}>...還有 {comments.length - 10} 筆留言</p>
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
            <div className="rounded-2xl p-6" style={cardStyle}>
              <h2 className="font-bold mb-3" style={{ color: '#E2E8F0' }}>抽獎貼文</h2>
              <div className="p-4 rounded-xl" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}>
                <p className="font-bold text-lg leading-snug" style={{ color: '#A5B4FC' }}>{postInfo.from.name}</p>
                <p className="text-sm mt-2 line-clamp-2" style={{ color: '#818CF8' }}>{postInfo.message || '（無內文）'}</p>
                <div className="flex gap-4 mt-3 text-xs" style={{ color: '#64748B' }}>
                  <span>👍 {postInfo.reactions} 次讚</span>
                  <span>💬 {comments.length} 則留言</span>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl p-6 space-y-5" style={cardStyle}>
            <h2 className="font-bold" style={{ color: '#E2E8F0' }}>抽獎設定</h2>

            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: '#94A3B8' }}>抽出人數</label>
              <input
                type="number"
                min={1}
                max={comments.length || 999}
                value={filters.winnerCount}
                onChange={e => setFilters(f => ({ ...f, winnerCount: Math.max(1, parseInt(e.target.value) || 1) }))}
                className="w-32 px-4 py-2.5 rounded-xl text-sm outline-none"
                style={inputStyle}
                onFocus={e => (e.target as HTMLElement).style.borderColor = '#6366F1'}
                onBlur={e => (e.target as HTMLElement).style.borderColor = '#2A2A4A'}
              />
              <span className="ml-3 text-sm" style={{ color: '#64748B' }}>人</span>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: '#94A3B8' }}>去重模式</label>
              <div className="flex gap-3">
                {[
                  { value: 'name', label: '依名字去重' },
                  { value: 'all', label: '完全相同去重' },
                  { value: 'off', label: '不去重' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFilters(f => ({ ...f, dedupeMode: opt.value as any }))}
                    className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                    style={{
                      background: filters.dedupeMode === opt.value ? '#6366F1' : '#252542',
                      color: filters.dedupeMode === opt.value ? 'white' : '#94A3B8',
                      border: `1px solid ${filters.dedupeMode === opt.value ? '#6366F1' : '#2A2A4A'}`
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {['keywordFilter', 'requiredKeywords', 'blacklist'].map(field => (
              <div key={field}>
                <label className="block text-sm font-semibold mb-2" style={{ color: '#94A3B8' }}>
                  {field === 'keywordFilter' ? '關鍵字排除（每行一個）' :
                   field === 'requiredKeywords' ? '必須包含關鍵字（每行一個）' : '黑名單（每行一個）'}
                </label>
                <textarea
                  value={filters[field as keyof FilterConfig] as string}
                  onChange={e => setFilters(f => ({ ...f, [field]: e.target.value }))}
                  className="w-full h-20 px-4 py-2.5 rounded-xl text-sm resize-none outline-none"
                  style={inputStyle}
                  onFocus={e => (e.target as HTMLElement).style.borderColor = '#6366F1'}
                  onBlur={e => (e.target as HTMLElement).style.borderColor = '#2A2A4A'}
                />
              </div>
            ))}

            <div className="pt-2">
              <button
                onClick={handleDraw}
                disabled={comments.length === 0}
                className="w-full font-bold py-3 px-6 rounded-xl text-white transition-all"
                style={{
                  background: comments.length === 0 ? '#334155' : 'linear-gradient(135deg, #F59E0B, #EF4444)',
                  boxShadow: comments.length === 0 ? 'none' : '0 4px 20px rgba(245,158,11,0.3)'
                }}
                onMouseEnter={e => { if (comments.length > 0) (e.target as HTMLElement).style.opacity = '0.9'; }}
                onMouseLeave={e => { if (comments.length > 0) (e.target as HTMLElement).style.opacity = '1'; }}
              >
                🎲 開始抽獎（共 {comments.length} 筆留言）
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Result */}
      {activeTab === 'result' && (
        <div className="space-y-6 animate-fade-in">
          <div className="rounded-2xl p-6" style={cardStyle}>
            <h2 className="font-bold mb-1 text-center" style={{ color: '#E2E8F0' }}>🎉 中獎名單</h2>
            <p className="text-xs text-center mb-6" style={{ color: '#334155' }}>共抽出 {winners.length} 位幸運兒</p>

            {winners.length === 0 ? (
              <p className="text-center py-8" style={{ color: '#334155' }}>尚無抽獎結果</p>
            ) : (
              <div className="space-y-4">
                {winners.map((w, i) => (
                  <div key={i} className="relative p-5 rounded-2xl border-2" style={{
                    background: i === 0 ? 'rgba(245,158,11,0.06)' : i === 1 ? 'rgba(148,163,184,0.05)' : i === 2 ? 'rgba(249,115,22,0.06)' : 'rgba(100,116,139,0.04)',
                    borderColor: i === 0 ? 'rgba(245,158,11,0.3)' : i === 1 ? 'rgba(148,163,184,0.3)' : i === 2 ? 'rgba(249,115,22,0.3)' : 'rgba(100,116,139,0.15)'
                  }}>
                    {(i === 0 || i === 1 || i === 2) && (
                      <div className="absolute -top-3 left-4 px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{ background: i === 0 ? '#F59E0B' : i === 1 ? '#94A3B8' : '#249,115,22', color: 'white' }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                      </div>
                    )}
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
                        style={{
                          background: i === 0 ? 'rgba(245,158,11,0.15)' : i === 1 ? 'rgba(148,163,184,0.15)' : i === 2 ? 'rgba(249,115,22,0.15)' : 'rgba(99,102,241,0.1)',
                          color: i === 0 ? '#FBBF24' : i === 1 ? '#94A3B8' : i === 2 ? '#FB923C' : '#818CF8'
                        }}>
                        {w.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-lg" style={{ color: '#F1F5F9' }}>{w.name}</p>
                        <p className="text-sm mt-0.5 line-clamp-2" style={{ color: '#64748B' }}>{w.comment || '（無留言內容）'}</p>
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
                className="flex-1 font-semibold py-3 px-6 rounded-xl text-sm text-white transition-all"
                style={{ background: '#6366F1' }}
                onMouseEnter={e => (e.target as HTMLElement).style.background = '#5558E3'}
                onMouseLeave={e => (e.target as HTMLElement).style.background = '#6366F1'}
              >
                {copySuccess ? '✅ 已複製' : '📋 複製結果'}
              </button>
              <button
                onClick={handleShare}
                className="flex-1 font-semibold py-3 px-6 rounded-xl text-sm transition-all"
                style={{ background: '#252542', color: '#94A3B8', border: '1px solid #2A2A4A' }}
                onMouseEnter={e => { (e.target as HTMLElement).style.background = '#2A2A4A'; (e.target as HTMLElement).style.color = '#E2E8F0'; }}
                onMouseLeave={e => { (e.target as HTMLElement).style.background = '#252542'; (e.target as HTMLElement).style.color = '#94A3B8'; }}
              >
                🔗 分享
              </button>
            </div>
          )}

          <button
            onClick={() => setActiveTab('filter')}
            className="w-full font-semibold py-3 px-6 rounded-xl transition-all"
            style={{ background: '#1A1A2E', color: '#64748B', border: '1px solid #2A2A4A' }}
            onMouseEnter={e => { (e.target as HTMLElement).style.background = '#252542'; (e.target as HTMLElement).style.color = '#94A3B8'; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.background = '#1A1A2E'; (e.target as HTMLElement).style.color = '#64748B'; }}
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
      <div className="h-12 rounded-2xl animate-pulse" style={{ background: '#1A1A2E' }} />
      <div className="h-64 rounded-2xl animate-pulse" style={{ background: '#1A1A2E' }} />
    </div>
  );
}

export default function LotteryPage() {
  return (
    <div className="min-h-screen" style={{ background: '#0F0F23' }}>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #F59E0B, #EF4444)', boxShadow: '0 8px 30px rgba(245,158,11,0.3)' }}>
            <span className="text-2xl">🎰</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-100 tracking-tight">Facebook 留言抽獎工具</h1>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>從粉絲頁貼文留言中透明抽獎</p>
        </div>

        <Suspense fallback={<LotteryLoading />}>
          <LotteryInner />
        </Suspense>
      </div>
    </div>
  );
}
