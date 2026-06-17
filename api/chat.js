export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY chưa được cấu hình trên Vercel' });
  }

  try {
    const { messages, system } = req.body || {};

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Thiếu messages hợp lệ trong request' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system,
        messages,
      }),
    });

    // Đọc raw text trước — tránh lỗi "Unexpected end of JSON input"
    const rawText = await response.text();

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      // Anthropic trả về thứ không phải JSON (HTML lỗi, rỗng, v.v.)
      return res.status(502).json({
        error: `Anthropic trả về dữ liệu không hợp lệ (status ${response.status}): ${rawText.slice(0, 300)}`
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || `Lỗi Anthropic API (status ${response.status})`
      });
    }

    if (data.error) {
      return res.status(400).json({ error: data.error.message });
    }

    const text = (data.content || [])
      .filter(i => i.type === 'text')
      .map(i => i.text)
      .join('\n');

    return res.status(200).json({ text });

  } catch (err) {
    return res.status(500).json({ error: 'Lỗi server: ' + (err.message || String(err)) });
  }
}
