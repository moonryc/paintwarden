// Only explicitly localized messages may cross a REST/UI error boundary. Native
// fetch, JSON, desktop bridge and legacy server diagnostics are not display text.
export class PublicError extends Error {}

export function publicErrorMessage(error: unknown, fallback: string): string {
  return error instanceof PublicError ? error.message : fallback;
}
