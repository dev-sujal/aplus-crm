/** Keeps digits only (max 12) and groups them as "1234 5678 9012" while typing. */
export function formatAadhaar(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "").slice(0, 12)
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ")
}

/** "1234 5678 9012" -> "123456789012" (what the API stores). */
export function stripAadhaar(value: string): string {
  return value.replace(/[\s-]/g, "")
}

export const AADHAAR_ERROR = "Aadhaar number must be exactly 12 digits"

export function isValidAadhaar(value: string): boolean {
  const digits = stripAadhaar(value)
  return digits === "" || /^\d{12}$/.test(digits)
}
