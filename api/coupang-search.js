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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { keyword, limit = '3' } = req.query;
  if (!keyword) return res.status(400).json({ error: 'keyword parameter is required' });
  if (!ACCESS_KEY || !SECRET_KEY) return res.status(500).json({ error: 'API keys not configured' });

  try {
    const query = `keyword=${encodeURIComponent(keyword)}&limit=${limit}`;
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
      const errorText = await response.text();
      return res.status(response.status).json({ error: 'Coupang API failed', status: response.status, detail: errorText });
    }

    const data = await response.json();
    const products = (data.data?.productData || []).slice(0, parseInt(limit)).map((item) => ({
      productName: item.productName,
      productPrice: item.productPrice,
      productImage: item.productImage,
      productUrl: item.productUrl,
      isRocket: item.isRocket,
      isFreeShipping: item.isFreeShipping,
    }));

    return res.status(200).json({ success: true, keyword, count: products.length, products });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
};
