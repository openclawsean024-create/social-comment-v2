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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white text-2xl font-bold">SR</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">社群留言自動回覆系統</h1>
          <p className="text-gray-500 mt-2 text-sm">請輸入管理員密碼登入</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <div className="mb-5">
            <label className="block text-sm font-semibold text-gray-700 mb-2">密碼</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="請輸入密碼"
              className={`w-full px-4 py-3 rounded-xl border text-lg tracking-widest transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                error ? 'border-red-400 bg-red-50 animate-pulse' : 'border-gray-200'
              }`}
              autoFocus
            />
            {error && (
              <p className="mt-2 text-sm text-red-500 font-medium">密碼錯誤，請重新輸入</p>
            )}
          </div>
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition-colors shadow-md"
          >
            登入
          </button>
          <p className="mt-4 text-center text-xs text-gray-400">MVP 版本：密碼為 admin123</p>
        </form>
      </div>
    </div>
  );
}
