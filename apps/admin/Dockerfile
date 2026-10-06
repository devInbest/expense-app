# Build context is the repo root: docker build -f apps/admin/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL
COPY . .
RUN pnpm install --frozen-lockfile --filter "@expense/admin..."
RUN pnpm --filter @expense/admin build

FROM nginx:alpine
COPY --from=build /repo/apps/admin/dist /usr/share/nginx/html
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
