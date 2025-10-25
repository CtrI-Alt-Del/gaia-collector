FROM oven/bun:1 AS deps
WORKDIR /app

COPY bun.lock package.json ./

RUN bun install --frozen-lockfile --production

FROM oven/bun:1 AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules

COPY bun.lock package.json tsconfig.json ./
COPY src ./src
COPY global-bundle.pem ./global-bundle.pem

USER bun

CMD ["bun", "run", "src/index.ts"]
