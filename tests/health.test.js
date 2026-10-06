/**
 * 24/7 kuzatuv: `/health` endpoint va bot holati moduli.
 *
 * Bu tekshiruv uptime-monitoring (systemd, UptimeRobot, nginx) ishonadigan
 * shartnomani qo'riqlaydi: `ok`, `database.ok` va `bot.running` maydonlari.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { freshDatabase, teardownDatabase } from './helpers/db.js';
import { createAdminServer } from '../src/admin/server.js';
import { botStatus, markBotStarted, markBotStopped, markUpdate, resetBotStatus } from '../src/bot/status.js';

let server;
let base;

before(async () => {
  freshDatabase();
  const app = createAdminServer();
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  resetBotStatus();
  await new Promise((resolve) => server.close(resolve));
  teardownDatabase();
});

test('health: autentifikatsiyasiz ochiq va mazmunli javob beradi', async () => {
  const response = await fetch(`${base}/health`);
  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.database.ok, true);
  assert.ok(Number.isFinite(payload.uptimeSeconds));
  assert.equal(payload.bot.running, false, 'bot hali ishga tushmagan — rostni aytadi');
});

test('health: bot ishga tushgach running=true va uptime hisoblanadi', async () => {
  markBotStarted({ id: 123, username: 'test_bot' });
  markUpdate();

  const payload = await (await fetch(`${base}/health`)).json();
  assert.equal(payload.bot.running, true);
  assert.equal(payload.bot.username, 'test_bot');
  assert.ok(payload.bot.startedAt, 'boshlanish vaqti yoziladi');
  assert.ok(payload.bot.lastUpdateAt, 'oxirgi update vaqti yoziladi');
  assert.ok(payload.bot.uptimeSeconds >= 0);
});

test('health: bot to‘xtasa running=false va sabab qaytariladi', async () => {
  markBotStopped('401: Unauthorized');

  const payload = await (await fetch(`${base}/health`)).json();
  assert.equal(payload.bot.running, false);
  assert.match(payload.bot.lastError, /401/);
  assert.ok(payload.bot.stoppedAt);
});

test('status: maxfiy ma’lumot (token) qaytarilmaydi', async () => {
  const raw = await (await fetch(`${base}/health`)).text();
  assert.doesNotMatch(raw, /\d{6,}:[A-Za-z0-9_-]{30,}/, 'bot tokeni health javobida bo‘lmasligi kerak');
  assert.doesNotMatch(raw, /BOT_TOKEN/);
});

test('status: resetBotStatus holatni tozalaydi', () => {
  markBotStarted({ id: 1, username: 'x' });
  resetBotStatus();
  const status = botStatus();
  assert.equal(status.running, false);
  assert.equal(status.bot, null);
  assert.equal(status.startedAt, null);
});
