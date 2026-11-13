import { vaultChangesSince } from "../../../lib/vault-state";

// Rows changed since the client's cursor; `reload` asks the client to fetch /api/state instead.
export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const since = Number(params.get("since"));
  if (!Number.isSafeInteger(since) || since < 0)
    return Response.json({ error: "A change position is required" }, { status: 400 });
  return Response.json(vaultChangesSince(params.get("epoch") ?? "", since));
}
