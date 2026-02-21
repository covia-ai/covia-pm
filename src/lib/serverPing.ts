/**
 * Attempts a no-cors HEAD request to the given URL.
 *
 * With mode:'no-cors', fetch resolves on any network-level response (even opaque
 * or HTTP 4xx/5xx — including 405 from MCP servers that only accept POST). It throws
 * only on a network failure (DNS error, refused connection) or timeout.
 *
 * Returns true  → server is reachable
 * Returns false → unreachable (network error or timeout)
 */
export async function pingServer(url: string, timeoutMs = 5000): Promise<boolean> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(url, { method: 'HEAD', mode: 'no-cors', signal: controller.signal });
    return true;
  } catch {
    // AbortError (timeout) or TypeError (network failure) both land here
    return false;
  } finally {
    clearTimeout(id);
  }
}
