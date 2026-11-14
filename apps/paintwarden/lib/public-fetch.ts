import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http, { type IncomingMessage } from "node:http";
import https from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";

// Downloads a file from a URL someone gave the server. Every address a request connects to must
// be public, so a link can't reach services on the server's own network. Addresses are checked
// as each connection is made, including after redirects, so a hostname can't pass a check and
// then resolve somewhere else.

export class BlockedUrlError extends Error {}
export class ResponseTooLargeError extends Error {}

const blocked = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blocked.addSubnet(network, prefix, "ipv4");
// IPv4 addresses written as IPv6 (::ffff:a.b.c.d) are matched against the IPv4 rules above.
for (const [network, prefix] of [
  ["::", 96],
  ["::ffff:0:0:0", 96],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
] as const)
  blocked.addSubnet(network, prefix, "ipv6");

export function isPublicAddress(address: string) {
  const family = isIP(address);
  if (!family || address.includes("%")) return false;
  return !blocked.check(address, family === 6 ? "ipv6" : "ipv4");
}

export type PublicDownloadOptions = {
  maxBytes: number;
  accept?: string;
  httpsOnly?: boolean;
  timeoutMs?: number;
};

const MAX_REDIRECTS = 4;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

async function readBody(response: IncomingMessage, maxBytes: number) {
  if (Number(response.headers["content-length"] ?? 0) > maxBytes) {
    response.destroy();
    throw new ResponseTooLargeError("The response is too large");
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of response as AsyncIterable<Buffer>) {
    total += chunk.byteLength;
    if (total > maxBytes) {
      response.destroy();
      throw new ResponseTooLargeError("The response is too large");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// `allowed` is replaceable so tests can use a server on this machine.
export function createPublicDownloader(allowed: (address: string) => boolean = isPublicAddress) {
  const blockedUrl = () => new BlockedUrlError("That address is not public");

  const lookup: LookupFunction = (hostname, options, callback) => {
    dnsLookup(hostname, { ...options, all: true }, (error, addresses: LookupAddress[]) => {
      if (error) return callback(error, "", 0);
      // Every result must be public, since the connection may try any of them.
      if (!addresses.length || addresses.some((item) => !allowed(item.address)))
        return callback(blockedUrl(), "", 0);
      if (options.all) return callback(null, addresses);
      return callback(null, addresses[0].address, addresses[0].family);
    });
  };

  // Addresses written directly in the URL skip the lookup above, so they are checked here.
  function checkUrl(url: URL, httpsOnly: boolean) {
    if (url.protocol !== "https:" && (httpsOnly || url.protocol !== "http:")) throw blockedUrl();
    if (url.username || url.password) throw blockedUrl();
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (isIP(host) && !allowed(host)) throw blockedUrl();
  }

  function open(url: URL, accept: string, signal: AbortSignal) {
    return new Promise<IncomingMessage>((resolve, reject) => {
      const client = url.protocol === "https:" ? https : http;
      // No shared agent: a reused connection would skip the address check.
      const request = client.request(
        url,
        { agent: false, lookup, signal, headers: { accept, "user-agent": "Paintwarden/1.0" } },
        resolve,
      );
      request.once("error", reject);
      request.end();
    });
  }

  return async function downloadPublic(start: URL, options: PublicDownloadOptions) {
    const signal = AbortSignal.timeout(options.timeoutMs ?? 30_000);
    let current = start;
    for (let redirects = 0; ; redirects += 1) {
      checkUrl(current, options.httpsOnly ?? false);
      const response = await open(current, options.accept ?? "*/*", signal);
      const status = response.statusCode ?? 0;
      const location = response.headers.location;
      if (!REDIRECT_STATUSES.has(status) || !location)
        return {
          status,
          contentType: response.headers["content-type"]?.split(";")[0].trim().toLowerCase() ?? "",
          bytes: await readBody(response, options.maxBytes),
        };
      response.destroy();
      if (redirects === MAX_REDIRECTS) throw new Error("Too many redirects");
      current = new URL(location, current);
    }
  };
}

export const downloadPublic = createPublicDownloader();
