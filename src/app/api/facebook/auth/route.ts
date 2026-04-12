import { NextResponse } from 'next/server';

const FB_APP_ID = process.env.FB_APP_ID || '1234567890123456';
const REDIRECT_URI = `${process.env.APP_URL || 'https://social-comment-v2.vercel.app'}/api/facebook/callback`;

export async function GET() {
  const scope = 'pages_read_engagement,user_posts';
  const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${FB_APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${scope}&response_type=code`;
  
  return NextResponse.redirect(authUrl);
}
