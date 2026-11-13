import { vaultSnapshot } from "../../../lib/vault-state";

export function GET() {
  return Response.json(vaultSnapshot());
}
