/**
 * Testlar uchun xotiradagi (in-memory) toza ma'lumotlar bazasi.
 * Har bir test fayli alohida jarayonda va alohida bazada ishlaydi — natijalar
 * bir-biriga ta'sir qilmaydi.
 */
import { closeDb, openDatabase, setDb } from '../../src/database/db.js';
import { runMigrations } from '../../src/database/migrate.js';
import { seedSettings, seedCategories, seedProducts, seedAdmin } from '../../src/database/seed.js';

export function freshDatabase({ withDemo = true, withAdmin = true } = {}) {
  const db = openDatabase(':memory:');
  setDb(db);
  runMigrations(db);

  seedSettings(db);
  seedCategories(db);
  if (withDemo) seedProducts({ db, force: true });
  if (withAdmin) seedAdmin({ db });

  return db;
}

export function teardownDatabase() {
  closeDb();
}

export function countRows(db, table) {
  return db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get().total;
}

export { seedSettings, seedCategories, seedProducts, seedAdmin, runMigrations };
