/** Escapes user input for safe use inside a RegExp. */
export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Case-insensitive "contains" filter for a Mongo field (no text index needed). */
export function containsFilter(value: string) {
  return { $regex: escapeRegex(value.trim()), $options: "i" };
}
