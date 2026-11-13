import assert from "node:assert/strict";
import test from "node:test";

import { GraphQLError, parseValue } from "graphql";

import { Sequence } from "./sequence.ts";

void test("Sequence preserves the full safe integer range beyond GraphQL Int32", () => {
  for (const sequence of [0, 2147483647, 2147483648, Number.MAX_SAFE_INTEGER]) {
    assert.equal(Sequence.serialize(sequence), String(sequence));
    assert.equal(Sequence.parseValue(String(sequence)), sequence);
    assert.equal(Sequence.parseLiteral(parseValue(JSON.stringify(String(sequence))), undefined), sequence);
  }
});

void test("Sequence requires canonical decimal strings on the wire", () => {
  for (const value of [
    undefined,
    null,
    0,
    1.5,
    true,
    {},
    [],
    "",
    "-1",
    "+1",
    "00",
    "01",
    "1.0",
    "1e3",
    " 1",
    "1 ",
    "1\n",
    "1\r\n",
    "١",
    "9007199254740992",
    "999999999999999999999999999999",
    "NaN",
    "Infinity",
  ]) {
    assert.throws(() => Sequence.parseValue(value), GraphQLError);
  }
  for (const literal of ["0", "1.5", "true", "null", "{}", "[]", '"01"', '"9007199254740992"'])
    assert.throws(() => Sequence.parseLiteral(parseValue(literal), undefined), GraphQLError);
});

void test("Sequence refuses unsafe or nonnumeric internal values rather than rounding", () => {
  for (const value of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, "1", null, undefined])
    assert.throws(() => Sequence.serialize(value), GraphQLError);
});
