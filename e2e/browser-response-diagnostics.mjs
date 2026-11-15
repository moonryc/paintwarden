// Classify only Chromium's unavailable-body diagnostic for a discarded request.
// The caller records HTTP status before reading the body; actual HTTP, GraphQL,
// malformed JSON and live-document transport failures must still fail the gate.
export function isDiscardedResponseBody(error, { documentChanged, requestFailure }) {
  return (
    /Protocol error \(Network\.getResponseBody\): No data found for resource with given identifier/.test(
      error.message,
    ) &&
    (documentChanged || requestFailure === "net::ERR_ABORTED")
  );
}
