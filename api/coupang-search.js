const crypto = require('crypto');

/**
 * 쿠팡파트너스 OPEN API - 상품 검색 Serverless Function
 * HMAC-SHA256 서명 생성 후 쿠팡 API 호출
 */

const ACCESS_KEY = process.env.COUPANG_ACCESS_KEY;
const SECRET_KEY = process.env.COUPANG_SECRET_KEY;
const DOMAIN = 'https://api-gateway.coupang.com';
const REQUEST_METHOD = 'GET';
const PATH = '/v2/providers/affiliate_open_api/apis/openapi/v1/products/search';

function generateAuthorization(method, url, secretKey, accessKey) {
  const parts = url.split(/\?/);
  const path = parts[0];
  const query = parts.length > 1 ? parts[1] : '';

  // datetime: yyMMddTHHmmssZ (KST → UTC)
  const datetime = new Date().toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
    .slice(2); // remove first 2 chars of year (20 → just last 2 digits)

  const message = [datetime, method, path, query].join('\n');

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

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { keyword, limit = '3' } = req.query;

  if (!keyword) {
    return res.status(400).json({ error: 'keyword parameter is required' });
  }

  if (!ACCESS_KEY || !SECRET_KEY) {
    return res.status(500).json({ error: 'API keys not configured' });
  }

  try {
    const queryString = `keyword=${encodeURIComponent(keyword)}&limit=${limit}`;
    const requestUrl = `${PATH}?${queryString}`;

    const authorization = generateAuthorization(
      REQUEST_METHOD,
      requestUrl,
      SECRET_KEY,
      ACCESS_KEY
    );

    const fullUrl = `${DOMAIN}${requestUrl}`;

    const response = await fetch(fullUrl, {
      method: REQUEST_METHOD,
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json;charset=UTF-8',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: 'Coupang API request failed',
        status: response.status,
        detail: errorText,
      });
    }

    const data = await response.json();

    const products = (data.data?.productData || []).slice(0, parseInt(limit)).map((item) => ({
      productName: item.productName,
      productPrice: item.productPrice,
      productImage: item.productImage,
      productUrl: item.productUrl,
      categoryName: item.categoryName,
      isRocket: item.isRocket,
      isFreeShipping: item.isFreeShipping,
    }));

    return res.status(200).json({
      success: true,
      keyword,
      count: products.length,
      products,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
};
