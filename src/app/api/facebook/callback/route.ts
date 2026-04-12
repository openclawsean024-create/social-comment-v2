import { NextRequest, NextResponse } from 'next/server';

const FB_APP_ID = process.env.FB_APP_ID || '1234567890123456';
const FB_APP_SECRET = process.env.FB_APP_SECRET || 'YOUR_APP_SECRET';
const REDIRECT_URI = `${process.env.APP_URL || 'https://social-comment-v2.vercel.app'}/api/facebook/callback`;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL(`/lottery?error=${error}`, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/lottery?error=no_code', request.url));
  }

  try {
    // Exchange code for access token
    const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${FB_APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&client_secret=${FB_APP_SECRET}&code=${code}`;
    
    const tokenResponse = await fetch(tokenUrl);
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return NextResponse.redirect(new URL(`/lottery?error=token_exchange_failed`, request.url));
    }

    const accessToken = tokenData.access_token;
    return NextResponse.redirect(new URL(`/lottery?step=2&token=${accessToken}`, request.url));
  } catch (err) {
    return NextResponse.redirect(new URL('/lottery?error=auth_failed', request.url));
  }
}
