export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key chưa được cấu hình' });

  try {
    const { messages, system, model = 'gemini-2.0-flash' } = req.body;

    // Chuyển messages sang format Gemini
    const contents = [];

    // Thêm system prompt vào tin nhắn đầu tiên của user
    const systemText = system ? `[HƯỚNG DẪN HỆ THỐNG]\n${system}\n[KẾT THÚC HƯỚNG DẪN]\n\n` : '';

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const role = msg.role === 'assistant' ? 'model' : 'user';
      let text = msg.content;

      // Gắn system vào tin nhắn user đầu tiên
      if (i === 0 && msg.role === 'user' && systemText) {
        text = systemText + text;
      }

      contents.push({ role, parts: [{ text }] });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.7,
        },
      }),
    });

    const data = await response.json();

    if (data.error) {
      return res.status(400).json({ error: data.error.message });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.status(200).json({ text });

  } catch (err) {
    return res.status(500).json({ error: 'Lỗi server: ' + err.message });
  }
}
