#!/usr/bin/env node
// Existing immutable image only; never builds/pulls or uses user data/Compose.
import { runRuntime } from "./graphql-phase5-runtime.mjs";
await runRuntime("docker", process.argv.slice(2));
