import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const child = spawn(
  process.execPath,
  [path.join(root, "node_modules/nx/dist/bin/nx.js"), ...process.argv.slice(2)],
  {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, NX_DAEMON: "false", NX_ISOLATE_PLUGINS: "false" },
  },
);

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal === "SIGINT" ? 130 : 1);
});
