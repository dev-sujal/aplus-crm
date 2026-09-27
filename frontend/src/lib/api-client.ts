export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api/v1"

export class ApiRequestError extends Error {
  status: number
  details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.name = "ApiRequestError"
    this.status = status
    this.details = details
  }
}

// Held in memory only (never localStorage) — lost on hard refresh, which is
// fine because the app re-derives it from the httpOnly refresh cookie on boot.
let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
}

// Dedupe concurrent refresh attempts (e.g. several requests firing at once).
let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) return null
        const data = (await res.json()) as { accessToken: string }
        setAccessToken(data.accessToken)
        return data.accessToken
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown
  skipAuthRetry?: boolean
}

async function parseErrorBody(res: Response): Promise<{ message: string; details?: unknown }> {
  try {
    const data = await res.json()
    return { message: data?.error?.message ?? res.statusText, details: data?.error?.details }
  } catch {
    return { message: res.statusText }
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  { body, skipAuthRetry, headers, ...init }: ApiFetchOptions = {}
): Promise<T> {
  const doFetch = async () => {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    return res
  }

  let res = await doFetch()

  if (res.status === 401 && !skipAuthRetry) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      res = await doFetch()
    }
  }

  if (!res.ok) {
    const { message, details } = await parseErrorBody(res)
    throw new ApiRequestError(res.status, message, details)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const api = {
  get: <T = unknown>(path: string, init?: ApiFetchOptions) =>
    apiFetch<T>(path, { ...init, method: "GET" }),
  post: <T = unknown>(path: string, body?: unknown, init?: ApiFetchOptions) =>
    apiFetch<T>(path, { ...init, method: "POST", body }),
  patch: <T = unknown>(path: string, body?: unknown, init?: ApiFetchOptions) =>
    apiFetch<T>(path, { ...init, method: "PATCH", body }),
  delete: <T = unknown>(path: string, init?: ApiFetchOptions) =>
    apiFetch<T>(path, { ...init, method: "DELETE" }),
}

export { refreshAccessToken }
