import {
  addCatalogSource,
  addUploadedCatalogSource,
  checkCatalogSource,
  checkCatalogSourceVersions,
  checkCatalogSources,
  listCatalogSources,
  previewSourceRemoval,
  removeCatalogSource,
} from "../../../lib/catalog-sources";

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  if (params.has("versions"))
    return checkCatalogSourceVersions().then((versions) => Response.json({ versions }));
  const previewId = params.get("preview");
  if (previewId) {
    try {
      const { ids: _ids, ...preview } = previewSourceRemoval(previewId);
      return Response.json(preview);
    } catch {
      return Response.json({ error: "Catalog source not found" }, { status: 404 });
    }
  }
  return Response.json({ sources: listCatalogSources() });
}

// A JSON body adds a GitHub repository; a .zip body installs an uploaded plugin.
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
  if (contentType !== "application/json") return uploadSource(request);
  const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
  if (typeof body?.url !== "string")
    return Response.json({ error: "Enter a GitHub repository URL" }, { status: 400 });
  try {
    return Response.json(await addCatalogSource(body.url));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not add source" },
      { status: 400 },
    );
  }
}

export async function PUT(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    try {
      return Response.json(await checkCatalogSource(id));
    } catch {
      return Response.json({ error: "Catalog source not found" }, { status: 404 });
    }
  }
  return Response.json({ results: await checkCatalogSources() });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Catalog source is required" }, { status: 400 });
  try {
    const { ids: _ids, ...preview } = await removeCatalogSource(id);
    return Response.json(preview, { status: preview.canRemove ? 200 : 409 });
  } catch {
    return Response.json({ error: "Catalog source not found" }, { status: 404 });
  }
}

async function uploadSource(request: Request) {
  // The API router has already limited the size of this body.
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (!bytes.byteLength) return Response.json({ error: "Choose a plugin .zip file" }, { status: 400 });
  try {
    return Response.json(await addUploadedCatalogSource(bytes));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not install the plugin" },
      { status: 400 },
    );
  }
}
