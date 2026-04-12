import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const { comment, template } = await req.json();

    if (!comment?.trim()) {
      return NextResponse.json({ error: '請提供留言內容' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY 未設定' }, { status: 500 });
    }

    const templates: Record<string, string> = {
      default: '你是一個熱情的品牌小編。請根據粉絲的留言，回覆一段自然、友善的內容（50字以內）。',
      friendly: '你是一個親切的客服。請用輕鬆、口語化的方式回覆粉絲（40字以內）。',
      promo: '你是品牌小編。請在回覆中自然帶入品牌資訊，吸引粉絲互動（60字以內）。',
    };

    const systemPrompt = templates[template || 'default'] || templates.default;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `粉絲留言：「${comment}」\n請回覆：` },
        ],
        max_tokens: 100,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: `OpenAI API error: ${err}` }, { status: response.status });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || '（回覆生成失敗）';

    return NextResponse.json({ reply });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
