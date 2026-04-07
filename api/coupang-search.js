const crypto = require('crypto');

const ACCESS_KEY = process.env.COUPANG_ACCESS_KEY;
const SECRET_KEY = process.env.COUPANG_SECRET_KEY;
const DOMAIN = 'https://api-gateway.coupang.com';
const PATH = '/v2/providers/affiliate_open_api/apis/openapi/v1/products/search';

function generateAuthorization(method, path, query, secretKey, accessKey) {
  // datetime: yyMMddTHHMMSSZ (GMT)
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const datetime = String(now.getUTCFullYear()).slice(2)
    + pad(now.getUTCMonth() + 1)
    + pad(now.getUTCDate())
    + 'T'
    + pad(now.getUTCHours())
    + pad(now.getUTCMinutes())
    + pad(now.getUTCSeconds())
    + 'Z';

  // message = datetime + method + path + queryString (연결, 줄바꿈 없음)
  const message = datetime + method + path + query;

  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(message)
    .digest('hex');

  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
}

const ALLOWED_ORIGIN = 'https://where-bbazi.kr';
const { isRateLimited } = require('./_rate-limit');

// ===== 키워드 화이트리스트 =====
// deals.html에서 실제로 사용하는 키워드만 허용 — 임의 키워드로 API 남용 차단
const ALLOWED_KEYWORDS = new Set([
  '방수팩 IPX8 목걸이',
  '래쉬가드 세트 상하의',
  '아쿠아슈즈 미끄럼방지',
  '방수 선크림 SPF50',
  '액션캠 방수',
  '방수 셀카봉 플로팅',
]);

function isAllowedKeyword(keyword) {
  return ALLOWED_KEYWORDS.has(keyword);
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin === ALLOWED_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Rate limit 체크
  // Rate limit 체크 — Vercel KV 전역 공유 (멀티 인스턴스 대응)
  const ip = req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
  if (await isRateLimited(ip, 5, 60_000)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const { keyword, limit = '3' } = req.query;
  if (!keyword) return res.status(400).json({ error: 'keyword parameter is required' });
  if (!isAllowedKeyword(keyword)) return res.status(403).json({ error: 'keyword not allowed' });
  if (!ACCESS_KEY || !SECRET_KEY) return res.status(500).json({ error: 'API keys not configured' });

  // limit 파라미터 — 최소 1, 최대 10으로 제한 (API 비용 남용 방지)
  const safeLimit = Math.min(Math.max(parseInt(limit) || 3, 1), 10);

  try {
    const query = `keyword=${encodeURIComponent(keyword)}&limit=${safeLimit}`;
    const authorization = generateAuthorization('GET', PATH, query, SECRET_KEY, ACCESS_KEY);


    const fullUrl = `${DOMAIN}${PATH}?${query}`;

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json;charset=UTF-8',
      },
    });

    if (!response.ok) {
      return res.status(502).json({ error: 'Upstream API error' }); // 내부 에러 상세 노출 제거
    }

    const data = await response.json();
    const products = (data.data?.productData || []).slice(0, safeLimit).map((item) => ({
      productName: item.productName,
      productPrice: item.productPrice,
      productImage: item.productImage,
      productUrl: item.productUrl,
      isRocket: item.isRocket,
      isFreeShipping: item.isFreeShipping,
    }));

    return res.status(200).json({ success: true, keyword, count: products.length, products });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' }); // err.message 노출 제거
  }
};
