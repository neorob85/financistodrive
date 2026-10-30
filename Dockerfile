# Stage 1: Build
FROM node:22.23.4-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Production
FROM node:22.23.4-alpine

# Version of the image, passed by build.sh from package.json
ARG APP_VERSION=dev
LABEL org.opencontainers.image.title="Financisto Drive" \
      org.opencontainers.image.version="${APP_VERSION}"
ENV APP_VERSION=${APP_VERSION}

# Apply Alpine security patches and drop package managers not needed at runtime
RUN apk upgrade --no-cache \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg

WORKDIR /app

COPY --from=build /app/.output .output
COPY --from=build /app/app/assets/simplemoney_schema.sql app/assets/simplemoney_schema.sql
COPY --from=build /app/app/assets/sql app/assets/sql

# Create persistent directories, writable by the unprivileged runtime user
RUN mkdir -p server/data public/uploads \
 && chown -R node:node server/data public/uploads

USER node

# Declare volumes for persistent data
VOLUME ["/app/server/data", "/app/public/uploads"]

ENV HOST=0.0.0.0
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
