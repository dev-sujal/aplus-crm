import { ApiRequestError } from "#lib/api-client"

/** Best human-readable message for any thrown error. */
export function errorMessage(error: unknown, fallback = "Something went wrong") {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error) return error.message
  return fallback
}

/** Parses a numeric form field; returns `fallback` only when empty/invalid (so 0 stays 0). */
export function parseNumber(value: string, fallback: number) {
  if (value.trim() === "") return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

/** id of a populated ref ({ id } or { _id }) or of a plain id string. */
export function refId(ref: unknown): string {
  if (typeof ref === "string") return ref
  if (ref && typeof ref === "object") {
    const r = ref as { id?: string; _id?: string }
    return r.id ?? r._id ?? ""
  }
  return ""
}

export function refTitle(ref: unknown, fallback = "—") {
  if (ref && typeof ref === "object" && "title" in ref) return String((ref as { title: string }).title)
  return fallback
}

export function personName(ref: unknown, fallback = "Unknown student") {
  if (ref && typeof ref === "object") {
    const p = ref as { firstName?: string; lastName?: string }
    const name = `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim()
    if (name) return name
  }
  return fallback
}

/** `datetime-local` value (local time, no zone) -> ISO string, or null when empty. */
export function localInputToIso(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString()
}

export function shareUrl(shareToken: string) {
  return `${window.location.origin}/tests/share/${shareToken}`
}

/** crypto.randomUUID is unavailable on plain-http pages other than localhost. */
export function uuid() {
  if (globalThis.crypto && "randomUUID" in globalThis.crypto) return globalThis.crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
