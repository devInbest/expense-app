# Build context is the repo root: docker build -f apps/api/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile --filter "@expense/api..."
RUN pnpm --filter @expense/api build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/apps/api/package.json ./
# Workspace packages are bundled into dist by tsup, so only npm deps are installed here.
RUN npm install --omit=dev --ignore-scripts
COPY --from=build /repo/apps/api/dist ./dist
EXPOSE 5099
CMD ["node", "dist/index.js"]
