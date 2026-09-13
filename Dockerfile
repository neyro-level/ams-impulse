ARG NODE_BASE=node:24.20.0-bookworm-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e
FROM ${NODE_BASE} AS base
ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.5.1 --activate
WORKDIR /app

FROM base AS build-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS runtime-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

FROM build-deps AS build
COPY . .
RUN pnpm build && pnpm build:collector

FROM ${NODE_BASE} AS runtime-base
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM runtime-base AS migrator
COPY --from=build-deps /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/src/platform/config/database-target.ts ./src/platform/config/database-target.ts
COPY --from=build /app/src/platform/config/server-environment.ts ./src/platform/config/server-environment.ts
COPY --from=build /app/scripts/migrator-entrypoint.mjs ./scripts/migrator-entrypoint.mjs
COPY --from=build /app/scripts/pgboss-migrate.mjs ./scripts/pgboss-migrate.mjs
USER node
ENTRYPOINT ["node", "scripts/migrator-entrypoint.mjs"]
CMD ["migrate"]

FROM runtime-base AS runtime
COPY --from=runtime-deps /app/node_modules ./node_modules
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/dist-collector ./dist-collector
COPY --from=build /app/scripts/runtime-entrypoint.mjs ./scripts/runtime-entrypoint.mjs
USER node
ENTRYPOINT ["node", "scripts/runtime-entrypoint.mjs"]
CMD ["web"]
