FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/agentmail/package.json packages/agentmail/package.json
COPY packages/mock-sites/package.json packages/mock-sites/package.json
COPY packages/database/package.json packages/database/package.json
RUN npm ci
COPY . .
RUN npm run build --workspace=@life-agent/api

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production API_PORT=4000
COPY --from=build /app /app
EXPOSE 4000
CMD ["npm", "run", "start", "--workspace=@life-agent/api"]