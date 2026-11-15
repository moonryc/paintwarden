import http, { type IncomingMessage, type RequestListener } from "node:http";
import type { Socket } from "node:net";

export const DEFAULT_DESKTOP_NETWORK_PORT = 48177;
const networkRequests = new WeakSet<Request>();
const networkOrigins = new WeakMap<IncomingMessage, string>();
export function markDesktopNetworkRequest(request: Request) {
  networkRequests.add(request);
}
export function isDesktopNetworkRequest(request: Request): boolean {
  return networkRequests.has(request);
}
export function desktopNetworkOrigin(request: IncomingMessage) {
  return networkOrigins.get(request);
}

export type NetworkConfiguration = {
  enabled: boolean;
  port: number;
  hosts: string[];
  magicDns?: string[];
};
export type NetworkState = { enabled: boolean; port: number; error?: string };

function validHost(host: unknown): host is string {
  // Hosts are discovered by the parent, not accepted from HTTP or renderer input.
  return typeof host === "string" && host.length < 254 && /^[a-z0-9.-]+$/i.test(host);
}
function configuredPort(value: number) {
  return Number.isInteger(value) && value > 0 && value <= 65535 ? value : DEFAULT_DESKTOP_NETWORK_PORT;
}
function loopback(address: string | undefined) {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

/** A second listener over the existing Express application. Never changes its local listener. */
export function createDesktopNetworkServer(handler: RequestListener) {
  let server: http.Server | undefined;
  let port = DEFAULT_DESKTOP_NETWORK_PORT;
  let state: NetworkState = { enabled: false, port };
  const sockets = new Set<Socket>();
  let pending = Promise.resolve(state);

  async function stop() {
    const previous = server;
    server = undefined;
    state = { enabled: false, port };
    // close() alone leaves SSE and other active responses alive indefinitely.
    for (const socket of sockets) socket.destroy();
    sockets.clear();
    if (previous) await new Promise<void>((resolve) => previous.close(() => resolve()));
  }

  async function configure(input: NetworkConfiguration): Promise<NetworkState> {
    await stop();
    if (!input.enabled) return state;
    port = configuredPort(input.port);
    const hosts = new Set(input.hosts.filter(validHost));
    hosts.add("127.0.0.1"); // Internal target for manually configured Tailscale Serve.
    const dns = new Set((input.magicDns || []).filter(validHost));
    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = port;
      const listener = http.createServer((request, response) => {
        const host = request.headers.host;
        const raw = request.rawHeaders;
        const count = (name: string) =>
          raw.filter((_, index) => index % 2 === 0 && raw[index].toLowerCase() === name).length;
        let origin: string | undefined;
        if (count("host") === 1 && count("origin") <= 1 && typeof host === "string") {
          const direct = `http://${host}`;
          if (
            [...hosts].some((value) => host === `${value}:${candidate}`) &&
            (request.headers.origin === undefined || request.headers.origin === direct)
          )
            origin = direct;
          // Only the local Tailscale daemon may assert HTTPS. Never enable Express trust proxy.
          const forwardedHost = request.headers["x-forwarded-host"] ?? host;
          if (
            loopback(request.socket.remoteAddress) &&
            request.headers["x-forwarded-proto"] === "https" &&
            typeof forwardedHost === "string" &&
            dns.has(forwardedHost) &&
            count("x-forwarded-host") <= 1 &&
            count("x-forwarded-proto") === 1 &&
            (host === forwardedHost || host === `127.0.0.1:${candidate}`) &&
            (request.headers.origin === undefined || request.headers.origin === `https://${forwardedHost}`)
          ) {
            origin = `https://${forwardedHost}`;
          }
        }
        if (!origin) {
          response.writeHead(403, { "content-type": "text/plain", "cache-control": "no-store" });
          response.end("Unrecognized phone access host or origin");
          return;
        }
        networkOrigins.set(request, origin);
        handler(request, response);
      });
      listener.on("connection", (socket) => {
        sockets.add(socket);
        socket.on("close", () => sockets.delete(socket));
      });
      try {
        await new Promise<void>((resolve, reject) => {
          listener.once("error", reject);
          listener.listen(candidate, "0.0.0.0", () => {
            listener.removeListener("error", reject);
            resolve();
          });
        });
        server = listener;
        // A later server error must not crash the vault process.
        listener.on("error", () => {
          void stop();
        });
        state = { enabled: true, port };
        return state;
      } catch (error) {
        for (const socket of sockets) socket.destroy();
        if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE") break;
        port = port >= 65535 ? DEFAULT_DESKTOP_NETWORK_PORT : port + 1;
      }
    }
    state = {
      enabled: false,
      port,
      error: "Phone access could not start. Check the port and firewall settings.",
    };
    return state;
  }
  return {
    configure(input: NetworkConfiguration) {
      const operation = pending.then(() => configure(input));
      pending = operation.catch(() => state);
      return operation;
    },
    state: () => ({ ...state }),
    isNetworkRequest: (request: IncomingMessage) => networkOrigins.has(request),
  };
}

/** This channel exists only in the bundled desktop child, after the local app is ready. */
export function installDesktopNetworkIpc(network: ReturnType<typeof createDesktopNetworkServer>) {
  if (process.env.PAINTWARDEN_DESKTOP !== "1" || !process.send) return;
  process.on("message", (message: unknown) => {
    const input = message as { type?: string; id?: string; config?: NetworkConfiguration };
    if (
      input?.type !== "phone-access:configure" ||
      typeof input.id !== "string" ||
      !input.config ||
      typeof input.config.enabled !== "boolean" ||
      !Array.isArray(input.config.hosts) ||
      (input.config.magicDns !== undefined && !Array.isArray(input.config.magicDns))
    )
      return;
    void network.configure(input.config).then((state) => {
      if (process.connected) {
        try {
          process.send?.({ type: "phone-access:result", id: input.id, state }, () => {});
        } catch {
          /* The parent can disconnect between the check and send. */
        }
      }
    });
  });
  process.on("disconnect", () => {
    void network.configure({ enabled: false, port: 0, hosts: [] });
  });
}
