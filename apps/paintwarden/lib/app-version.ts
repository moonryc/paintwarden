import packageJson from "../package.json" with { type: "json" };

// The server's release version. Catalog sources compare it with their `minimumAppVersion`.
export const APP_VERSION: string = packageJson.version;
