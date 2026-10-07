/**
 * src/lib/httpClient.js
 *
 * A thin wrapper around Node's built-in fetch with:
 *  - 10 second timeout (so a slow upstream never hangs the worker forever)
 *  - A descriptive User-Agent (polite to the APIs we call)
 *  - Automatic JSON parsing
 *  - Maps HTTP errors → typed errors the adapter can catch
 *
 * Why not just use fetch() directly in the adapter?
 * Centralising these concerns means every adapter gets timeout + UA for free,
 * and we only have one place to change if we need to add retries, logging,
 * or a proxy later.
 */

import { UpstreamError } from '../adapters/errors.js'

const DEFAULT_TIMEOUT_MS = 10_000
const USER_AGENT = 'CodeCircle/1.0 (github.com/codecircle; contact via repo)'

/**
 * Fetch a URL and return the parsed JSON body.
 * Throws UpstreamError on non-2xx responses or network/timeout failures.
 *
 * @param {string} url
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<unknown>}
 */
export async function getJson(url, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    })
  } catch (err) {
    // Network error or timeout (AbortError)
    const isTimeout = err.name === 'AbortError'
    throw new UpstreamError(
      isTimeout ? `Request to ${url} timed out after ${timeoutMs}ms` : `Network error fetching ${url}: ${err.message}`,
    )
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    // 429 = rate limited, 5xx = upstream down — all retryable
    throw new UpstreamError(
      `${url} responded with HTTP ${response.status}`,
      response.status,
    )
  }

  try {
    return await response.json()
  } catch {
    throw new UpstreamError(`Failed to parse JSON response from ${url}`)
  }
}

/**
 * Fetch a URL and return its text body using the same timeout and user agent
 * as JSON requests.
 *
 * @param {string} url
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<string>}
 */
export async function getText(url, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml',
      },
    })
  } catch (err) {
    const isTimeout = err.name === 'AbortError'
    throw new UpstreamError(
      isTimeout ? `Request to ${url} timed out after ${timeoutMs}ms` : `Network error fetching ${url}: ${err.message}`,
    )
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    throw new UpstreamError(`${url} responded with HTTP ${response.status}`, response.status)
  }

  return response.text()
}

/**
 * POST a JSON body and return the parsed JSON response.
 *
 * @param {string} url
 * @param {object} body
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<unknown>}
 */
export async function postJson(url, body, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response
  try {
    response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    const isTimeout = err.name === 'AbortError'
    throw new UpstreamError(
      isTimeout ? `Request to ${url} timed out after ${timeoutMs}ms` : `Network error fetching ${url}: ${err.message}`,
    )
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    throw new UpstreamError(`${url} responded with HTTP ${response.status}`, response.status)
  }

  try {
    return await response.json()
  } catch {
    throw new UpstreamError(`Failed to parse JSON response from ${url}`)
  }
}
