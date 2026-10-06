/**
 * Botning joriy holatini kuzatish (monitoring uchun).
 *
 * 24/7 ishlashda eng muhim savol: "bot hozir tirikmi?" Jarayon ishlab turib, bot
 * to'xtab qolishi mumkin (token bekor qilindi, tarmoq uzildi, boshqa instansiya
 * conflict berdi). Shuning uchun holat alohida modulda saqlanadi va `/health`
 * endpoint hamda loglar orqali kuzatiladi.
 */

const state = {
  /** Bot polling boshlangan vaqt (ISO) */
  startedAt: null,
  /** Bot to'xtagan vaqt (ISO) */
  stoppedAt: null,
  /** Polling ishlayaptimi */
  running: false,
  /** Oxirgi xatolik matni (bo'lsa) */
  lastError: null,
  /** Oxirgi kelgan update vaqti (ISO) */
  lastUpdateAt: null,
  /** botInfo: id, username */
  botInfo: null,
};

/** Bot muvaffaqiyatli ishga tushdi */
export function markBotStarted(botInfo = null) {
  state.running = true;
  state.startedAt = new Date().toISOString();
  state.stoppedAt = null;
  state.lastError = null;
  state.botInfo = botInfo ? { id: botInfo.id ?? null, username: botInfo.username ?? null } : null;
}

/** Bot to'xtadi (sabab bilan) */
export function markBotStopped(reason = null) {
  state.running = false;
  state.stoppedAt = new Date().toISOString();
  state.lastError = reason ? String(reason).slice(0, 300) : null;
}

/** Har bir update qayta ishlanganda chaqiriladi — "bot tirik" isboti */
export function markUpdate() {
  state.lastUpdateAt = new Date().toISOString();
}

export function botStatus() {
  const uptimeSeconds = state.startedAt && state.running
    ? Math.floor((Date.now() - Date.parse(state.startedAt)) / 1000)
    : 0;

  return {
    running: state.running,
    startedAt: state.startedAt,
    stoppedAt: state.stoppedAt,
    lastError: state.lastError,
    lastUpdateAt: state.lastUpdateAt,
    uptimeSeconds,
    bot: state.botInfo,
  };
}

/** Faqat testlar uchun: holatni nolga qaytaradi */
export function resetBotStatus() {
  state.startedAt = null;
  state.stoppedAt = null;
  state.running = false;
  state.lastError = null;
  state.lastUpdateAt = null;
  state.botInfo = null;
}

export default { markBotStarted, markBotStopped, markUpdate, botStatus, resetBotStatus };
