import catalog from "../../../packages/paint-i18n/error-catalog.json" with { type: "json" };

const patterns = catalog.map((entry) => ({ ...entry, regex: new RegExp(entry.pattern) }));
// Stable codes are the wire contract. English messages remain for older clients and diagnostics,
// never as the display contract of localized clients. Unknown/internal messages are not exposed.
export function publicError(message: string, fallback = "REQUEST_FAILED") {
  for (const entry of patterns) {
    const match = entry.regex.exec(message);
    if (match)
      return {
        errorCode: entry.code,
        errorParameters: Object.fromEntries(entry.parameters.map((name, index) => [name, match[index + 1]])),
      };
  }
  return { errorCode: fallback, errorParameters: {} };
}
export async function withPublicError(response: Response): Promise<Response> {
  if (response.ok || !response.headers.get("content-type")?.includes("application/json")) return response;
  const body: unknown = await response
    .clone()
    .json()
    .catch(() => null);
  if (!body || typeof body !== "object" || !("error" in body) || typeof body.error !== "string")
    return response;
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return Response.json({ ...body, ...publicError(body.error) }, { status: response.status, headers });
}
