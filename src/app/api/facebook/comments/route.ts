import { NextRequest, NextResponse } from 'next/server';

interface FBComment {
  id: string;
  message: string;
  from: { name: string; id: string; picture?: { data: { url: string } } };
  created_time: string;
  parent?: { id: string };
}

export async function POST(request: NextRequest) {
  try {
    const { postId, accessToken, cursor } = await request.json();

    if (!postId || !accessToken) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 });
    }

    const fields = 'id,message,from{name,id,picture{data{url}}},created_time,parent';
    let apiUrl = `https://graph.facebook.com/v18.0/${postId}/comments?fields=${fields}&access_token=${accessToken}&fetch_size=100`;

    if (cursor) {
      apiUrl = cursor;
    }

    const response = await fetch(apiUrl);
    const data = await response.json();

    if (response.status === 451) {
      return NextResponse.json({ error: '無權限讀取此貼文的留言', type: 'permission' }, { status: 451 });
    }

    if (response.status === 404 || data.error?.code === 'GraphMethodException') {
      return NextResponse.json({ error: '找不到該貼文', type: 'notfound' }, { status: 404 });
    }

    if (data.error?.type === 'OAuthException') {
      return NextResponse.json({ error: 'Token 已過期，請重新登入', type: 'token' }, { status: 401 });
    }

    const comments: FBComment[] = data.data || [];
    const nextCursor = data.paging?.next || null;

    return NextResponse.json({
      comments,
      total: data.paging?.summary?.total_count || comments.length,
      nextCursor,
      hasMore: !!nextCursor,
    });
  } catch (err) {
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
