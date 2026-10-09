/**
 * auth/authCache.js
 *
 * Thin localStorage helpers for caching auth state client-side.
 *
 * Two keys:
 *   cc_auth   — the signed-in user object + timestamp
 *   cc_config — the Google client ID (never changes, no expiry)
 *
 * Why localStorage and not sessionStorage?
 *   sessionStorage is cleared when the tab closes. We want the cache to
 *   persist across page reloads and new tabs so the user never sees a
 *   loading spinner just because they opened a new tab.
 *
 * Security notes:
 *   - We never store the JWT cookie here — that stays httpOnly and is
 *     managed entirely by the browser. We only cache the public user
 *     object (id, name, email, avatarUrl) for instant UI rendering.
 *   - The cache is always validated against the server in the background.
 *     A stale/invalid cache causes a silent re-fetch, not a security hole.
 *   - The Google client ID is not a secret (visible in DevTools on any
 *     Google sign-in page) so caching it is fine.
 */

const AUTH_KEY   = 'cc_auth'
const CONFIG_KEY = 'cc_config'

// ── User cache ────────────────────────────────────────────────────────────────

/**
 * Write the signed-in user to cache.
 * @param {object} user
 */
export function cacheUser(user) {
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify({
      user,
      cachedAt: Date.now(),
    }))
  } catch {
    // localStorage can be blocked (private browsing quota) — fail silently
  }
}

/**
 * Read the cached user. Returns null if nothing is cached.
 * @returns {{ user: object, cachedAt: number } | null}
 */
export function getCachedUser() {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.user || !parsed?.cachedAt) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Remove the user cache (call on logout or on 401 from /api/auth/me).
 */
export function clearUserCache() {
  try {
    localStorage.removeItem(AUTH_KEY)
  } catch {
    // ignore
  }
}

// ── Config cache ──────────────────────────────────────────────────────────────

/**
 * Write the Google client ID to cache. No expiry — it never changes.
 * @param {string} googleClientId
 */
export function cacheConfig(googleClientId) {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ googleClientId }))
  } catch {
    // ignore
  }
}

/**
 * Read the cached Google client ID.
 * @returns {string | null}
 */
export function getCachedConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.googleClientId ?? null
  } catch {
    return null
  }
}

/**
 * Remove both caches. Used for full sign-out / account switch.
 */
export function clearAllCache() {
  clearUserCache()
  try {
    localStorage.removeItem(CONFIG_KEY)
  } catch {
    // ignore
  }
}
