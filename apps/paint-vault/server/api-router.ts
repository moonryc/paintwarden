import { withPublicError } from "../lib/public-errors";
import * as backup from "../app/api/backup/route";
import * as catalogItem from "../app/api/catalog/[id]/route";
import * as catalog from "../app/api/catalog/route";
import * as catalogShare from "../app/api/catalog-share/route";
import * as catalogSources from "../app/api/catalog-sources/route";
import * as colorSchemes from "../app/api/color-schemes/route";
import * as imageImport from "../app/api/image-import/route";
import * as miniatureSchemes from "../app/api/miniature-schemes/route";
import * as miniatureTemplates from "../app/api/miniature-templates/route";
import * as miniatureImage from "../app/api/miniatures/[id]/image/route";
import * as miniature from "../app/api/miniatures/[id]/route";
import * as miniatures from "../app/api/miniatures/route";
import * as paintState from "../app/api/paint-state/route";
import * as paintSubstitutions from "../app/api/paint-substitutions/route";
import * as recipeSteps from "../app/api/recipe-steps/route";
import * as requirements from "../app/api/requirements/route";
import { GRAPHQL_BODY_BYTES } from "../graphql/budgets";
import { graphqlResponse } from "../graphql/server";
import { APP_VERSION } from "../lib/app-version";
import { authAction, authStatus, authorizeVault, hostRefused, sameOrigin } from "../lib/auth";
import { MAX_BACKUP_BYTES } from "../lib/backup";
import { UPLOAD_MAX_BYTES } from "../lib/catalog-source-upload";
import { sourceImage, sourceLogo } from "../lib/catalog-sources";
import { clientConfig } from "../lib/client-config";
import { limitRequestBody, type BodyLimit } from "../lib/request-limits";

type Handler = (request: Request) => Response | Promise<Response>;
const methodNotAllowed = () => Response.json({ error: "Method not allowed" }, { status: 405 });

function staticHandler(path: string, method: string): Handler | undefined {
  const routes: Record<string, Partial<Record<string, Handler>>> = {
    backup: { GET: () => backup.GET(), POST: backup.POST },
    catalog: { GET: catalog.GET, POST: catalog.POST },
    "catalog-share": { GET: () => catalogShare.GET(), POST: catalogShare.POST },
    "catalog-sources": {
      GET: catalogSources.GET,
      POST: catalogSources.POST,
      PUT: catalogSources.PUT,
      DELETE: catalogSources.DELETE,
    },
    "color-schemes": { POST: colorSchemes.POST, PUT: colorSchemes.PUT, DELETE: colorSchemes.DELETE },
    "image-import": { POST: imageImport.POST },
    "miniature-schemes": { PUT: miniatureSchemes.PUT },
    "miniature-templates": {
      POST: miniatureTemplates.POST,
      PUT: miniatureTemplates.PUT,
      DELETE: miniatureTemplates.DELETE,
    },
    miniatures: { POST: miniatures.POST },
    "paint-state": { PUT: paintState.PUT },
    "paint-substitutions": {
      POST: paintSubstitutions.POST,
      PUT: paintSubstitutions.PUT,
      DELETE: paintSubstitutions.DELETE,
    },
    requirements: {
      PUT: requirements.PUT,
      PATCH: requirements.PATCH,
      POST: requirements.POST,
      DELETE: requirements.DELETE,
    },
    "recipe-steps": { PUT: recipeSteps.PUT },
  };
  return routes[path]?.[method];
}

const MIB = 1024 * 1024;

function bodyLimit(path: string, method: string, contentType: string): BodyLimit {
  if (path === "graphql" || path === "graphql/stream")
    return { maxBytes: GRAPHQL_BODY_BYTES, message: "GraphQL requests must be under 128 KiB" };
  if (path.startsWith("auth/")) return { maxBytes: 16 * 1024, message: "This request is too large" };
  if (path === "backup" && method === "POST")
    return { maxBytes: MAX_BACKUP_BYTES, message: "The backup file must be under 16 GB" };
  // A JSON body only names a repository; anything else is an uploaded plugin.
  if (path === "catalog-sources" && method === "POST" && contentType !== "application/json")
    return { maxBytes: UPLOAD_MAX_BYTES, message: "The plugin file must be under 250 MB" };
  // An 8 MB image plus its form encoding.
  if (/^miniatures\/[^/]+\/image$/.test(path))
    return { maxBytes: 9 * MIB, message: "Image must be under 8 MB" };
  return { maxBytes: 32 * MIB, message: "This request is too large" };
}

