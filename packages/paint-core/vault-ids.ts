// Every record ID in a vault is a random UUID, so IDs made by different vaults, sources and
// devices never collide. Items a vault owner creates (paints, schemes, templates) carry a `user:`
// prefix in front of the UUID; catalog sources ship bare UUIDs, so installing a source can never
// collide with the owner's own data.
export const USER_ID_PREFIX = "user:";

// A lowercase UUID such as `0f8b3c1e-2d4a-4b6c-9e7f-1a2b3c4d5e6f`.
export const UUID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/;

export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_PATTERN.test(value);

export const isUserId = (id: string) => id.startsWith(USER_ID_PREFIX);

// A vault item ID: a bare UUID, or the owner's `user:` prefix followed by one.
export const isVaultItemId = (value: unknown): value is string =>
  typeof value === "string" && isUuid(isUserId(value) ? value.slice(USER_ID_PREFIX.length) : value);

export const newUserId = () => `${USER_ID_PREFIX}${crypto.randomUUID()}`;
