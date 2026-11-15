# syntax=docker/dockerfile:1
FROM node:22.22.2-bookworm-slim AS dependencies

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/paintwarden/package.json ./apps/paintwarden/package.json
COPY apps/paintwarden-web/package.json ./apps/paintwarden-web/package.json
COPY packages/paint-core/package.json ./packages/paint-core/package.json
COPY packages/paint-i18n/package.json ./packages/paint-i18n/package.json
COPY packages/vault-ui/package.json ./packages/vault-ui/package.json
RUN npm ci --no-audit --no-fund

FROM dependencies AS builder
COPY . .
# The image serves only the app, so the website and its dependencies are left out.
RUN node scripts/nx.mjs build paintwarden \
    && node scripts/copy-third-party-notices.mjs apps/paintwarden-web/dist apps/paintwarden/dist/web-dist

FROM dependencies AS production-dependencies
COPY scripts/prune-sharp-wasm.mjs ./scripts/prune-sharp-wasm.mjs
RUN npm prune --omit=dev \
    && node scripts/prune-sharp-wasm.mjs /app

FROM node:22.22.2-bookworm-slim AS runner

WORKDIR /app/apps/paintwarden
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATA_DIR=/data

RUN mkdir -p /data && chown node:node /data
COPY --from=production-dependencies --chown=node:node /app/node_modules /app/node_modules
# Preserve lockfile-nested server dependencies as well as hoisted modules. This
# stage contains only dependency manifests/modules, not source or user data.
COPY --from=production-dependencies --chown=node:node /app/apps/paintwarden ./
COPY --from=builder --chown=node:node /app/apps/paintwarden/dist ./dist
COPY --from=builder --chown=node:node /app/apps/paintwarden/dist/drizzle ./drizzle
COPY --from=builder --chown=node:node /app/apps/paintwarden/package.json ./package.json

COPY --from=builder --chown=node:node /app/LICENSE /app/LICENSE
COPY --from=builder --chown=node:node /app/THIRD_PARTY_NOTICES.txt /app/THIRD_PARTY_NOTICES.txt
COPY --from=builder --chown=node:node /app/third-party /app/third-party

# Compare the final filesystem to the source inventory, without shipping build tools.
RUN --mount=type=bind,from=builder,source=/app,target=/notice-source \
    node /notice-source/scripts/check-notice-artifact.mjs --docker-root /app --root /notice-source \
    && node -e "require('sharp')({create:{width:16,height:16,channels:3,background:'#345678'}}).webp().toBuffer().then(b=>{if(b.length<20)process.exit(1)}).catch(e=>{console.error(e);process.exit(1)})"

USER node
EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/server.mjs"]
