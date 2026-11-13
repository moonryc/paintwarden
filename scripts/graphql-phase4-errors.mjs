// Retain every raw error. A stale cursor is recoverable only after the same
// operation/scope returns successful data, and the functional scenario succeeds.
const scope = (entry) =>
  JSON.stringify(
    Object.entries(entry.body?.variables ?? {})
      .filter(([key]) => !/after$/i.test(key))
      .sort(([a], [b]) => a.localeCompare(b)),
  );
export function graphqlObservations(entries, checks = []) {
  const recoveredStaleCursors = [],
    unexpected = [];
  const functionalSuccess = !checks.some((check) => check.status === "FAIL");
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    if (!entry.data?.errors?.length) continue;
    const later =
      functionalSuccess &&
      entry.body?.operationName &&
      entry.data.errors.every((error) => error.extensions?.code === "STALE_CURSOR") &&
      entries
        .slice(index + 1)
        .find(
          (candidate) =>
            candidate.body?.operationName === entry.body.operationName &&
            scope(candidate) === scope(entry) &&
            candidate.status === 200 &&
            candidate.data?.data &&
            !candidate.data?.errors?.length,
        );
    if (later)
      recoveredStaleCursors.push({
        operationName: entry.body.operationName,
        startedAt: entry.startedAt,
        recoveredAt: later.startedAt,
        errors: entry.data.errors,
      });
    else unexpected.push(entry);
  }
  return {
    rawGraphqlErrorResponses: recoveredStaleCursors.length + unexpected.length,
    recoveredStaleCursors,
    unexpected,
  };
}
