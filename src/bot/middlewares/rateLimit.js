/**
 * Sodda va samarali rate limit: bir foydalanuvchi uchun belgilangan vaqt oynasida
 * maksimal so'rov soni. Botni "spam" va tasodifiy ortiqcha yuklamadan himoya qiladi.
 *
 * Katta yuklamada Redis-based limiter'ga o'tish mumkin — interfeys bir xil qoladi.
 */
import { rateLimitText } from '../texts.js';

const WINDOW_MS = 10_000;
const MAX_REQUESTS = 15;
const buckets = new Map();

function prune(now) {
  if (buckets.size < 5000) return;
  for (const [key, bucket] of buckets) {
    if (now - bucket.start > WINDOW_MS) buckets.delete(key);
  }
}

export function rateLimitMiddleware(ctx, next) {
  const userId = ctx.from?.id;
  if (!userId) return next();

  const now = Date.now();
  prune(now);

  const bucket = buckets.get(userId) ?? { count: 0, start: now, warned: false };
  if (now - bucket.start > WINDOW_MS) {
    bucket.count = 0;
    bucket.start = now;
    bucket.warned = false;
  }

  bucket.count += 1;
  buckets.set(userId, bucket);

  if (bucket.count > MAX_REQUESTS) {
    if (!bucket.warned) {
      bucket.warned = true;
      return ctx.reply(rateLimitText()).catch(() => {});
    }
    return undefined;
  }

  return next();
}

/** Testlar uchun */
export function resetRateLimit() {
  buckets.clear();
}

export default rateLimitMiddleware;
