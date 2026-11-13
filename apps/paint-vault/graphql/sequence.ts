import { GraphQLError, GraphQLScalarType, Kind } from "graphql";

const invalidSequence = () =>
  new GraphQLError(
    "Sequence must be a canonical nonnegative decimal string no greater than 9007199254740991",
    { extensions: { code: "BAD_USER_INPUT" } },
  );

function parseSequence(value: unknown): number {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(value) || value.length > 16)
    throw invalidSequence();
  const sequence = Number(value);
  if (!Number.isSafeInteger(sequence) || String(sequence) !== value) throw invalidSequence();
  return sequence;
}

// GraphQL Int is signed 32-bit; SQLite's change-log routinely outlives that range.
// Keep safe numbers in SQLite services, but use lossless decimal strings on the wire.
export const Sequence = new GraphQLScalarType<number, string>({
  name: "Sequence",
  description: "A nonnegative safe-integer revision encoded as a canonical decimal string.",
  serialize(value) {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
      throw new GraphQLError("Invalid internal change-log sequence");
    return String(value);
  },
  parseValue: parseSequence,
  parseLiteral(node) {
    if (node.kind !== Kind.STRING) throw invalidSequence();
    return parseSequence(node.value);
  },
});
