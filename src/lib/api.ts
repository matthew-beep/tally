// Centralized POST for internal API routes. Always throws an Error carrying
// the server's { error } message when there is one, else a status fallback.
// The error body may not be JSON (gateway 502, HTML error page) — hence the
// defensive parse. This helper only *produces* errors; handling them (toast,
// error state, onError) belongs to the caller.
export async function postJson<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const parsed = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(parsed?.error ?? `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}
