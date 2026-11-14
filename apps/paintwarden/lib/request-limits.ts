export type BodyLimit = { maxBytes: number; message: string };

// Applies a size limit to a request's body before anything reads it. Returns null when the
// declared length is already over the limit. A body with no declared length is counted as it
// arrives; going over makes reading it fail, and `exceeded` then reports why.
export function limitRequestBody(request: Request, limit: BodyLimit) {
  if (!request.body) return { request, exceeded: () => false };
  if (Number(request.headers.get("content-length") ?? 0) > limit.maxBytes) return null;
  let total = 0;
  let over = false;
  const body = request.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        total += chunk.byteLength;
        if (total > limit.maxBytes) {
          over = true;
          controller.error(new Error(limit.message));
          return;
        }
        controller.enqueue(chunk);
      },
    }),
  );
  return {
    request: new Request(request, { body, duplex: "half" } as RequestInit),
    exceeded: () => over,
  };
}
