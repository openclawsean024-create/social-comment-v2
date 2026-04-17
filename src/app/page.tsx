'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const CORRECT_PASSWORD = 'admin123';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === CORRECT_PASSWORD) {
      sessionStorage.setItem('social_reply_logged_in', 'true');
      router.push('/dashboard');
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(135deg, #0F0F23 0%, #1A1A2E 50%, #0F0F23 100%)' }}>
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #6366F1, transparent)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #8B5CF6, transparent)' }} />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-10">
          <div className="w-20 h-20 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', boxShadow: '0 0 40px rgba(99,102,241,0.4)' }}>
            <span className="text-white text-3xl font-extrabold tracking-widest">SR</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-100 tracking-tight">社群留言自動回覆系統</h1>
          <p className="text-sm mt-3" style={{ color: '#64748B' }}>輸入管理員密碼登入系統</p>
        </div>

        <form onSubmit={handleLogin} className="rounded-2xl p-8" style={{ background: '#1A1A2E', border: '1px solid #2A2A4A', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
          <div className="mb-5">
            <label className="block text-sm font-semibold mb-2" style={{ color: '#94A3B8' }}>密碼</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="請輸入密碼"
              className={`w-full px-4 py-3.5 rounded-xl text-base tracking-widest transition-all outline-none`}
              style={{
                background: '#252542',
                border: error ? '1px solid #EF4444' : '1px solid #2A2A4A',
                color: '#F8FAFC',
                boxShadow: error ? '0 0 0 3px rgba(239,68,68,0.15)' : 'none',
              }}
              autoFocus
            />
            {error && (
              <p className="mt-2 text-sm font-medium" style={{ color: '#F87171' }}>密碼錯誤，請重新輸入</p>
            )}
          </div>
          <button
            type="submit"
            className="w-full font-bold py-3.5 px-6 rounded-xl text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', boxShadow: '0 4px 20px rgba(99,102,241,0.3)' }}
            onMouseEnter={e => { (e.target as HTMLElement).style.transform = 'translateY(-1px)'; (e.target as HTMLElement).style.boxShadow = '0 8px 30px rgba(99,102,241,0.4)'; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.transform = 'translateY(0)'; (e.target as HTMLElement).style.boxShadow = '0 4px 20px rgba(99,102,241,0.3)'; }}
          >
            登入系統
          </button>
          <p className="mt-5 text-center text-xs" style={{ color: '#334155' }}>MVP 版本｜密碼為 admin123</p>
        </form>
      </div>
    </div>
  );
}
