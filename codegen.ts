import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "apps/paint-vault/graphql/schema.graphql",
  documents: "packages/vault-ui/src/dom/graphql/*.graphql",
  generates: {
    "packages/vault-ui/src/dom/graphql/generated/": {
      preset: "client",
      presetConfig: { fragmentMasking: { unmaskFunctionName: "getFragmentData" } },
      config: { useTypeImports: true, strictScalars: true, scalars: { Sequence: "string" } },
    },
    "apps/paint-vault/graphql/generated/resolvers.ts": {
      plugins: [{ add: { content: "/* eslint-disable */" } }, "typescript", "typescript-resolvers"],
      config: {
        useTypeImports: true,
        contextType: "../context#GraphQLContext",
        // Custom scalar internal representation, not its decimal-string wire format.
        scalars: { Sequence: "number" },
        strictScalars: true,
      },
    },
  },
  hooks: { afterAllFileWrite: ["prettier --write"] },
};
export default config;
