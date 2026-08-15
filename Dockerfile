FROM node:22-slim

LABEL org.opencontainers.image.title="Refractory Inventory Platform"
LABEL org.opencontainers.image.description="Grounded inventory planning and decision-support application"

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY public ./public
COPY data/serving ./data/serving
COPY server.mjs ./

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

USER node
CMD ["node", "server.mjs"]
