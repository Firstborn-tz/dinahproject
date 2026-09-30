const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const LAST_ACTIVITY_KEY = 'dinah_last_activity';
const ACTIVITY_THROTTLE_MS = 5000;
let idleTimer = null;
let lastWrite = 0;

function lastActivityAt() {
  const value = Number(sessionStorage.getItem(LAST_ACTIVITY_KEY));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function inactivitySessionExpired() {
  const last = lastActivityAt();
  return last > 0 && Date.now() - last >= IDLE_TIMEOUT_MS;
}

function scheduleIdleLogout() {
  clearTimeout(idleTimer);
  const remaining = IDLE_TIMEOUT_MS - (Date.now() - lastActivityAt());
  if (remaining <= 0) {
    window.logout?.('idle');
    return;
  }
  idleTimer = setTimeout(scheduleIdleLogout, remaining);
}

function recordActivity() {
  const now = Date.now();
  if (now - lastWrite >= ACTIVITY_THROTTLE_MS) {
    sessionStorage.setItem(LAST_ACTIVITY_KEY, String(now));
    lastWrite = now;
  }
  scheduleIdleLogout();
}

export function startInactivitySession() {
  sessionStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  lastWrite = Date.now();
  clearTimeout(idleTimer);
  ['pointerdown', 'keydown', 'scroll', 'touchstart', 'click'].forEach((eventName) => {
    window.removeEventListener(eventName, recordActivity);
    window.addEventListener(eventName, recordActivity, { passive: true });
  });
  document.removeEventListener('visibilitychange', scheduleIdleLogout);
  document.addEventListener('visibilitychange', scheduleIdleLogout);
  scheduleIdleLogout();
}

export function stopInactivitySession() {
  clearTimeout(idleTimer);
  idleTimer = null;
  ['pointerdown', 'keydown', 'scroll', 'touchstart', 'click'].forEach((eventName) => {
    window.removeEventListener(eventName, recordActivity);
  });
  document.removeEventListener('visibilitychange', scheduleIdleLogout);
  sessionStorage.removeItem(LAST_ACTIVITY_KEY);
  lastWrite = 0;
}
