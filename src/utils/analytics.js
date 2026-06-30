/**
 * Vercel Web Analytics utility
 * Provides a simple interface to track custom events
 * 
 * @see https://vercel.com/docs/analytics
 */

/**
 * Track a custom event in Vercel Analytics
 * @param {string} name - Event name
 * @param {Object} [properties] - Optional event properties
 */
export function track(name, properties) {
  if (typeof window !== 'undefined' && window.va) {
    window.va('event', { name, ...properties });
  }
}

/**
 * Track a page view (automatically done by the script, but can be called manually for SPA navigation)
 */
export function trackPageView() {
  if (typeof window !== 'undefined' && window.va) {
    window.va('pageview');
  }
}
