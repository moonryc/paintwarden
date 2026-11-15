import {
  cancelPluginInstall,
  currentPluginInstallJob,
  PluginInstallBusyError,
  pluginInstallFailure,
  pluginInstallRunning,
  startPluginInstall,
} from "../../../lib/catalog-install-jobs";
import { spoolPluginUpload } from "../../../lib/catalog-install-upload";
import {
  addCatalogSource,
  addUploadedCatalogSource,
  checkCatalogSource,
  checkCatalogSourceVersions,
  checkCatalogSources,
  listCatalogSources,
  previewSourceRemoval,
  prepareCatalogSourceUpdates,
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
    const url = body.url;
    return Response.json(
      { job: startPluginInstall((context) => addCatalogSource(url, context)) },
      { status: 202 },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not add source" },
      { status: error instanceof PluginInstallBusyError ? 409 : 400 },
    );
  }
}

// Coalesce overlapping automatic probes, without reserving/publishing an install job.
const automaticRefreshes = new Map<string, ReturnType<typeof automaticRefresh>>();
async function automaticRefresh(id?: string) {
  if (pluginInstallRunning()) throw new PluginInstallBusyError();
  const previousJobId = currentPluginInstallJob()?.id;
  const prepared = await prepareCatalogSourceUpdates(id);
  // A manual install may have started (and even finished) during the network probe.
  // Never replace that job with the delayed automatic refresh.
  if (pluginInstallRunning() || currentPluginInstallJob()?.id !== previousJobId)
    throw new PluginInstallBusyError();
  return {
    job: prepared.install ? startPluginInstall(prepared.install) : null,
    versions: prepared.versions,
  };
}

export async function PUT(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  try {
    if (params.get("automatic") === "1") {
      const key = id ?? "";
      let pending = automaticRefreshes.get(key);
      if (!pending) {
        pending = automaticRefresh(id ?? undefined).finally(() => automaticRefreshes.delete(key));
        automaticRefreshes.set(key, pending);
      }
      const result = await pending;
      return Response.json(result, { status: result.job ? 202 : 200 });
    }
    const job = startPluginInstall((context) =>
      id ? checkCatalogSource(id, context) : checkCatalogSources(context),
    );
    return Response.json({ job }, { status: 202 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not update plugins" },
      { status: error instanceof PluginInstallBusyError ? 409 : 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const jobId = new URL(request.url).searchParams.get("job");
  if (jobId) {
    const job = cancelPluginInstall(jobId);
    return Response.json(job ? { job } : { error: "Plugin install job not found" }, {
      status: job ? 200 : 404,
    });
  }
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
  let ready!: () => void;
  let failed!: (error: unknown) => void;
  const uploaded = new Promise<void>((resolve, reject) => {
    ready = resolve;
    failed = reject;
  });
  try {
    const job = startPluginInstall(async (context) => {
      const spool = await spoolPluginUpload(request, context.signal!).catch((error: unknown) => {
        failed(error);
        throw error;
      });
      ready();
      try {
        return await addUploadedCatalogSource(spool.source, context);
      } finally {
        await spool.close().catch(() => {
          process.stderr.write(JSON.stringify({ event: "plugin.upload.cleanup-failed" }) + "\n");
        });
      }
    });
    // Consume the incoming request before returning; the server closes its request signal
    // with the response. The install itself is independent of that HTTP connection.
    await uploaded;
    return Response.json({ job: currentPluginInstallJob() ?? job }, { status: 202 });
  } catch (error) {
    return Response.json(pluginInstallFailure(error), {
      status: error instanceof PluginInstallBusyError ? 409 : 400,
    });
  }
}
