FROM node:22-slim

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY src ./src
COPY toolspec.json ./

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

USER node
CMD ["node", "src/server.mjs"]
