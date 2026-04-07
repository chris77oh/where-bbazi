// Vercel Serverless Function — 기상청 초단기예보 프록시
// 환경변수 KMA_API_KEY 를 Vercel 대시보드에서 설정할 것

const ALLOWED_ORIGIN = 'https://where-bbazi.kr';
const { isRateLimited } = require('./_rate-limit');

module.exports = async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin === ALLOWED_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  }
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300'); // 10분 캐시

  // Rate limit 체크 — Vercel KV 전역 공유 (멀티 인스턴스 대응)
  const ip = req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
  if (await isRateLimited(ip, 10, 60_000)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const API_KEY = process.env.KMA_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }


  // 기상청 base_date / base_time 계산 (KST)
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000); // UTC → KST
  let baseDate = now.toISOString().slice(0, 10).replace(/-/g, '');
  let baseHour = now.getUTCHours(); // 이미 KST 보정했으므로 getUTCHours
  let baseMin = now.getUTCMinutes();

  // 초단기예보는 매시 30분 발표, 45분부터 조회 가능
  // 아직 45분 전이면 이전 시간대 사용
  if (baseMin < 45) {
    baseHour -= 1;
    if (baseHour < 0) {
      baseHour = 23;
      // 전날로
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      baseDate = yesterday.toISOString().slice(0, 10).replace(/-/g, '');
    }
  }
  const baseTime = String(baseHour).padStart(2, '0') + '30';

  // 두 지역: 가평(72,134), 춘천(73,134)
  const locations = [
    { name: 'gapyeong', nx: 72, ny: 134 },
    { name: 'chuncheon', nx: 73, ny: 134 },
  ];

  try {
    const results = {};

    const fetches = locations.map(async (loc) => {
      // 기상청 API는 serviceKey를 직접 문자열로 넣어야 함 (URL 이중 인코딩 방지)
      const urlStr = `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtFcst?serviceKey=${API_KEY}&numOfRows=60&pageNo=1&dataType=JSON&base_date=${baseDate}&base_time=${baseTime}&nx=${loc.nx}&ny=${loc.ny}`;

      const response = await fetch(urlStr);
      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch { results[loc.name] = { error: 'Invalid response', raw: text.slice(0, 200) }; return; }

      const items = data?.response?.body?.items?.item;
      if (!items || items.length === 0) {
        results[loc.name] = { error: 'No data', raw: data?.response?.header };
        return;
      }

      // 가장 가까운 예보시간의 데이터만 추출
      const firstFcstTime = items[0].fcstTime;
      const nearest = items.filter(i => i.fcstTime === firstFcstTime);

      const parsed = {};
      for (const item of nearest) {
        parsed[item.category] = item.fcstValue;
      }

      results[loc.name] = {
        baseDate,
        baseTime,
        fcstTime: firstFcstTime,
        T1H: parsed.T1H || null,   // 기온
        SKY: parsed.SKY || null,   // 하늘상태 1맑음 3구름많음 4흐림
        PTY: parsed.PTY || null,   // 강수형태 0없음 1비 2비/눈 3눈 5빗방울 6빗방울눈날림 7눈날림
        RN1: parsed.RN1 || null,   // 1시간 강수량
        REH: parsed.REH || null,   // 습도
        WSD: parsed.WSD || null,   // 풍속
      };
    });

    await Promise.all(fetches);

    return res.status(200).json({
      ok: true,
      updated: `${baseDate} ${baseTime}`,
      data: results,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Weather API error' }); // 내부 에러 상세 노출 제거
  }
}
