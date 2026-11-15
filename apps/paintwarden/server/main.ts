import "reflect-metadata";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

import { All, Controller, Logger, Module, Req, Res } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import express, { type Request as ExpressRequest, type Response as ExpressResponse } from "express";

import { migrationBackupPath } from "../db";
import { CLIENT_ADDRESS_HEADER, clientAddress, pendingSetupCode, trustProxy } from "../lib/auth";
import { clearBackupUploads } from "../lib/backup";
import { sweepCatalogImageStages } from "../lib/catalog-image-staging";
import { sweepPluginUploads } from "../lib/catalog-install-upload";
import {
  createDesktopNetworkServer,
  desktopNetworkOrigin,
  installDesktopNetworkIpc,
  markDesktopNetworkRequest,
} from "../lib/desktop-network";
import { compressJsonResponse } from "../lib/http-compression";
import { reportStartupProgress } from "../lib/startup-progress";

import { routeApi } from "./api-router";

const desktop = process.env.PAINTWARDEN_DESKTOP === "1";

function requestUrl(request: ExpressRequest) {
  // request.protocol reads X-Forwarded-Proto only when "trust proxy" is on.
  const networkOrigin = desktopNetworkOrigin(request);
  if (networkOrigin) return `${networkOrigin}${request.originalUrl}`;
  const protocol = request.protocol;
  const forwardedHost =
    !desktop && trustProxy() ? request.get("x-forwarded-host")?.split(",")[0].trim() : undefined;
  const host = forwardedHost || request.headers.host || "localhost";
  return `${protocol}://${host}${request.originalUrl}`;
}

async function forward(request: ExpressRequest, response: ExpressResponse) {
  const hasBody = !["GET", "HEAD"].includes(request.method);
  const headers = new Headers(request.headers as HeadersInit);
  headers.set(
    CLIENT_ADDRESS_HEADER,
    clientAddress(request.socket.remoteAddress, request.get("x-forwarded-for"), !desktop && trustProxy()),
  );
  const abort = new AbortController();
  const disconnect = () => abort.abort();
  request.once("aborted", disconnect);
  response.once("close", disconnect);
  const webRequest = new Request(requestUrl(request), {
    method: request.method,
    signal: abort.signal,
    headers,
    ...(hasBody ? { body: Readable.toWeb(request) as ReadableStream, duplex: "half" as const } : {}),
  });
  if (desktopNetworkOrigin(request)) markDesktopNetworkRequest(webRequest);
  try {
    const result = await compressJsonResponse(webRequest, await routeApi(webRequest));
    response.status(result.status);
    result.headers.forEach((value, key) => response.setHeader(key, value));
    if (!result.body) {
      response.end();
      return;
    }
    // Streamed, so a large backup is never held in memory. A failure partway through closes the
    // connection, and the client sees an incomplete download rather than a damaged file.
    await pipeline(Readable.fromWeb(result.body as NodeReadableStream), response).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code !== "ERR_STREAM_PREMATURE_CLOSE") Logger.error(error);
      },
    );
  } finally {
    request.off("aborted", disconnect);
    response.off("close", disconnect);
    abort.abort();
  }
}

// The same policy as the desktop app's pages, plus refusing to be framed by other sites.
const SECURITY_HEADERS = {
  "content-security-policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https: http:; font-src 'self' data:; connect-src 'self'; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "same-origin",
};

@Controller("api")
class ApiController {
  @All("*path")
  async handle(@Req() request: ExpressRequest, @Res() response: ExpressResponse) {
    await forward(request, response);
  }

  @All()
  async root(@Req() request: ExpressRequest, @Res() response: ExpressResponse) {
    await forward(request, response);
  }
}

@Module({ controllers: [ApiController] })
class AppModule {}

async function listenServer() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  app.set("trust proxy", !desktop && trustProxy());
  if (desktop) {
    app.use((request: ExpressRequest, _response: ExpressResponse, next: () => void) => {
      // No ambient proxy setting may change the desktop client identity or URL.
      for (const name of Object.keys(request.headers)) {
        if (name === "forwarded" || name.startsWith("x-forwarded-")) delete request.headers[name];
      }
      next();
    });
  }
  app.disable("x-powered-by");
  app.use((_request: ExpressRequest, response: ExpressResponse, next: () => void) => {
    // Defaults for every response; an API route can replace them, as the source logos do.
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.setHeader(name, value);
    next();
  });
  const webDirectory = path.resolve(process.env.WEB_DIST || path.join(import.meta.dirname, "web-dist"));
  Logger.log(`Serving web files from ${webDirectory}`);
  app.use(express.static(webDirectory));
  // The database opens, and is migrated if needed, before the server accepts requests.
  const backup = migrationBackupPath();
  if (backup) Logger.log(`Saved a copy of the vault before updating it: ${backup}`);
  await clearBackupUploads();
  await sweepPluginUploads();
  await sweepCatalogImageStages();
  const port = Number(process.env.PORT || 3000);
  await app.listen(port, process.env.HOST || "0.0.0.0");
  if (desktop) {
    const network = createDesktopNetworkServer(app.getHttpAdapter().getInstance());
    installDesktopNetworkIpc(network);
  }
  const setupCode = pendingSetupCode();
  if (setupCode) Logger.warn(`Enter this setup code to create the owner account: ${setupCode}`);
  return app;
}

export async function startServer() {
  reportStartupProgress({ phase: "starting" });
  try {
    const app = await listenServer();
    reportStartupProgress({ phase: "ready" });
    return app;
  } catch (error) {
    reportStartupProgress({
      phase: "failed",
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

if (process.env.NODE_ENV !== "test") {
  startServer().catch((error) => {
    Logger.error(error);
    process.exitCode = 1;
  });
}
