/**
 * Audit jurnali: adminlarning muhim amallarini yozib boradi (kim, qachon, nima qildi).
 * Xavfsizlik talabi: narx, ombor va buyurtma statusi o'zgarishlari kuzatiladi.
 */
import { getDb } from '../database/db.js';
import logger from '../utils/logger.js';

export function log({ actor = 'system', action, entity = null, entityId = null, details = null, ip = null }) {
  try {
    getDb()
      .prepare(
        `INSERT INTO audit_logs (actor, action, entity, entity_id, details, ip)
         VALUES (@actor, @action, @entity, @entityId, @details, @ip)`,
      )
      .run({
        actor,
        action,
        entity,
        entityId: entityId === null ? null : String(entityId),
        details: details ? JSON.stringify(details) : null,
        ip,
      });
  } catch (error) {
    logger.error('Audit yozuvini saqlashda xatolik', error);
  }
}

export function recent(limit = 50) {
  return getDb().prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?').all(limit);
}

export default { log, recent };
