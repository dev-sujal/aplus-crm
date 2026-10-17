export interface StudentNameParts {
  firstName?: string | null;
  fatherName?: string | null;
  lastName?: string | null;
}

export function formatStudentName({ firstName, fatherName, lastName }: StudentNameParts): string {
  return [firstName, fatherName, lastName]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .map((part) => part.trim())
    .join(" ");
}