export async function routeApi(incoming: Request): Promise<Response> {
  return withPublicError(await routeApiInternal(incoming));
}

async function routeApiInternal(incoming: Request): Promise<Response> {
  const path = new URL(incoming.url).pathname.replace(/^\/api\/?/, "").replace(/\/+$/, "");
  const method = incoming.method.toUpperCase();
  const contentType = incoming.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
  const limit = bodyLimit(path, method, contentType);
  const body = limitRequestBody(incoming, limit);
  const tooLarge = () => Response.json({ error: limit.message }, { status: 413 });
  if (!body) return tooLarge();
  try {
    const response = await dispatch(body.request, path, method);
    // A handler may have caught the read failure and answered as if the body were invalid.
    return body.exceeded() ? tooLarge() : response;
  } catch (error) {
    if (body.exceeded()) return tooLarge();
    throw error;
  }
}

async function dispatch(request: Request, path: string, method: string): Promise<Response> {
  if (path === "client-config") return clientConfig(request);
  // Public, so the desktop app can check compatibility before signing in.
  if (path === "version" && method === "GET")
    return Response.json(
      { name: "paint-vault", version: APP_VERSION },
      { headers: { "cache-control": "no-store" } },
    );
  const refused = hostRefused(request);
  if (refused) return refused;
  if (path === "auth/status" && method === "GET") return authStatus(request);
  if (path.startsWith("auth/") && method === "POST") return authAction(request, path);
  if (!sameOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
  const denied = authorizeVault(request);
  if (denied) return denied;
  if (path === "graphql" || path === "graphql/stream")
    return graphqlResponse(request, path === "graphql/stream");
  const direct = staticHandler(path, method);
  if (direct) return direct(request);

  const catalogMatch = path.match(/^catalog\/([^/]+)$/);
  const sourceImageMatch = path.match(/^catalog-source-images\/([^/]+)$/);
  if (sourceImageMatch && method === "GET") return sourceImage(decodeURIComponent(sourceImageMatch[1]));
  const sourceLogoMatch = path.match(/^catalog-source-logos\/([^/]+)$/);
  if (sourceLogoMatch && method === "GET") return sourceLogo(decodeURIComponent(sourceLogoMatch[1]));
  if (catalogMatch) {
    const context = { params: Promise.resolve({ id: decodeURIComponent(catalogMatch[1]) }) };
    if (method === "PUT") return catalogItem.PUT(request, context);
    if (method === "DELETE") return catalogItem.DELETE(request, context);
    return methodNotAllowed();
  }
  const imageMatch = path.match(/^miniatures\/([^/]+)\/image$/);
  const templateImageMatch = path.match(/^miniature-templates\/([^/]+)\/image$/);
  if (templateImageMatch && method === "GET")
    return miniatureTemplates.imageForTemplate(decodeURIComponent(templateImageMatch[1]), request);
  if (imageMatch) {
    const context = { params: Promise.resolve({ id: decodeURIComponent(imageMatch[1]) }) };
    if (method === "GET") return miniatureImage.GET(request, context);
    if (method === "POST") return miniatureImage.POST(request, context);
    if (method === "DELETE") return miniatureImage.DELETE(request, context);
    return methodNotAllowed();
  }
  const miniatureMatch = path.match(/^miniatures\/([^/]+)$/);
  if (miniatureMatch) {
    const context = { params: Promise.resolve({ id: decodeURIComponent(miniatureMatch[1]) }) };
    if (method === "PUT") return miniature.PUT(request, context);
    if (method === "DELETE") return miniature.DELETE(request, context);
    return methodNotAllowed();
  }
  if (
    [
      "backup",
      "catalog",
      "catalog-share",
      "catalog-sources",
      "color-schemes",
      "image-import",
      "miniature-schemes",
      "miniature-templates",
      "miniatures",
      "paint-state",
      "paint-substitutions",
      "requirements",
      "recipe-steps",
    ].includes(path)
  )
    return methodNotAllowed();
  return Response.json({ error: "Not found" }, { status: 404 });
}
