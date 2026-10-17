export function normalizeReceiptNumber(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const match = /^APC-(\d{4})-(\d{1,})$/i.exec(trimmed);
  if (!match) return null;
  return `APC-${match[1]}-${Number(match[2]).toString().padStart(4, "0")}`;
}

export function getNextReceiptNumber(
  existingNumbers: Array<string | null | undefined> = [],
  year = new Date().getFullYear()
): string {
  const highestSequence = existingNumbers
    .map((value) => normalizeReceiptNumber(value))
    .filter((value): value is string => Boolean(value))
    .map((value) => {
      const match = /^APC-(\d{4})-(\d{1,})$/i.exec(value);
      if (!match) return null;
      const parsedYear = Number(match[1]);
      const parsedSequence = Number(match[2]);
      if (parsedYear !== year) return null;
      return parsedSequence;
    })
    .filter((value): value is number => Number.isFinite(value))
    .reduce((max, value) => Math.max(max, value), 0);

  return `APC-${year}-${String(highestSequence + 1).padStart(4, "0")}`;
}
