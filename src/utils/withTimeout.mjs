// Reject a network/Supabase call if it doesn't settle in time.
//
// Supabase-js has no built-in request timeout, so on a flaky mobile
// connection a query/upsert can hang forever. Because our remote helpers
// write to localStorage FIRST, a timeout is safe: it just rejects, the
// caller's try/catch falls back to local data + an error message, and the UI
// never freezes waiting on a promise that will never resolve.

export const DEFAULT_TIMEOUT_MS = 12000;
export const UPLOAD_TIMEOUT_MS = 30000;

export function withTimeout(promise, ms = DEFAULT_TIMEOUT_MS, label = "reach the server") {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Network timeout while trying to ${label}. Working offline for now.`));
    }, ms);
  });
  // Promise.resolve adopts the Supabase query builder (a thenable) and starts
  // it; finally clears the timer whichever side wins.
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(timer));
}
