// api/admin-codes.js
// Endpoint cho trang quản trị: tạo mã mới, xem danh sách mã
// Dùng service_role key — chỉ chạy ở server, không bao giờ lộ ra frontend

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase chưa được cấu hình trên Vercel' });
  }

  // Xác thực: lấy access token từ header, kiểm tra user có is_admin=true không
  const authHeader = req.headers.authorization || '';
  const userToken = authHeader.replace('Bearer ', '');

  if (!userToken) {
    return res.status(401).json({ error: 'Thiếu token xác thực' });
  }

  try {
    // Kiểm tra user hợp lệ qua token
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${userToken}`,
        apikey: SERVICE_KEY,
      },
    });
    const userData = await userRes.json();
    if (!userData?.id) {
      return res.status(401).json({ error: 'Token không hợp lệ' });
    }

    // Kiểm tra is_admin trong bảng profiles
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userData.id}&select=is_admin`,
      {
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          apikey: SERVICE_KEY,
        },
      }
    );
    const profiles = await profileRes.json();
    if (!profiles?.[0]?.is_admin) {
      return res.status(403).json({ error: 'Bạn không có quyền admin' });
    }

    // ====== GET: lấy danh sách mã ======
    if (req.method === 'GET') {
      const codesRes = await fetch(
        `${SUPABASE_URL}/rest/v1/access_codes?select=*&order=created_at.desc`,
        {
          headers: {
            Authorization: `Bearer ${SERVICE_KEY}`,
            apikey: SERVICE_KEY,
          },
        }
      );
      const codes = await codesRes.json();
      return res.status(200).json({ codes });
    }

    // ====== POST: tạo mã mới theo lô ======
    if (req.method === 'POST') {
      const { quantity = 1, source = 'manual' } = req.body || {};
      const qty = Math.min(Math.max(parseInt(quantity, 10) || 1, 1), 200);

      function genCode() {
        const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
        let c = '';
        for (let i = 0; i < 8; i++) c += chars[Math.floor(Math.random() * chars.length)];
        return c;
      }

      const newCodes = Array.from({ length: qty }, () => ({
        code: genCode(),
        status: 'unused',
        source,
        created_by: userData.id,
      }));

      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/access_codes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          apikey: SERVICE_KEY,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(newCodes),
      });

      const inserted = await insertRes.json();
      if (!insertRes.ok) {
        return res.status(400).json({ error: inserted.message || 'Không tạo được mã' });
      }

      return res.status(200).json({ codes: inserted });
    }

    // ====== PATCH: vô hiệu hoá 1 mã ======
    if (req.method === 'PATCH') {
      const { code, status } = req.body || {};
      if (!code || !status) {
        return res.status(400).json({ error: 'Thiếu code hoặc status' });
      }
      const updateRes = await fetch(
        `${SUPABASE_URL}/rest/v1/access_codes?code=eq.${encodeURIComponent(code)}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${SERVICE_KEY}`,
            apikey: SERVICE_KEY,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify({ status }),
        }
      );
      const updated = await updateRes.json();
      return res.status(200).json({ codes: updated });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    return res.status(500).json({ error: 'Lỗi server: ' + (err.message || String(err)) });
  }
}
