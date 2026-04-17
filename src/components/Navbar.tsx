'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/dashboard', label: '留言回覆' },
  { href: '/keywords', label: '關鍵字設定' },
  { href: '/review', label: '待審核' },
  { href: '/history', label: '回覆歷史' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(sessionStorage.getItem('social_reply_logged_in') === 'true');
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem('social_reply_logged_in');
    window.location.href = '/';
  };

  if (!isLoggedIn) return null;

  return (
    <header style={{ background: '#1A1A2E', borderBottom: '1px solid #2A2A4A' }} className="sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
            <span className="text-white text-sm font-bold">SR</span>
          </div>
          <span className="font-bold text-gray-100">社群回覆系統</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="系統運行中" />
        </div>
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: pathname === item.href ? 'rgba(99,102,241,0.15)' : 'transparent',
                color: pathname === item.href ? '#818CF8' : '#94A3B8',
              }}
              onMouseEnter={e => {
                if (pathname !== item.href) {
                  (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                  (e.target as HTMLElement).style.color = '#E2E8F0';
                }
              }}
              onMouseLeave={e => {
                if (pathname !== item.href) {
                  (e.target as HTMLElement).style.background = 'transparent';
                  (e.target as HTMLElement).style.color = '#94A3B8';
                }
              }}
            >
              {item.label}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="ml-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ color: '#64748B' }}
            onMouseEnter={e => { (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.target as HTMLElement).style.color = '#94A3B8'; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent'; (e.target as HTMLElement).style.color = '#64748B'; }}
          >
            登出
          </button>
        </nav>
      </div>
    </header>
  );
}
