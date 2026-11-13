import { spawn } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const processes = [
  spawn("npm", ["run", "dev", "--workspace", "paint-vault"], {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      HOST: process.env.HOST || "127.0.0.1",
      PORT: process.env.PAINT_VAULT_API_PORT || "3175",
    },
    shell: process.platform === "win32",
  }),
  spawn("npm", ["run", "dev", "--workspace", "paint-vault-web"], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  }),
];
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    stopping = true;
    for (const child of processes) child.kill(signal);
  });
for (const child of processes)
  child.on("exit", (code) => {
    if (!stopping) {
      stopping = true;
      for (const other of processes) if (other !== child) other.kill();
      process.exitCode = code || 1;
    }
  });
