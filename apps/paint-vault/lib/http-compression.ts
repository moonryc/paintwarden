// Only JSON API responses are candidates; images, ZIP backups, and other streams pass through.
export const JSON_COMPRESSION_THRESHOLD = 1024;

function acceptsGzip(header: string | null) {
  if (!header) return false;
  const qualities = new Map<string, number>();
  for (const entry of header.split(",")) {
    const [name, ...parameters] = entry.trim().toLowerCase().split(";");
    const quality = parameters.find((parameter) => parameter.trim().startsWith("q="));
    const value = quality?.trim().slice(2).trim();
    const weight =
      value === undefined ? 1 : /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(value) ? Number(value) : 0;
    const coding = name.trim();
    qualities.set(coding, Math.min(qualities.get(coding) ?? 1, weight));
  }
  const gzip = qualities.get("gzip") ?? qualities.get("*") ?? 0;
  return gzip > 0 && gzip >= (qualities.get("identity") ?? 0);
}

function noTransform(headers: Headers) {
  return /(?:^|,)\s*no-transform\s*(?:,|$)/i.test(headers.get("cache-control") ?? "");
}

function addVary(headers: Headers) {
  const vary = headers.get("vary");
  if (!vary?.split(",").some((field) => ["*", "accept-encoding"].includes(field.trim().toLowerCase()))) {
    headers.set("vary", vary ? `${vary}, Accept-Encoding` : "Accept-Encoding");
  }
}

// Peek only as far as the threshold, then keep streaming with backpressure and cancellation.
// In particular, never buffer an entire large response merely to decide whether to compress it.
async function peekBody(body: ReadableStream<Uint8Array<ArrayBuffer>>) {
  const reader = body.getReader();
  const prefix: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  let done = false;
  while (size < JSON_COMPRESSION_THRESHOLD && !done) {
    const next = await reader.read();
    done = next.done;
    if (next.value) {
      prefix.push(next.value);
      size += next.value.byteLength;
    }
  }
  const stream = new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(controller) {
      for (const chunk of prefix) controller.enqueue(chunk);
      if (done) controller.close();
    },
    async pull(controller) {
      const next = await reader.read();
      if (next.done) controller.close();
      else controller.enqueue(next.value);
    },
    cancel(reason: unknown) {
      return reader.cancel(reason);
    },
  });
  return { stream, size };
}

export async function compressJsonResponse(request: Request, result: Response): Promise<Response> {
  const contentType = result.headers.get("content-type")?.split(";")[0].trim() ?? "";
  if (
    request.method === "HEAD" ||
    !result.body ||
    result.status === 206 ||
    result.headers.has("content-range") ||
    result.headers.has("content-encoding") ||
    !/^application\/(?:json|[\w.+-]+\+json)$/i.test(contentType) ||
    noTransform(request.headers) ||
    noTransform(result.headers)
  ) {
    return result;
  }

  const headers = new Headers(result.headers);
  // Include Vary even for identity responses so caches cannot serve them to the wrong client.
  addVary(headers);
  if (!acceptsGzip(request.headers.get("accept-encoding"))) {
    return new Response(result.body, { status: result.status, statusText: result.statusText, headers });
  }

  const { stream, size } = await peekBody(result.body);
  const compress = size >= JSON_COMPRESSION_THRESHOLD;
  if (compress) {
    headers.set("content-encoding", "gzip");
    headers.delete("content-length");
    headers.delete("content-md5");
    headers.delete("content-digest");
    const etag = headers.get("etag");
    if (etag && !etag.startsWith("W/")) headers.set("etag", `W/${etag}`);
  }
  return new Response(compress ? stream.pipeThrough(new CompressionStream("gzip")) : stream, {
    status: result.status,
    statusText: result.statusText,
    headers,
  });
}
