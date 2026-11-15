import { GraphQLError } from "graphql";

import { authorizeVault, hostRefused, sameOrigin } from "../lib/auth";
import { watchPluginInstall } from "../lib/catalog-install-jobs";

export async function* subscribePluginInstall(request: Request) {
  const stream = watchPluginInstall(request.signal);
  let previous: string | undefined;
  try {
    for await (const job of stream) {
      const denied =
        hostRefused(request) ||
        (!sameOrigin(request) ? new Response(null, { status: 403 }) : authorizeVault(request));
      if (denied)
        throw new GraphQLError("Vault access ended", {
          extensions: { code: "UNAUTHENTICATED", http: { status: denied.status } },
        });
      const identity = JSON.stringify(job);
      if (identity !== previous) {
        previous = identity;
        yield { pluginInstallProgress: job };
      }
    }
  } finally {
    await stream.return();
  }
}
