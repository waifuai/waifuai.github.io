// analytics.js
// Thin wrapper around GA4 (gtag), same pattern used in waifu-companion's
// scripts/utils.js: a guarded trackEvent() plus a throttled trackError()
// so a bug in a loop can't flood the property with duplicate events.

/**
 * Sends a GA4 event. No-ops silently if gtag hasn't loaded (e.g. blocked
 * by an ad blocker, or running offline/locally without network access).
 * @param {string} eventName
 * @param {object} [params]
 */
export function trackEvent(eventName, params = {}) {
    if (typeof gtag === 'function') {
        gtag('event', eventName, params);
    }
}

// --- Error reporting ---------------------------------------------------
// Fixed category + short code only, never a free-text message: level JSON
// or console error text could vary per level/browser and would blow up
// GA's cardinality if sent verbatim.

const ERROR_CATEGORIES = [
    'level_load',   // level JSON failed to fetch/parse
    'audio',        // Tone.js / synth / background music failure
    'invalid_level' // level data missing player start / malformed
];

// One event per category+code every 60s, plus a hard session cap, so a
// failure that keeps retrying (e.g. background music load) can't spam.
const _errorThrottle = new Map();
const ERROR_THROTTLE_MS = 60000;
const ERROR_SESSION_CAP = 50;
let _errorsReported = 0;

/**
 * @param {string} category one of ERROR_CATEGORIES
 * @param {string|number} [code] short identifier, e.g. an HTTP status or level number
 */
export function trackError(category, code) {
    if (!ERROR_CATEGORIES.includes(category)) return;
    if (_errorsReported >= ERROR_SESSION_CAP) return;

    const safeCode = (typeof code === 'number' || typeof code === 'string') ? code : 'unknown';

    const key = `${category}:${safeCode}`;
    const now = Date.now();
    const last = _errorThrottle.get(key);
    if (last && now - last < ERROR_THROTTLE_MS) return;
    _errorThrottle.set(key, now);
    _errorsReported++;

    trackEvent('app_error', { category, code: safeCode });
}
