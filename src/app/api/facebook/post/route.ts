import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { postUrl, accessToken } = await request.json();

    if (!postUrl || !accessToken) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 });
    }

    // Extract post ID from URL
    const urlMatch = postUrl.match(/(?:facebook\.com|fb\.com)\/(?:[\w.]+\/)?(?:permalink|story|groups|pages)\/(\d+)|fb(?:spotlight)?\/(\d+)|(?:profile|page)\.php\?.*id=(\d+)/i);
    let postId = urlMatch ? (urlMatch[1] || urlMatch[2] || urlMatch[3]) : null;

    // Try alternative patterns
    if (!postId) {
      const directMatch = postUrl.match(/(\d{10,})/);
      if (directMatch) postId = directMatch[1];
    }

    if (!postId) {
      return NextResponse.json({ error: '無法解析貼文URL，請確認格式' }, { status: 400 });
    }

    // Fetch post info
    const fields = 'id,message,from{name,id,picture},reactions.summary(true)';
    const apiUrl = `https://graph.facebook.com/v18.0/${postId}?fields=${fields}&access_token=${accessToken}`;

    const response = await fetch(apiUrl);
    const data = await response.json();

    if (response.status === 451) {
      return NextResponse.json({ error: '無權限讀取此貼文，請確認您有管理員權限', type: 'permission' }, { status: 451 });
    }

    if (response.status === 404 || data.error) {
      return NextResponse.json({ error: '找不到該貼文，請確認URL正確', type: 'notfound' }, { status: 404 });
    }

    if (data.error?.code === 'TOKEN_INVALID' || data.error?.type === 'OAuthException') {
      return NextResponse.json({ error: 'Token 已過期，請重新登入', type: 'token' }, { status: 401 });
    }

    return NextResponse.json({
      postId: data.id,
      message: data.message || '',
      from: {
        name: data.from?.name || '未知粉絲頁',
        id: data.from?.id || '',
      },
      reactions: data.reactions?.summary?.total_count || 0,
    });
  } catch (err) {
    return NextResponse.json({ error: '伺服器錯誤，請稍後再試' }, { status: 500 });
  }
}
