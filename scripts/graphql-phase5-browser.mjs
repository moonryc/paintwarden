#!/usr/bin/env node
// Existing approved production build only. Default is an honest NOT RUN plan.
import { runRuntime } from "./graphql-phase5-runtime.mjs";
await runRuntime("browser", process.argv.slice(2));
