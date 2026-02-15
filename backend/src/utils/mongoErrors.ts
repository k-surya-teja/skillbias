export function isDuplicateKeyError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const withCode = error as { code?: unknown };
  return Number(withCode.code) === 11000;
}
