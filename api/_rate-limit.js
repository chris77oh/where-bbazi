/**
 * 전역 Rate Limiter — Vercel KV 기반
 * 멀티 인스턴스 환경에서도 공유 카운터로 정확하게 동작
 *
 * Vercel KV 없는 환경(로컬)에서는 인메모리 폴백 사용
 */

// 인메모리 폴백 (로컬 개발용)
const fallbackMap = new Map();

async function isRateLimited(ip, limit, windowMs) {
  const key = `rl:${ip}`;
  const now = Date.now();

  try {
    const { kv } = require('@vercel/kv');

    // KV에서 현재 카운트 조회
    const data = await kv.get(key);

    if (!data || now - data.start > windowMs) {
      // 윈도우 초과 또는 첫 요청 → 리셋
      await kv.set(key, { count: 1, start: now }, { px: windowMs });
      return false;
    }

    if (data.count >= limit) return true;

    // 카운트 증가
    await kv.set(key, { count: data.count + 1, start: data.start }, { px: windowMs - (now - data.start) });
    return false;

  } catch {
    // KV 없는 환경 → 인메모리 폴백
    const entry = fallbackMap.get(key) || { count: 0, start: now };
    if (now - entry.start > windowMs) {
      fallbackMap.set(key, { count: 1, start: now });
      return false;
    }
    entry.count += 1;
    fallbackMap.set(key, entry);
    return entry.count > limit;
  }
}

module.exports = { isRateLimited };
