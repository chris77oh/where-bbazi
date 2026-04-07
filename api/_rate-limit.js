/**
 * 전역 Rate Limiter — Upstash Redis 기반
 * 멀티 인스턴스 환경에서도 공유 카운터로 정확하게 동작
 *
 * 필요 환경변수 (Vercel 대시보드):
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 *
 * Upstash 없는 환경(로컬)에서는 인메모리 폴백 사용
 */

// 인메모리 폴백 (로컬 개발 / Upstash 미연결 시)
const fallbackMap = new Map();

async function isRateLimited(ip, limit, windowMs) {
  const key = `rl:${ip}`;
  const now = Date.now();

  try {
    const { Redis } = require('@upstash/redis');
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    // INCR + 첫 요청이면 TTL 설정 (원자적 카운터)
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.pexpire(key, windowMs); // 윈도우 만료 설정
    }
    return count > limit;

  } catch {
    // Upstash 미연결 → 인메모리 폴백
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
